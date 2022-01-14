import {v4} from 'uuid';
import {ThunkDispatch} from 'redux-thunk';
import {AnyAction, Store} from 'redux';
import {toast} from 'react-toastify';

import {DriveMetadata} from './googleDriveUtils';
import * as constants from './constants';
import {addFilesAction, removeFileAction, replaceFileAction} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, ReduxStoreType} from '../redux/mainReducer';
import {
    addUploadPlaceholderAction,
    incrementUploadProgressAction,
    incrementUploadTargetProgressAction,
    setUploadProgressAction,
    UploadPlaceholderType
} from '../redux/uploadPlaceholderReducer';
import {FileAPI, OnProgressParams} from './fileUtils';

export type UploadType = {
    name: string;
    files: File[];
    metadataId?: string;
    subdirectories?: UploadType[];
};

function getAncestorMetadata(metadata: DriveMetadata, store: Store<ReduxStoreType>, rootId: string, result: DriveMetadata[] = []): DriveMetadata[] {
    for (let parentId of metadata.parents) {
        if (parentId !== rootId) {
            const fullMetadata = getAllFilesFromStore(store.getState()).driveMetadata;
            const parentMetadata = fullMetadata[parentId];
            if (parentMetadata) {
                result.push(parentMetadata);
                getAncestorMetadata(parentMetadata, store, rootId, result);
            }
        }
    }
    return result;
}

export function createUploadPlaceholder(store: Store<ReduxStoreType>, rootFolder: string,
                                 name: string, parents: string[], file?: File, isDirectory = false, upload = false): DriveMetadata {
    // Create a placeholder file, and also increment the target progress of its ancestor directories.
    const metadata: DriveMetadata = {
        id: v4(), name, parents, trashed: false, appProperties: undefined, properties: undefined,
        mimeType: isDirectory ? constants.MIME_TYPE_DRIVE_FOLDER : ''
    };
    const rootId = getAllFilesFromStore(store.getState()).roots[rootFolder];
    store.dispatch(addUploadPlaceholderAction(metadata, rootFolder, file, isDirectory, upload));
    store.dispatch(addFilesAction([metadata]));
    const ancestorMetadata = getAncestorMetadata(metadata, store, rootId);
    if (ancestorMetadata.length > 0) {
        store.dispatch(incrementUploadTargetProgressAction(ancestorMetadata, rootFolder));
    }
    return metadata;
}

export function replaceUploadPlaceholder(store: Store<ReduxStoreType>, rootFolder: string,
                                  oldMetadata: DriveMetadata, newMetadata: DriveMetadata | null): DriveMetadata | null {
    if (newMetadata) {
        store.dispatch(replaceFileAction(oldMetadata, newMetadata, rootFolder));
    } else {
        store.dispatch(removeFileAction(oldMetadata));
    }
    // update progress on our ancestor folders as well.
    const files = getAllFilesFromStore(store.getState());
    const rootId = files.roots[rootFolder];
    const ancestorMetadata = getAncestorMetadata(oldMetadata, store, rootId);
    if (ancestorMetadata.length > 0) {
        store.dispatch(incrementUploadProgressAction(ancestorMetadata));
    }
    return newMetadata;
}

export async function createMultipleUploadPlaceholders(store: Store<ReduxStoreType>, rootFolder: string, fileAPI: FileAPI,
                                                       upload: UploadType, parents: string[]) {
    for (let file of upload.files) {
        createUploadPlaceholder(store, rootFolder, file.name, parents, file, false, true);
    }
    if (upload.subdirectories) {
        const parentMetadataId = parents[0];
        let children: DriveMetadata[]
        const files = getAllFilesFromStore(store.getState());
        if (files.children[parentMetadataId]) {
            children = files.children[parentMetadataId].map((childId) => (files.driveMetadata[childId]));
        } else {
            children = [];
            await fileAPI.loadFilesInFolder(parentMetadataId, (files: DriveMetadata[]) => {
                store.dispatch(addFilesAction(files));
                children.push(...files);
            });
        }
        for (let subdir of upload.subdirectories) {
            // Check if subdir exists
            if (!subdir.metadataId || !files.driveMetadata[subdir.metadataId]) {
                const match = children.find((child) => (
                    child?.name === subdir.name
                ));
                if (match) {
                    subdir.metadataId = match.id;
                } else {
                    const metadata = createUploadPlaceholder(store, rootFolder, subdir.name, parents, undefined, true, true);
                    subdir.metadataId = metadata.id;
                }
            }
            await createMultipleUploadPlaceholders(store, rootFolder, fileAPI, subdir, [subdir.metadataId]);
        }
    }
}

async function uploadFileFromPlaceholder(fileAPI: FileAPI, dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>,
                                         placeholder: UploadPlaceholderType): Promise<DriveMetadata | null> {
    const {file, metadata} = placeholder;
    if (!file) {
        return null;
    }
    const {parents, id} = metadata;
    try {
        const driveMetadata = await fileAPI.uploadFile({name: file.name, parents}, file, (progress: OnProgressParams) => {
            dispatch(setUploadProgressAction(id, progress.loaded, progress.total));
        });
        await fileAPI.makeFileReadableToAll(driveMetadata);
        return driveMetadata;
    } catch (e) {
        const message = `Failed to upload file ${file.name}`;
        toast(message)
        console.error(message, e);
        return null;
    }
}

export async function uploadFromPlaceholder(store: Store<ReduxStoreType>, fileAPI: FileAPI,
                                            placeholder: UploadPlaceholderType, continueUpload: boolean) {
    let metadata: DriveMetadata | null = null;
    if (continueUpload) {
        if (placeholder.file) {
            metadata = await uploadFileFromPlaceholder(fileAPI, store.dispatch, placeholder);
        } else if (placeholder.isDirectory) {
            metadata = await fileAPI.createFolder(placeholder.metadata.name, {parents: placeholder.metadata.parents});
        }
    }
    await replaceUploadPlaceholder(store, placeholder.rootFolder, placeholder.metadata, metadata);
}
