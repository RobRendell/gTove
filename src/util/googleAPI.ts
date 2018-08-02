import {partition} from 'lodash';

import * as constants from './constants';
import {fetchWithProgress, FetchWithProgressResponse} from './fetchWithProgress';
import {FileAPI, OnProgressParams} from './fileUtils';
import {
    DriveFileShortcut,
    DriveMetadata,
    DriveUser,
    isDriveFileShortcut,
    isWebLinkAppProperties
} from './googleDriveUtils';
import {promiseSleep} from './promiseSleep';

// The API Key and Client ID are set up in https://console.developers.google.com/
// API key has the following APIs enabled: Google Drive API
const API_KEY = 'AIzaSyDyeV-r65-Iv-iVSwSczguOBF_sRZY9wok';
// Client ID has Authorised JavaScript origins set to http://localhost:3000 (for local dev), as well as the site where the code resides.
const CLIENT_ID = '467803009036-2jo3nhds25lc924suggdl3jman29vt0s.apps.googleusercontent.com';

// CORS proxy for web link maps and minis
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

// Discovery docs for the Google Drive API.
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
// Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

const fileFields = 'id, name, mimeType, appProperties, thumbnailLink, trashed, parents, owners';

const gapi = global['gapi'];

interface GoogleApiFileResult {
    id?: string;
    files: DriveMetadata[];
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
    let user = gapi.auth2.getAuthInstance().currentUser.get();
    return 'Bearer ' + user.getAuthResponse().access_token;
}

/**
 * Until we get a better oAuth scope than drive.file, we have to create fake shortcut files and handle them explicitly.
 *
 * @param {DriveMetadata} shortcutMetadata The metadata of a shortcut file.
 * @return {Promise<DriveMetadata | null>} A promise of the file the shortcut points at, but in the directory of the
 * shortcut, or null if the file is not available.
 */
function getShortcutHack(shortcutMetadata: DriveMetadata<DriveFileShortcut>): Promise<DriveMetadata | null> {
    return googleAPI.getFullMetadata(shortcutMetadata.appProperties.shortcutMetadataId)
        .then((realMetadata) => (realMetadata.trashed ? null : {...realMetadata, parents: shortcutMetadata.parents}))
        .catch((err) => {
            console.error('Error following shortcut', err);
            return null;
        });

}

/**
 * If we get a metadata reference to someone else's file, it won't have parents set... check if we have any local
 * shortcuts to it, and if so, set parents as appropriate.
 *
 * @param {DriveMetadata} realMetadata The metadata, which may be owned by someone else
 * @return {Promise<DriveMetadata>} Either the same metadata, or (if we have a shortcut) the metadata with parents set
 */
function getReverseShortcutHack(realMetadata: DriveMetadata): Promise<DriveMetadata> {
    if (!realMetadata.parents) {
        return googleAPI.findFilesWithAppProperty('shortcutMetadataId', realMetadata.id)
            .then((shortcutMetadatas) => (
                (shortcutMetadatas && shortcutMetadatas.length > 0) ? {
                    ...realMetadata,
                    parents: shortcutMetadatas.reduce((parents: string[], shortcut) => (
                        parents.concat(shortcut.parents)
                    ), [])
                } : realMetadata
            ));
    }
    return Promise.resolve(realMetadata);
}

// ================================================================================

/**
 * Apparently the javascript implementation of the Google Rest API doesn't implement all this for uploading files?
 */
function resumableUpload(location: string, file: Blob, response: Response | FetchWithProgressResponse | null, onProgress?: (progress: OnProgressParams) => void): Promise<DriveMetadata> {
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
                return response
                    .json()
                    .then(({id}) => {
                        return googleAPI.getFullMetadata(id);
                    });
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
    return fetchWithProgress(location, options, onProgress)
        .then((response) => {
            return resumableUpload(location, file, response, onProgress);
        });
}

// ================================================================================

const googleAPI: FileAPI = {

    initialiseFileAPI: (signInHandler, onerror) => {
        gapi.load('client:auth2', {
            callback: () => {
                gapi.client
                    .init({
                        apiKey: API_KEY,
                        clientId: CLIENT_ID,
                        discoveryDocs: DISCOVERY_DOCS,
                        scope: SCOPES
                    })
                    .then(() => {
                        // Listen for sign-in state changes.
                        gapi.auth2.getAuthInstance().isSignedIn.listen(signInHandler);
                        // Handle initial sign-in state.
                        signInHandler(gapi.auth2.getAuthInstance().isSignedIn.get())
                    })
            },
            onerror
        });
    },

    signInToFileAPI: () => {
        gapi.auth2.getAuthInstance().signIn();
    },

    signOutFromFileAPI: () => {
        gapi.auth2.getAuthInstance().signOut();
    },

    getLoggedInUserInfo: () => {
        return gapi.client.drive.about
            .get({
                fields: 'user'
            })
            .then((response: GoogleApiResponse<GoogleApiUserResult>) => (getResult(response).user));
    },

    loadRootFiles: (addFilesCallback): Promise<void> => {
        return gapi.client.drive.files
            .list({
                q: `appProperties has {key='rootFolder' and value='true'} and trashed=false`,
                fields: `files(${fileFields})`
            })
            .then((response: GoogleApiResponse) => {
                const result = getResult(response);
                if (result.files.length > 0) {
                    // Handle the case where the root folder has been renamed
                    result.files[0].name = constants.FOLDER_ROOT;
                    addFilesCallback(result.files);
                    return googleAPI.loadFilesInFolder(result.files[0].id, addFilesCallback);
                } else {
                    return undefined;
                }
            })
    },

    loadFilesInFolder: (id: string, addFilesCallback, pageToken) => {
        return gapi.client.drive.files
            .list({
                q: `'${id}' in parents and trashed=false`,
                pageSize: 50,
                pageToken,
                fields: `nextPageToken, files(${fileFields})`
            })
            .then((response: GoogleApiResponse) => {
                const result = getResult(response);
                const [shortcuts, normal] = partition(result.files, (file) => (file.appProperties && isDriveFileShortcut(file.appProperties)));
                addFilesCallback(normal);
                return Promise.all(shortcuts.map((file) => (getShortcutHack(file as DriveMetadata<DriveFileShortcut>))))
                    .then((shortcuts: DriveMetadata[]) => {
                        addFilesCallback(shortcuts.filter((file) => (file)));
                        return (result.nextPageToken) ? googleAPI.loadFilesInFolder(id, addFilesCallback, result.nextPageToken) : undefined;
                    });

            });
    },

    getFullMetadata: (id) => {
        return gapi.client.drive.files
            .get({
                fileId: id,
                fields: fileFields
            })
            .then((response: GoogleApiResponse<DriveMetadata>) => {
                const metadata = getResult(response);
                if (metadata.appProperties && isDriveFileShortcut(metadata.appProperties)) {
                    return getShortcutHack(metadata as DriveMetadata<DriveFileShortcut>);
                } else  {
                    return getReverseShortcutHack(metadata);
                }
            });
    },

    getFileModifiedTime: (fileId): Promise<number> => {
        return gapi.client.drive.files
            .get({
                fileId,
                fields: 'modifiedTime'
            })
            .then((response: GoogleApiResponse<{modifiedTime: string}>) => {
                const result = getResult(response);
                return Date.parse(result.modifiedTime);
            });
    },

    createFolder: (folderName, metadata) => {
        return gapi.client.drive.files
            .create({
                resource: {
                    name: folderName,
                    mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
                    ...metadata
                },
                fields: 'id'
            })
            .then((response: GoogleApiResponse) => {
                let {id} = getResult(response);
                return id && googleAPI.getFullMetadata(id);
            });
    },

    /**
     * Create or update a file in Drive
     * @param driveMetadata An object containing metadata for drive: id(optional), name, parents
     * @param file The file instance to upload.
     * @param onProgress Optional callback which is periodically invoked with progress.  The parameter has fields {loaded, total}
     * @return Promise<any> A promise that resolves to the drivemetadata when the upload has completed.
     */
    uploadFile: (driveMetadata, file, onProgress) => {
        const authorization = getAuthorisation();
        const options: any = {
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Length': file.size,
                'X-Upload-Content-Type': file.type
            },
            body: JSON.stringify({...driveMetadata, id: undefined})
        };
        let location;
        if (driveMetadata.id) {
            location = `https://www.googleapis.com/upload/drive/v3/files/${driveMetadata.id}?uploadType=resumable`;
            options.method = 'PATCH';
        } else {
            location = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
            options.method = 'POST';
        }
        return fetch(location, options)
            .then((response: Response) => {
                const location = response.headers.get('location');
                if (response.ok && location) {
                    return resumableUpload(location, file, null, onProgress);
                } else {
                    throw response;
                }
            });
    },

    saveJsonToFile: (idOrMetadata, json) => {
        const blob = new Blob([JSON.stringify(json)], {type: constants.MIME_TYPE_JSON});
        const driveMetadata = (typeof(idOrMetadata) === 'string') ? {id: idOrMetadata} : idOrMetadata;
        return googleAPI.uploadFile(driveMetadata, blob);
    },

    uploadFileMetadata: (metadata, addParents?: string) => {
        return (!metadata.id ?
            gapi.client.drive.files.create(metadata)
            :
            gapi.client.drive.files.update({
                fileId: metadata.id,
                name: metadata.name,
                appProperties: metadata.appProperties,
                trashed: metadata.trashed,
                addParents
            }))
            .then((response: GoogleApiResponse) => {
                const {id} = getResult(response);
                return (id && !metadata.trashed) ? googleAPI.getFullMetadata(id) : null;
            });
    },

    createShortcut: (originalFile: Partial<DriveMetadata> & {id: string}, newParent: string) => {
        // The native Drive way requires a more sane oAuth scope than drive.file :(
        // return googleAPI.uploadFileMetadata({id: originalFile.id}, newParent);
        // Note: need to accommodate fromBundleId in originalFile somehow
        // For now, create a new file in the desired location which stores the target metadataId in its appProperties.
        return googleAPI.uploadFileMetadata({name: originalFile.name, appProperties: {...originalFile.appProperties, shortcutMetadataId: originalFile.id}, parents: [newParent]});
    },

    getFileContents: (metadata) => {
        return ((metadata.appProperties) ? Promise.resolve(metadata) : googleAPI.getFullMetadata(metadata.id!))
            .then((fullMetadata) => (
                isWebLinkAppProperties(fullMetadata.appProperties) ? (
                    fetch(CORS_PROXY + fullMetadata.appProperties.webLink, {
                        headers: {'X-Requested-With': 'https://github.com/RobRendell/gTove'}
                    })
                        .then((response) => (response.blob()))
                ) : (
                    gapi.client.drive.files
                        .get({
                            fileId: fullMetadata.id,
                            alt: 'media'
                        })
                        .then((response: GoogleApiResponse) => {
                            const bodyArray = new Uint8Array(response.body.length);
                            for (let index = 0; index < response.body.length; ++index) {
                                bodyArray[index] = response.body.charCodeAt(index);
                            }
                            return new Blob(
                                [ bodyArray ],
                                { type: response.headers['Content-Type'] || undefined }
                            );
                        })
                )
            ))
    },

    getJsonFileContents: (metadata) => {
        return gapi.client.drive.files
            .get({
                fileId: metadata.id,
                alt: 'media'
            })
            .then((response: GoogleApiResponse) => {
                return getResult(response);
            });
    },

    makeFileReadableToAll: (metadata) => {
        return gapi.client.drive.permissions
            .create({
                fileId: metadata.id,
                role: 'reader',
                type: 'anyone'
            });
    },

    findFilesWithAppProperty: (key: string, value: string) => {
        return gapi.client.drive.files
            .list({
                q: `appProperties has {key='${key}' and value='${value}'} and trashed=false`,
                fields: `files(${fileFields})`
            })
            .then((response: GoogleApiResponse) => {
                const result = getResult(response);
                return (result && result.files) ? result.files : [];
            });
    }

};

/**
 * Wrap any function, and if it returns a promise, catch errors and retry with exponential backoff.
 *
 * @param {T} fn The function to wrap so that it retries if it rejects with an appropriate error
 * @return {T} The return result of the wrapped function, potentially after several retries.
 */
function retryErrors<T extends Function>(fn: T): T {
    return <any>function(...args: any[]) {
        const retryFunction = (args: any[], delay: number) => {
            const result = fn(...args);
            return (!result || !result.catch) ? result :
                result.catch((error: any) => {
                    if (error.status === 401) {
                        return promiseSleep(delay)
                            .then(() => (gapi.auth2.getAuthInstance().currentUser.get().reloadAuthResponse()))
                            .then(() => (retryFunction(args, Math.min(30000, 2 * delay))));
                    } else if (error.status === 403) {
                        return promiseSleep(delay)
                            .then(() => (retryFunction(args, Math.min(30000, 2 * delay))));
                    } else {
                        throw error;
                    }
                });
        };
        return retryFunction(args, 500);
    };
}

// Augment each function so it retries if Drive throws a 403 due to rate limits.
Object.keys(googleAPI).forEach((functionName) => {
    googleAPI[functionName] = retryErrors(googleAPI[functionName]);
});

export default googleAPI;