// These keys are set up in https://console.developers.google.com/
// API key has the following APIs enabled: Google Drive API
const API_KEY = 'AIzaSyDyeV-r65-Iv-iVSwSczguOBF_sRZY9wok';
// Client ID has Authorised JavaScript origins set to http://localhost:3000, as well as the site where the code resides.
const CLIENT_ID = '467803009036-2jo3nhds25lc924suggdl3jman29vt0s.apps.googleusercontent.com';
// Discovery docs for the Google Drive API.
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
// Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export function initialiseGoogleAPI(signInHandler) {
    global.gapi.load('client:auth2', () => {
        global.gapi.client
            .init({
                apiKey: API_KEY,
                clientId: CLIENT_ID,
                discoveryDocs: DISCOVERY_DOCS,
                scope: SCOPES
            })
            .then(() => {
                // Listen for sign-in state changes.
                global.gapi.auth2.getAuthInstance().isSignedIn.listen(signInHandler);
                // Handle initial sign-in state.
                signInHandler(global.gapi.auth2.getAuthInstance().isSignedIn.get())
            })
    });
}

export function signInToGoogleAPI() {
    global.gapi.auth2.getAuthInstance().signIn();
}

export function signOutFromGoogleAPI() {
    global.gapi.auth2.getAuthInstance().signOut();
}

export function loadAccessibleDriveFiles(addFilesCallback, pageToken = undefined) {
    return global.gapi.client.drive.files
        .list({
            'pageSize': 50,
            pageToken,
            'fields': 'nextPageToken, files(id, name, mimeType, parents)'
        })
        .then((response) => {
            let files = response.result.files.reduce((all, file) => {
                all[file.id] = file;
                return all;
            }, {});
            addFilesCallback(files);
            if (response.result.nextPageToken) {
                return loadAccessibleDriveFiles(addFilesCallback, response.result.nextPageToken);
            }
        });
}

export function createDriveFolder(folderName, parents = undefined) {
    return global.gapi.client.drive.files
        .create({
            resource: {
                'name': folderName,
                'mimeType': 'application/vnd.google-apps.folder',
                ...(parents && {parents})
            },
            fields: 'id'
        })
}