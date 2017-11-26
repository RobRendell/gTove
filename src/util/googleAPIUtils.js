import * as constants from './constants';
import {fetchWithProgress} from './fetchWithProgress';

// These keys are set up in https://console.developers.google.com/
// API key has the following APIs enabled: Google Drive API
const API_KEY = 'AIzaSyDyeV-r65-Iv-iVSwSczguOBF_sRZY9wok';
// Client ID has Authorised JavaScript origins set to http://localhost:3000, as well as the site where the code resides.
const CLIENT_ID = '467803009036-2jo3nhds25lc924suggdl3jman29vt0s.apps.googleusercontent.com';
// Discovery docs for the Google Drive API.
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
// Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const fileFields = 'id, name, mimeType, thumbnailLink, trashed, parents';

const gapi = global.gapi;

export function initialiseGoogleAPI(signInHandler) {
    gapi.load('client:auth2', () => {
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
    });
}

export function signInToGoogleAPI() {
    gapi.auth2.getAuthInstance().signIn();
}

export function signOutFromGoogleAPI() {
    gapi.auth2.getAuthInstance().signOut();
}

function getResult(response) {
    if (response.status >= 200 && response.status < 300) {
        return response.result;
    } else {
        throw new Error(response);
    }
}

export function loadAccessibleDriveFiles(addFilesCallback, pageToken = undefined) {
    return gapi.client.drive.files
        .list({
            pageSize: 50,
            pageToken,
            fields: `nextPageToken, files(${fileFields})`
        })
        .then((response) => {
            const result = getResult(response);
            let files = result.files.reduce((all, file) => {
                if (!file.trashed) {
                    all[file.id] = file;
                }
                return all;
            }, {});
            addFilesCallback(files);
            if (result.nextPageToken) {
                return loadAccessibleDriveFiles(addFilesCallback, result.nextPageToken);
            }
        });
}

export function createDriveFolder(folderName, parents = undefined) {
    return gapi.client.drive.files
        .create({
            resource: {
                name: folderName,
                mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
                ...(parents && {parents})
            },
            fields: 'id'
        })
        .then((response) => {
            let {id} = getResult(response);
            return gapi.client.drive.files.get({
                fileId: id,
                fields: fileFields
            });
        })
        .then((response) => (getResult(response)));
}

/**
 * Apparently the javascript implementation of the Google Rest API doesn't implement all this for uploading files?
 */

function resumableUpload(location, file, onProgress, response) {
    let options = {
        method: 'PUT',
        headers: {}
    };
    switch (response.status) {
        case null:
            options.body = file;
            break;
        case 200:
        case 201:
            return response
                .json()
                .then(({id}) => {
                    return gapi.client.drive.files.get({
                        fileId: id,
                        fields: fileFields
                    })
                })
                .then((response) => (getResult(response)));
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
            throw new Error(response);
    }
    return fetchWithProgress(location, options, onProgress)
        .then((response) => {
            return resumableUpload(location, file, onProgress, response);
        });
}

export function getAuthorisation() {
    let user = gapi.auth2.getAuthInstance().currentUser.get();
    return 'Bearer ' + user.getAuthResponse().access_token;
}

/**
 * Create or update a file in Drive
 * @param driveMetadata An object containing metadata for drive: id(optional), name, parents
 * @param file The file instance to upload
 * @param onProgress Optional callback which is periodically invoked with progress.  The parameter has fields {loaded, total}
 * @return Promise<any> A promise that resolves to the drivemetadata when the upload has completed.
 */
export function uploadFileToDrive(driveMetadata, file, onProgress = null) {
    let authorization = getAuthorisation();
    let location, options;
    if (driveMetadata.id) {
        location = `https://www.googleapis.com/upload/drive/v3/files/${driveMetadata.id}?uploadType=resumable`;
        options = {
            method: 'PUT',
            headers: {
                'Authorization': authorization,
                'X-Upload-Content-Length': file.size
            }
        };
    } else {
        let body = JSON.stringify({
            name: driveMetadata.name,
            ...(driveMetadata.parents && {parents: driveMetadata.parents})
        });
        location = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
        options = {
            method: 'POST',
            headers: {
                'Authorization': authorization,
                'X-Upload-Content-Length': file.size,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body
        };
    }
    return fetchWithProgress(location, options)
        .then((response) => {
            if (response.status >= 200 && response.status < 300) {
                return resumableUpload(response.headers.get('location'), file, onProgress, {status: null});
            } else {
                throw new Error(response);
            }
        });
}

export function getFileResourceMediaUrl(metadata) {
    return `https://www.googleapis.com/drive/v3/files/${metadata.id}?alt=media`;
}