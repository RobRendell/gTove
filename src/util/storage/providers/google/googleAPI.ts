import {getApp, initializeApp} from 'firebase/app';
import {getFunctions, connectFunctionsEmulator, httpsCallable} from 'firebase/functions';
import {getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut} from 'firebase/auth';

import * as constants from '../../../constants';
import {fetchWithProgress, FetchWithProgressResponse} from '../../../fetchWithProgress';
import { OnProgressParams, FileMetadata, FileSystemUser, AnyProperties, FileShortcut } from '../../storageContract';
import { FileAPI } from '../../storageContract';
import { corsUrl, isFileShortcut } from '../../storageUtils';
import {
    DriveUser,
    driveUserToFileSystemUser,
} from './googleDriveUtils';
import {promiseSleep} from '../../../promiseSleep';

// The API Key and Client ID are set up in https://console.developers.google.com/
// API key has the following APIs enabled: Google Drive API, Identity Toolkit API
const API_KEY = 'AIzaSyDyeV-r65-Iv-iVSwSczguOBF_sRZY9wok';
// Client ID has Authorised JavaScript origins set to http://localhost:3000 (for local dev), as well as the site where
// users load the client.
const CLIENT_ID = '467803009036-2jo3nhds25lc924suggdl3jman29vt0s.apps.googleusercontent.com';

// The Firebase project was created based on the existing project.  It's configured with a web app, and a realtime
// database and functions added. Authentication for the Firebase project also has Google added as a sign-in method, with
// the original project's client ID whitelisted.
const FIREBASE_API_KEY = 'AIzaSyDo5DaDvRUW2tT4YwbXjfKkvjG_r8sLPUk';

// Discovery docs for the Google Drive API.
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
// Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.file email openid profile';

// Firebase configuration.
export const firebaseApp = initializeApp({
    apiKey: FIREBASE_API_KEY,
    projectId: 'virtual-gaming-tabletop',
    authDomain: 'virtual-gaming-tabletop.firebaseapp.com',
    appId: '1:467803009036:web:4e149ef739fbbe9c4ffe29',
    databaseURL: 'https://virtual-gaming-tabletop-default-rtdb.firebaseio.com'
});

const functions = getFunctions(getApp());
if (process.env.REACT_APP_FIREBASE_EMULATOR === 'true') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
}

const fileFields = 'id, name, mimeType, properties, appProperties, thumbnailLink, trashed, parents, owners, resourceKey';

interface GoogleApiFileResult {
    id?: string;
    files: FileMetadata[];
    nextPageToken?: string;
}

interface GoogleApiUserResult {
    user: DriveUser;
}

interface GoogleApiResponse<T = GoogleApiFileResult> {
    result: T;
    body: string;
    headers: object;
    status: number;
    statusText: string;
}

function getResult<T>(response: GoogleApiResponse<T>): T {
    if (response.status >= 200 && response.status < 300) {
        return response.result;
    } else {
        throw response;
    }
}

export function getAuthorisation() {
    const token = gapi.client.getToken();
    return 'Bearer ' + token.access_token;
}

/**
 * Handle our fake shortcut files explicitly.
 *
 * @param {DriveMetadata} shortcutMetadata The metadata of a shortcut file.
 * @return {Promise<DriveMetadata | null>} A promise of the file the shortcut points at (but in the directory of the
 * shortcut and with a merge of properties from the original and the shortcut), or null if the file is not available.
 */
async function getShortcutHack(shortcutMetadata: FileMetadata<void, FileShortcut>): Promise<FileMetadata | null> {
    try {
        const realFileSystemMetadata = await googleAPI.getFullMetadata(shortcutMetadata.properties!.shortcutMetadataId);
        return {
            ...realFileSystemMetadata,
            properties: {
                ...realFileSystemMetadata.properties!,
                ...shortcutMetadata.properties!,
                ownedMetadataId: shortcutMetadata.id
            } as AnyProperties
        };
    } catch (err: any) {
        if (err?.status === 404) {
            return null;
        }
        console.error('Error following shortcut', err);
        throw new Error('Error following shortcut: ' + (err?.status || 'unknown'));
    }
}

/**
 * If we get a metadata reference to someone else's file, it won't have parents set... check if we have any local
 * shortcuts to it, and if so, set parents as appropriate.
 *
 * @param {DriveMetadata} realMetadata The metadata, which may be owned by someone else
 * @return {Promise<DriveMetadata>} Either the same metadata, or (if we have a shortcut) the metadata with parents set
 */
async function getReverseShortcutHack(realMetadata: FileMetadata): Promise<FileMetadata> {
    if (!realMetadata.parents) {
        const shortcutMetadatas = await googleAPI.findFilesWithProperty('shortcutMetadataId', realMetadata.id);
        const parents = (!shortcutMetadatas) ? []
            : shortcutMetadatas.reduce((parents: string[], shortcut) => (
                parents.concat(shortcut.parents)
            ), []);
        realMetadata = {...realMetadata, parents};
    }
    return realMetadata;
}

// ================================================================================

/**
 * Apparently the javascript implementation of the Google Rest API doesn't implement all this for uploading files?
 */
async function resumableUpload(
    location: string,
    file: Blob,
    response: Response | FetchWithProgressResponse | null,
    onProgress?: (progress: OnProgressParams) => void
): Promise<FileMetadata> {
    let options: any = {
        method: 'PUT',
        headers: {}
    };
    if (response === null) {
        options.body = file;
    } else {
        switch (response.status) {
            case 200:
            case 201:
                const result = await response.json() as {id?: string};
                return await googleAPI.getFullMetadata(result.id!);
            case 308:
            case 503:
                let range = response.headers.get('range');
                if (range) {
                    let resume = Number(range.split('-').pop()) + 1;
                    options.body = file.slice(resume);
                    options.headers['Content-Range'] = `${resume}-${file.size}/${file.size}`;
                } else {
                    options.body = file;
                    options.headers['Content-Range'] = `*/${file.size}`;
                }
                break;
            default:
                throw response;
        }
    }
    const progressResponse = await fetchWithProgress(location, options, onProgress);
    return await resumableUpload(location, file, progressResponse, onProgress);
}

// ================================================================================

function addGapiScript() {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('width', '0');
        iframe.setAttribute('height', '0');
        iframe.onload = () => {
            if (!iframe || !iframe.contentDocument || !iframe.contentWindow) {
                reject(new Error('Failed to add iframe'));
                return;
            }
            const script = iframe.contentDocument.createElement('script');
            script.onload = () => {
                resolve(iframe.contentWindow!['gapi' as any]);
            };
            script.onerror = reject;
            script.src = 'https://apis.google.com/js/api.js';
            iframe.contentDocument.head.appendChild(script);
        };
        iframe.onerror = reject;
        iframe.src = process.env.PUBLIC_URL + '/blank.html';
        document.body.appendChild(iframe);
    });
}

async function initialiseGapi(gapi: any) {
    await new Promise((callback, onerror) => {
        gapi.load('client', {callback, onerror})
    });
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS
    });
}

// ================================================================================

const gapi: any = window['gapi' as any]; // Standard version of GAPI
let anonymousGapi: any = window['anonymousGapi' as any]; // Version in an iframe
const google: any = window['google' as any]; // GIS client
let oauthClient: any;
let currentSignInHandler: (signedIn: boolean) => void;

// Firebase functions
const handleOAuthCode = httpsCallable<{code: string},
    {accessToken: string, successCode: string}>(functions, 'handleOAuthCode');
const handleOAuthSuccess = httpsCallable<{successCode: string}, void>(functions, 'handleOAuthSuccess');
const refreshClientAccessToken = 
    httpsCallable<void, {access_token: string}>(functions, 'refreshClientAccessToken');
const gToveSignOut = httpsCallable(functions, 'gToveSignOut');

const googleAPI: FileAPI = {

    initialiseFileAPI: async (signInHandler, onError) => {
        currentSignInHandler = signInHandler;
        try {
            // Jump through some hoops to get two copies of gapi.  One will remain "anonymous", i.e. does not log in
            window['anonymousGapi' as any] = anonymousGapi = anonymousGapi || await addGapiScript();
            await initialiseGapi(anonymousGapi);
            await initialiseGapi(gapi);
            // Set up auth changed callback, which handles returning users
            onAuthStateChanged(getAuth(), async (user) => {
                if (user && !gapi.client.getToken()?.access_token) {
                    try {
                        const result = await refreshClientAccessToken();
                        gapi.client.setToken(result.data);
                        signInHandler(true);
                    } catch (error) {
                        // Ignore errors here, since we're just trying to signin in the background.
                    }
                }
            });
            // Create an oauthClient to popup a prompt for the user to grant access.
            oauthClient = google.accounts.oauth2.initCodeClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                ux_mode: 'popup',
                callback: async (resp: any) => {
                    try {
                        // Submit the oAuth authentication code and get an access_token
                        const result = await handleOAuthCode({code: resp.code});
                        const {accessToken, successCode} = result.data;
                        gapi.client.setToken({access_token: accessToken});
                        // Also authenticate to Firebase
                        const credential = GoogleAuthProvider.credential(null, accessToken);
                        await signInWithCredential(getAuth(), credential);
                        await handleOAuthSuccess({successCode});
                        signInHandler(true);
                    } catch (error) {
                        onError(error as Error);
                    }
                }
            });
            signInHandler(false);
        } catch (err) {
            onError(err as Error);
        }
    },

    signInToFileAPI: () => {
        oauthClient.requestCode();
    },

    signOutFromFileAPI: async () => {
        const token = gapi.client.getToken();
        if (token) {
            await gToveSignOut();
            await signOut(getAuth());
            gapi.client.setToken({});
        }
        currentSignInHandler(false);
    },

    getLoggedInUserInfo: async (): Promise<FileSystemUser> => {
        const response = await gapi.client.drive.about.get({fields: 'user'}) as GoogleApiResponse<GoogleApiUserResult>;
        const driveUser = getResult(response).user;
        return driveUserToFileSystemUser(driveUser);
    },

    loadRootFiles: async (addFilesCallback): Promise<void> => {
        const result = await googleAPI.findFilesWithAppProperty('rootFolder', 'true');
        if (result.length > 0) {
            // Handle the case where the root folder has been renamed
            result[0].name = constants.FOLDER_ROOT;
            addFilesCallback(result);
            return await googleAPI.loadFilesInFolder(result[0].id, addFilesCallback);
        } else {
            return undefined;
        }
    },

    loadFilesInFolder: async (id: string, addFilesCallback) => {
        let pageToken = undefined;
        do {
            const response = await gapi.client.drive.files.list({
                q: `'${id}' in parents and trashed=false`,
                pageToken,
                fields: `nextPageToken, files(${fileFields})`
            }) as GoogleApiResponse;
            const result = getResult(response);
            const addedFiles = [];
            for (let file of result.files) {
                const actualFile = isFileShortcut(file) ? await getShortcutHack(file) : file;
                if (actualFile) {
                    addedFiles.push(actualFile);
                }
            }
            if (addedFiles.length > 0) {
                addFilesCallback(addedFiles);
            }
            pageToken = result.nextPageToken;
        } while (pageToken !== undefined);
    },

    getFullMetadata: async (fileId, accessKey): Promise<FileMetadata> => {
        const response = await driveFilesGet({fileId, fields: fileFields, resourceKey: accessKey});
        const metadata = getResult(response);
        let fileMeta: FileMetadata;
        if (isFileShortcut(metadata)) {
            fileMeta = (await getShortcutHack(metadata))!;
        } else  {
            fileMeta = await getReverseShortcutHack(metadata);
        }
        return fileMeta;
    },

    getFileModifiedTime: async (fileId): Promise<number> => {
        const response = await driveFilesGet({fileId, fields: 'modifiedTime'});
        const result = getResult(response);
        return Date.parse((result as any)['modifiedTime']);
    },

    createFolder: async (folderName, metadata): Promise<FileMetadata> => {
        const fileMetadata = metadata || {} as FileMetadata;
        const response = await gapi.client.drive.files.create({
            resource: {
                name: folderName,
                mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
                ...fileMetadata
            },
            fields: 'id'
        }) as GoogleApiResponse;
        const {id} = getResult(response);
        return googleAPI.getFullMetadata(id!);
    },

    /**
     * Create or update a file in Drive
     * @param driveMetadata An object containing metadata for drive: id(optional), name, parents
     * @param file The file instance to upload.
     * @param onProgress Optional callback which is periodically invoked with progress.  The parameter has fields
     *     {loaded, total}
     * @return Promise<any> A promise that resolves to the drivemetadata when the upload has completed.
     */
    uploadFile: async (fileSystemMetadata, file, onProgress): Promise<FileMetadata> => {
        // Ensure required fields are present for the adapter
        const fullFileSystemMetadata: FileMetadata = {
            id: fileSystemMetadata.id || '',
            name: fileSystemMetadata.name || '',
            trashed: fileSystemMetadata.trashed || false,
            parents: fileSystemMetadata.parents || [],
            mimeType: fileSystemMetadata.mimeType,
            thumbnailLink: fileSystemMetadata.thumbnailLink,
            owners: fileSystemMetadata.owners,
            appData: fileSystemMetadata.appData,
            customProperties: fileSystemMetadata.customProperties
        };
        const authorization = getAuthorisation();
        const options: any = {
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Length': file.size,
                'X-Upload-Content-Type': file.type
            },
            body: JSON.stringify({...fullFileSystemMetadata, id: undefined})
        };
        let location;
        if (fullFileSystemMetadata.id) {
            location = `https://www.googleapis.com/upload/drive/v3/files/${fullFileSystemMetadata.id}?uploadType=resumable`;
            options.method = 'PATCH';
        } else {
            location = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
            options.method = 'POST';
        }
        const response = await fetch(location, options);
        location = response.headers.get('location');
        if (response.ok && location) {
            const driveResult = await resumableUpload(location, file, null, onProgress);
            return driveResult;
        } else {
            throw response;
        }
    },

    saveJsonToFile: (idOrMetadata, json): Promise<FileMetadata> => {
        const blob = new Blob([JSON.stringify(json)], {type: constants.MIME_TYPE_JSON});
        const partialMetadata = (typeof(idOrMetadata) === 'string') ? {id: idOrMetadata} : idOrMetadata;
        // Ensure required fields for the metadata
        const fileSystemMetadata: Partial<FileMetadata> = {
            id: partialMetadata.id,
            name: partialMetadata.name || 'data.json',
            trashed: partialMetadata.trashed || false,
            parents: partialMetadata.parents || [],
            mimeType: partialMetadata.mimeType || constants.MIME_TYPE_JSON,
            ...partialMetadata
        };
        return googleAPI.uploadFile(fileSystemMetadata, blob);
    },

    uploadFileMetadata: async (fileSystemMetadata : Partial<FileMetadata>, addParents?: string[], removeParents?: string[]): Promise<FileMetadata> => {
        const properties = fileSystemMetadata.properties === undefined 
            ? undefined
            : Object.keys(fileSystemMetadata.properties).reduce((cleaned: any, key: string) => {
            cleaned[key] = (typeof((fileSystemMetadata.properties as any)![key] ) === 'object')
                            ? JSON.stringify((fileSystemMetadata.properties as any)![key])
                            : (fileSystemMetadata.properties as any)![key];
            return cleaned;
        }, {});
        const response = await (!fileSystemMetadata.id ?
            gapi.client.drive.files.create(fileSystemMetadata)
            :
            gapi.client.drive.files.update({
                fileId: fileSystemMetadata.id,
                name: fileSystemMetadata.name,
                appProperties: fileSystemMetadata.appProperties,
                properties,
                addParents: addParents ? addParents.join(',') : undefined,
                removeParents: removeParents ? removeParents.join(',') : undefined
            }));
        const {id} = getResult(response) as {id: string};
        return await googleAPI.getFullMetadata(id);
    },

    createShortcut: async (originalFile: Partial<FileMetadata> & {id: string}, newParents: string[]): Promise<FileMetadata> => {
        // Note: need to accommodate fromBundleId in originalFile somehow
        // Manually emulate shortcuts using properties, rather than using native metadata.shortcutDetails.
        const ownedMetadata = await googleAPI.uploadFileMetadata({
            name: originalFile.name,
            customProperties: {...originalFile.customProperties, shortcutMetadataId: originalFile.id} as any,
            parents: newParents
        });
        return {...ownedMetadata, customProperties: {...originalFile.customProperties, shortcutMetadataId: originalFile.id,
                ownedMetadataId: ownedMetadata.id}};
    },

    getFileContents: async (fileSystemMetadata): Promise<Blob> => {
        const fullMetadata = (fileSystemMetadata.appData || fileSystemMetadata.customProperties) ? fileSystemMetadata : await googleAPI.getFullMetadata(fileSystemMetadata.id!, (fileSystemMetadata as any)._driveResourceKey);
        if (fullMetadata.customProperties && fullMetadata.customProperties.webLink) {
            const response = await fetch(corsUrl(fullMetadata.customProperties.webLink), {
                headers: {'X-Requested-With': 'https://github.com/RobRendell/gTove'}
            });
            return await response.blob();
        } else {
            const response = await driveFilesGet({fileId: fullMetadata.id!, alt: 'media', resourceKey: (fullMetadata as any)._driveResourceKey});
            const bodyArray = new Uint8Array(response.body.length);
            for (let index = 0; index < response.body.length; ++index) {
                bodyArray[index] = response.body.charCodeAt(index);
            }
            return new Blob(
                [ bodyArray ],
                { type: (response.headers as any)['Content-Type'] || undefined }
            );
        }
    },

    getJsonFileContents: async (fileSystemMetadata): Promise<any> => {
        const response = await driveFilesGet({fileId: fileSystemMetadata.id!, alt: 'media', resourceKey: (fileSystemMetadata as any)._driveResourceKey});
        return getResult(response);
    },

    makeFileReadableToAll: (fileSystemMetadata): Promise<void> => {
        return gapi.client.drive.permissions
            .create({
                fileId: fileSystemMetadata.id,
                role: 'reader',
                type: 'anyone'
            });
    },

    findFilesWithAppProperty: async (key: string, value: string): Promise<FileMetadata[]> => {
        return await findFilesWithQuery(`appProperties has {key='${key}' and value='${value}'} and trashed=false`);
    },

    findFilesWithProperty: async (key: string, value: string): Promise<FileMetadata[]> => {
        return await findFilesWithQuery(`properties has {key='${key}' and value='${value}'} and trashed=false`);
    },

    findFilesContainingNameWithProperty: async (name: string, key: string, value: string): Promise<FileMetadata[]> => {
        const nameEscaped = name.replace("'", "\\'");
        return await findFilesWithQuery(`name contains '${nameEscaped}' and properties has {key='${key}' and value='${value}'} and trashed=false`, true);
    },

    deleteFile: async (fileSystemMetadata): Promise<void> => {
        // Need to handle deleting shortcut files.
        if (!fileSystemMetadata.owners) {
            fileSystemMetadata = await googleAPI.getFullMetadata(fileSystemMetadata.id!);
        }
        const ownedByMe = fileSystemMetadata.owners
            && fileSystemMetadata.owners.reduce((me: boolean, owner: FileSystemUser) => (!!me || !!owner.me), false);
        if (ownedByMe) {
            await gapi.client.drive.files.update({
                fileId: fileSystemMetadata.id,
                trashed: true
            });
        } else {
            const shortcutFiles = await googleAPI.findFilesWithProperty('shortcutMetadataId', fileSystemMetadata.id!);
            const metadataParents = fileSystemMetadata.parents;
            const shortcut = metadataParents ? shortcutFiles.find((shortcut) => (
                shortcut.parents.length === metadataParents.length
                && shortcut.parents.reduce<boolean>((match: boolean, parentId: string) => (match && metadataParents.indexOf(parentId) >= 0), true)
            )) : null;
            if (shortcut) {
                await googleAPI.deleteFile(shortcut);
            }
        }
    }

};

/**
 * Wrap any function, and if it returns a promise, catch errors and retry with exponential backoff.
 *
 * @param fn The function to wrap so that it retries if it rejects with an appropriate error
 * @return The return result of the wrapped function, potentially after several retries.
 */
function retryErrors<T extends Function>(fn: T): T {
    return function(...args: any[]) {
        const retryFunction = (args: any[], delay: number) => {
            const result = fn(...args);
            return (!result || !result.catch) ? result :
                result.catch(async (error: any) => {
                    if (error.status === 401) {
                        await promiseSleep(delay);
                        const result = await refreshClientAccessToken();
                        gapi.client.setToken(result.data);
                        return retryFunction(args, Math.min(30000, 2 * delay));
                    } else if (error.status === 403) {
                        return promiseSleep(delay)
                            .then(() => (retryFunction(args, Math.min(30000, 2 * delay))));
                    } else {
                        throw error;
                    }
                });
        };
        return retryFunction(args, 500);
    } as any;
}

// Augment each function so it retries if Drive throws a 403 due to rate limits.
Object.keys(googleAPI).forEach((functionName) => {
    (googleAPI as any)[functionName] = retryErrors((googleAPI as any)[functionName]);
});

async function driveFilesGet(params: {[field: string]: string | undefined}): Promise<GoogleApiResponse<FileMetadata>> {
    // Do a regular drive.files.get, but fall back to anonymous if it throws a 404 error
    try {
        return await gapi.client.drive.files.get(params);
    } catch (err: any) {
        if (err.status === 404) {
            // Attempt to get the file data anonymously
            return await anonymousGapi.client.drive.files.get(params);
        }
        throw err;
    }
}

async function findFilesWithQuery(query: string, expandShortcuts?: boolean): Promise<FileMetadata[]> {
    let result: FileMetadata[] = [];
    let nextPageToken = undefined;
    do {
        const response = await gapi.client.drive.files.list({
            q: query,
            pageToken: nextPageToken,
            fields: `nextPageToken, files(${fileFields})`
        }) as GoogleApiResponse<GoogleApiFileResult>;
        const page = getResult(response);
        for (let file of page.files) {
            const actualFile = !expandShortcuts 
                    ? file 
                    : isFileShortcut(file) 
                        ? await getShortcutHack(file)
                        : await getReverseShortcutHack(file);
            if (actualFile) {
                result.push(actualFile);
            }
        }
        nextPageToken = page.nextPageToken;
    } while (nextPageToken !== undefined);
    return result;
}


export default googleAPI;