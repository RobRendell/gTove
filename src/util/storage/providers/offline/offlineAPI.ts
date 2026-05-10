import without from 'lodash/without';
import {v4} from 'uuid';

import * as constants from '../../../constants';
import {FileAPI, FileMetadata, FileSystemUser} from '../../storageContract';
import {anonymousFetch, isWebLinkProperties} from '../../storageUtils';

// Used instead of googleAPI when offline.

let signInHandler: (signedIn: boolean) => void;
const fileCache: {[key: string]: object} = {};
const directoryCache: {[key: string]: string[]} = {};
const metadataCache: {[key: string]: FileMetadata} = {};

const loggedInUserInfo: FileSystemUser = {
    displayName: 'Offline',
    emailAddress: 'offline user',
    permissionId: '0x8811ff',
    offline: true
};

function updateCaches(metadata: Partial<FileMetadata>, fileContents: object | null = null): Promise<FileMetadata> {
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

    supportsShortcuts: true,

    initialiseFileAPI: async (onInitialised, onSignIn, _onError) => {
        signInHandler = onSignIn;
        onInitialised();
    },

    signInToFileAPI: () => {},

    signOutFromFileAPI: () => {
        signInHandler(false);
    },

    getLoggedInUserInfo: (): Promise<FileSystemUser> => (Promise.resolve(loggedInUserInfo)),

    loadRootFiles: (_addFilesCallback) => (Promise.resolve()),

    loadFilesInFolder: async (id, addFilesCallback): Promise<void> => {
        const files = directoryCache[id] || [];
        addFilesCallback(files.map((metadataId) => (metadataCache[metadataId])));
    },

    getFullMetadata: (id): Promise<FileMetadata> => {
        return Promise.resolve(metadataCache[id]);
    },

    getFileModifiedTime: (id): Promise<number> => {
        const result = (fileCache[id] && (fileCache as any)[id]['lastModified']) ?
            (fileCache as any)[id]['lastModified'] : Date.now();
        return Promise.resolve(result);
    },

    createFolder: (folderName, metadata): Promise<FileMetadata> => {
        return updateCaches({
            ...metadata,
            name: folderName,
            mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
        });
    },

    uploadFile: (fileSystemMetadata, file, onProgress): Promise<FileMetadata> => {
        onProgress && onProgress({loaded: file.size, total: file.size});
        return updateCaches({
            ...fileSystemMetadata,
            thumbnailLink: window.URL.createObjectURL(file),
            owners: [loggedInUserInfo]
        }, file);
    },

    saveJsonToFile: (idOrMetadata, json): Promise<FileMetadata> => {
        const fileSystemMetadata = {
            ...((typeof(idOrMetadata) === 'string') ? {id: idOrMetadata} : idOrMetadata),
            mimeType: constants.MIME_TYPE_JSON,
            owners: [loggedInUserInfo]
        };
        return updateCaches(fileSystemMetadata, json);
    },

    uploadFileMetadata: (fileSystemMetadata, addParents, removeParents): Promise<FileMetadata> => {
        if (fileSystemMetadata.id && (addParents || removeParents)) {
            fileSystemMetadata.parents = metadataCache[fileSystemMetadata.id].parents || [];
            if (addParents) {
                fileSystemMetadata.parents = fileSystemMetadata.parents.concat(addParents);
            }
            if (removeParents) {
                fileSystemMetadata.parents = without(fileSystemMetadata.parents, ...removeParents);
            }
        }
        return updateCaches(fileSystemMetadata);
    },

    createShortcut: (originalFile: Partial<FileMetadata> & {id: string}, newParents: string[]): Promise<FileMetadata> => {
        return updateCaches({...originalFile, parents: [...(originalFile.parents || []), ...newParents]});
    },

    getFileContents: (fileSystemMetadata): Promise<Blob> => {
        const metadataId = fileSystemMetadata.id;
        if (!metadataId) {
            throw new Error('Cannot get file contents without metadata ID');
        }
        if (isWebLinkProperties(fileSystemMetadata.properties)) {
            // Not actually offline, since it requests the webLink, but doesn't require Drive
            return anonymousFetch(fileSystemMetadata.properties.webLink)
                .then((response) => (response.blob()));
        } else {
            return Promise.resolve(fileCache[metadataId] as Blob);
        }
    },

    getJsonFileContents: (fileSystemMetadata): Promise<any> => {
        if (!fileSystemMetadata.id) {
            throw new Error('Cannot get JSON without metadata ID');
        }
        return Promise.resolve(fileCache[fileSystemMetadata.id]);
    },

    makeFileReadableToAll: () => {
        return Promise.resolve();
    },

    findFilesWithAppProperty: (_key: string, _value: string): Promise<FileMetadata[]> => {
        return Promise.resolve([]);
    },

    findFilesWithProperty: (_key: string, _value: string): Promise<FileMetadata[]> => {
        return Promise.resolve([]);
    },

    findFilesContainingNameWithProperty: (_name, _key, _value): Promise<FileMetadata[]> => {
        return Promise.resolve([]);
    },

    deleteFile: async (fileSystemMetadata): Promise<void> => {
        if (fileSystemMetadata.id) {
            delete(metadataCache[fileSystemMetadata.id]);
            delete(fileCache[fileSystemMetadata.id]);
        }
    }

};

export default offlineAPI;