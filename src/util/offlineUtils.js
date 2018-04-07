import {v4} from 'uuid';

import * as constants from './constants';

// Used instead of googleAPIUtils when offline.

let signInHandler;

const fileCache = {};
const metadataCache = {};

export function initialiseOfflineFileAPI(fn) {
    signInHandler = fn;
}

export function signOutFromFileAPI() {
    signInHandler(false);
}

export function getFullMetadata(id) {
}

function updateCaches(metadata, fileContents = null) {
    const id = metadata.id || v4();
    metadataCache[id] = {...metadataCache[id], ...metadata, id};
    if (fileContents) {
        fileCache[id] = fileContents;
    }
    return Promise.resolve(metadataCache[id]);
}

export function createFolder(folderName, metadata = {}) {
    return updateCaches({
        ...metadata,
        name: folderName,
        mimeType: constants.MIME_TYPE_DRIVE_FOLDER,
    });
}

export function uploadFile(driveMetadata, file, onProgress = null) {
    onProgress && onProgress({loaded: file.size, total: file.size});
    return updateCaches({...driveMetadata, thumbnailLink: window.URL.createObjectURL(file)}, file);
}

export function saveJsonToFile(driveMetadata, json) {
    return updateCaches(driveMetadata, json);
}

export function getFileResourceMediaUrl({id}) {
    return Promise.resolve(window.URL.createObjectURL(fileCache[id]));
}

export function getFileResource({id}) {
    return Promise.resolve(fileCache[id]);
}

export function updateFileMetadata(metadata) {
    return updateCaches(metadata);
}

export function getJsonFileContents(metadata) {
    return Promise.resolve(fileCache[metadata.id]);
}

export function makeFileReadableToAll() {
    return Promise.resolve();
}