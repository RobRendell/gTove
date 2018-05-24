import * as constants from './constants';
import {fetchWithProgress, FetchWithProgressResponse} from './fetchWithProgress';
import {FileAPI, OnProgressParams} from './fileUtils';
import {DriveMetadata, DriveUser} from '../@types/googleDrive';

// The API Key and Client ID are set up in https://console.developers.google.com/
// API key has the following APIs enabled: Google Drive API
const API_KEY = 'AIzaSyDyeV-r65-Iv-iVSwSczguOBF_sRZY9wok';
// Client ID has Authorised JavaScript origins set to http://localhost:3000 (for local dev), as well as the site where the code resides.
const CLIENT_ID = '467803009036-2jo3nhds25lc924suggdl3jman29vt0s.apps.googleusercontent.com';

// Discovery docs for the Google Drive API.
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
// Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

const fileFields = 'id, name, mimeType, appProperties, thumbnailLink, trashed, parents';

const gapi = global['gapi'];

interface GoogleApiFileResult {
    id?: string;
    files: DriveMetadata[];
    nextPageToken?: string;
}

interface GoogleApiFileResponse {
    status: number;
    result: GoogleApiFileResult;
}

interface GoogleApiUserResult {
    user: DriveUser;
}

interface GoogleAPIUserResponse {
    status: number;
    result: GoogleApiUserResult;
}

function getResult(response: GoogleApiFileResponse): GoogleApiFileResult;
function getResult(response: GoogleAPIUserResponse): GoogleApiUserResult;
function getResult(response: GoogleApiFileResponse | GoogleAPIUserResponse): GoogleApiFileResult | GoogleApiUserResult {
    if (response.status >= 200 && response.status < 300) {
        return response.result;
    } else {
        throw new Error(response.toString());
    }
}

export function getAuthorisation() {
    let user = gapi.auth2.getAuthInstance().currentUser.get();
    return 'Bearer ' + user.getAuthResponse().access_token;
}

export function getFileResourceMediaUrl(metadata: Partial<DriveMetadata>): string {
    return `https://www.googleapis.com/drive/v3/files/${metadata.id}?alt=media`;
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
                throw new Error(response.toString());
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
            .then((response: GoogleAPIUserResponse) => (getResult(response).user));
    },

    loadRootFiles: (addFilesCallback): Promise<void> => {
        return gapi.client.drive.files
            .list({
                q: `appProperties has {key='rootFolder' and value='true'} and trashed=false`,
                fields: `files(${fileFields})`
            })
            .then((response: GoogleApiFileResponse) => {
                const result = getResult(response);
                if (result.files.length > 0) {
                    // Handle the case where the root folder has been renamed
                    result.files[0].name = constants.FOLDER_ROOT;
                    addFilesCallback(result.files);
                    return googleAPI.loadFilesInFolder(result.files[0].id, addFilesCallback);
                } else {
                    // Why do you make me do this explicitly, Typescript?
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
            .then((response: GoogleApiFileResponse) => {
                const result = getResult(response);
                addFilesCallback(result.files);
                if (result.nextPageToken) {
                    googleAPI.loadFilesInFolder(id, addFilesCallback, result.nextPageToken);
                }
            });
    },

    getFullMetadata: (id) => {
        return gapi.client.drive.files
            .get({
                fileId: id,
                fields: fileFields
            })
            .then((response: GoogleApiFileResponse) => (getResult(response)));
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
            .then((response: GoogleApiFileResponse) => {
                let {id} = getResult(response);
                return id && googleAPI.getFullMetadata(id);
            });
    },

    /**
     * Create or update a file in Drive
     * @param driveMetadata An object containing metadata for drive: id(optional), name, parents
     * @param file The file instance to upload
     * @param onProgress Optional callback which is periodically invoked with progress.  The parameter has fields {loaded, total}
     * @return Promise<any> A promise that resolves to the drivemetadata when the upload has completed.
     */
    uploadFile: (driveMetadata, file, onProgress) => {
        let authorization = getAuthorisation();
        let options: any = {
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
                    throw new Error(response.toString());
                }
            });
    },

    saveJsonToFile: (driveMetadata, json) => {
        const blob = new Blob([JSON.stringify(json)], {type: constants.MIME_TYPE_JSON});
        return googleAPI.uploadFile(driveMetadata, blob);
    },

    updateFileMetadata: (metadata) => {
        return gapi.client.drive.files
            .update({
                fileId: metadata.id,
                name: metadata.name,
                appProperties: metadata.appProperties,
                trashed: metadata.trashed
            })
            .then((response: GoogleApiFileResponse) => {
                const {id} = getResult(response);
                return (id && !metadata.trashed) ? googleAPI.getFullMetadata(id) : null;
            });
    },

    getJsonFileContents: (metadata) => {
        return gapi.client.drive.files
            .get({
                fileId: metadata.id,
                alt: 'media'
            })
            .then((response: GoogleApiFileResponse) => {
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
    }

};

export default googleAPI;