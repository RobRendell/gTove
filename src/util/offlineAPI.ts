import {v4} from 'uuid';
import {without} from 'lodash';

import * as constants from './constants';
import {DriveFileOwner, DriveMetadata, isWebLinkProperties} from './googleDriveUtils';
import {corsUrl, FileAPI} from './fileUtils';

// Used instead of googleAPI when offline.

let signInHandler: (signedIn: boolean) => void;
const fileCache: {[key: string]: object} = {};
const directoryCache: {[key: string]: string[]} = {};
const metadataCache: {[key: string]: DriveMetadata} = {};

const loggedInUserInfo = {
    displayName: 'Offline',
    offline: true,
    emailAddress: 'offline user',
    permissionId: 0x333333
};

const ownerInfo: DriveFileOwner = {
    kind: 'drive#user',
    displayName: loggedInUserInfo.displayName,
    emailAddress: loggedInUserInfo.emailAddress,
    permissionId: String(loggedInUserInfo.permissionId),
    photoLink: '',
    me: true
};

function updateCaches(metadata: Partial<DriveMetadata>, fileContents: object | null = null) {
    const id = metadata.id || v4();
    metadataCache[id] = {...metadataCache[id], ...metadata, id};
    if (fileContents) {
        fileCache[id] = fileContents;
    }
    if (metadata.parents) {
        for (let parentId of metadata.parents) {
            directoryCache[parentId] = directoryCache[parentId] || [];
            directoryCache[parentId].push(id);
        }
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

    getLoggedInUserInfo: () => (Promise.resolve(loggedInUserInfo)),

    loadRootFiles: (addFilesCallback) => (Promise.resolve()),

    loadFilesInFolder: async (id, addFilesCallback) => {
        const files = directoryCache[id] || [];
        addFilesCallback(files.map((metadataId) => (metadataCache[metadataId])));
    },

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
        return updateCaches({
            ...driveMetadata,
            thumbnailLink: window.URL.createObjectURL(file),
            owners: [ownerInfo]
        }, file);
    },

    saveJsonToFile: (idOrMetadata, json) => {
        const driveMetadata = {
            ...((typeof(idOrMetadata) === 'string') ? {id: idOrMetadata} : idOrMetadata),
            mimeType: constants.MIME_TYPE_JSON,
            owners: [ownerInfo]
        };
        return updateCaches(driveMetadata, json);
    },

    uploadFileMetadata: (metadata, addParents, removeParents) => {
        if (metadata.id && (addParents || removeParents)) {
            metadata.parents = metadataCache[metadata.id].parents || [];
            if (addParents) {
                metadata.parents = metadata.parents.concat(addParents);
            }
            if (removeParents) {
                metadata.parents = without(metadata.parents, ...removeParents);
            }
        }
        return updateCaches(metadata);
    },

    createShortcut: (originalFile: Partial<DriveMetadata>, newParents: string[]) => {
        return updateCaches({...originalFile, parents: [...(originalFile.parents || []), ...newParents]});
    },

    getFileContents: (metadata) => {
        const metadataId = metadata.id;
        if (!metadataId) {
            throw new Error('Cannot get file contents without metadata ID');
        }
        if (isWebLinkProperties(metadata.properties)) {
            // Not actually offline, since it requests the webLink, but doesn't require Drive
            return fetch(corsUrl(metadata.properties.webLink!), {
                headers: {'X-Requested-With': 'https://github.com/RobRendell/gTove'}
            })
                .then((response) => (response.blob()));
        } else {
            return Promise.resolve(fileCache[metadataId] as Blob);
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
    },

    findFilesWithProperty: (key: string, value: string) => {
        return Promise.resolve([]);
    },

    findFilesContainingNameWithProperty: (name, key, value) => {
        return Promise.resolve([]);
    },

    deleteFile: async (metadata) => {
        if (metadata.id) {
            delete(metadataCache[metadata.id]);
            delete(fileCache[metadata.id]);
        }
    }

};

export default offlineAPI;