import {v4} from 'uuid';

import * as constants from './constants';
import {DriveMetadata, isWebLinkAppProperties} from './googleDriveUtils';
import {corsUrl, FileAPI} from './fileUtils';

// Used instead of googleAPI when offline.

let signInHandler: (signedIn: boolean) => void;
const fileCache: {[key: string]: object} = {};
const metadataCache: {[key: string]: DriveMetadata} = {};

function updateCaches(metadata: Partial<DriveMetadata>, fileContents: object | null = null) {
    const id = metadata.id || v4();
    metadataCache[id] = {...metadataCache[id], ...metadata, id};
    if (fileContents) {
        fileCache[id] = fileContents;
    }
    return Promise.resolve(metadataCache[id]);
}

const offlineAPI: FileAPI = {

    initialiseFileAPI: (callback, _onError) => {
        signInHandler = callback;
    },

    signInToFileAPI: () => {},

    signOutFromFileAPI: () => {
        signInHandler(false);
    },

    getLoggedInUserInfo: () => (Promise.resolve({
        displayName: 'Offline' as string,
        offline: true,
        emailAddress: 'offline user' as string,
        permissionId: 0x333333
    })),

    loadRootFiles: (addFilesCallback) => (Promise.resolve()),

    loadFilesInFolder: (id, addFilesCallback, pageToken) => (Promise.resolve()),

    getFullMetadata: (id) => {
        return Promise.resolve(metadataCache[id]);
    },

    getFileModifiedTime: (id): Promise<number> => {
        const result = (fileCache[id] && fileCache[id]['lastModified']) ?
            fileCache[id]['lastModified'] : Date.now();
        return Promise.resolve(result);
    },

    createFolder: (folderName, metadata) => {
        return updateCaches({
            ...metadata,
            name: folderName,
            mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
        });
    },

    uploadFile: (driveMetadata, file, onProgress) => {
        onProgress && onProgress({loaded: file.size, total: file.size});
        return updateCaches({...driveMetadata, thumbnailLink: window.URL.createObjectURL(file)}, file);
    },

    saveJsonToFile: (idOrMetadata, json) => {
        const driveMetadata = {...((typeof(idOrMetadata) === 'string') ? {id: idOrMetadata} : idOrMetadata), mimeType: constants.MIME_TYPE_JSON};
        return updateCaches(driveMetadata, json);
    },

    uploadFileMetadata: (metadata) => {
        return updateCaches(metadata);
    },

    createShortcut: (originalFile: Partial<DriveMetadata>, newParent: string) => {
        return updateCaches({...originalFile, parents: [...(originalFile.parents || []), newParent]});
    },

    getFileContents: (metadata) => {
        const metadataId = metadata.id;
        if (!metadataId) {
            throw new Error('Cannot get file contents without metadata ID');
        }
        if (isWebLinkAppProperties(metadata.appProperties)) {
            // Not actually offline, since it requests the webLink, but doesn't require Drive
            return fetch(corsUrl(metadata.appProperties.webLink!), {
                headers: {'X-Requested-With': 'https://github.com/RobRendell/gTove'}
            })
                .then((response) => (response.blob()));
        } else {
            return Promise.resolve(fileCache[metadataId]);
        }
    },

    getJsonFileContents: (metadata) => {
        if (!metadata.id) {
            throw new Error('Cannot get JSON without metadata ID');
        }
        return Promise.resolve(fileCache[metadata.id]);
    },

    makeFileReadableToAll: () => {
        return Promise.resolve();
    },

    findFilesWithAppProperty: (key: string, value: string) => {
        return Promise.resolve([]);
    }

};

export default offlineAPI;