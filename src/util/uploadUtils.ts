import {v4} from 'uuid';
import {ThunkDispatch} from 'redux-thunk';
import {AnyAction, Store} from 'redux';
import {toast} from 'react-toastify';

import {AnyProperties, defaultMapProperties, defaultMiniProperties, FileMetadata} from './storage/storageContract';
import * as constants from './constants';
import {addFilesAction, removeFileAction, replaceFileAction} from '../redux/fileIndexReducer';
import {
    getAllFilesFromStore,
    getFolderStacksFromStore,
    getUploadPlaceholdersFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import {
    addUploadPlaceholderAction,
    incrementUploadProgressAction,
    incrementUploadTargetProgressAction,
    removeUploadPlaceholderAction,
    setUploadProgressAction,
    UploadPlaceholderType
} from '../redux/uploadPlaceholderReducer';
import {FileAPI} from './storage/storageContract';
import { OnProgressParams } from './storage/storageContract';
import {FOLDER_MAP, FOLDER_MINI} from './constants';

export type UploadType = {
    name: string;
    files: File[];
    metadataId?: string;
    subdirectories?: UploadType[];
};

function getAncestorMetadata(metadata: FileMetadata, store: Store<ReduxStoreType>, rootId: string, result: FileMetadata[] = []): FileMetadata[] {
    const uploadPlaceholders = getUploadPlaceholdersFromStore(store.getState());
    const {fileMetadata} = getAllFilesFromStore(store.getState());
    for (let parentId of metadata.parents) {
        if (parentId !== rootId) {
            const parentMetadata = uploadPlaceholders.entities[parentId]?.metadata || fileMetadata[parentId];
            if (parentMetadata) {
                result.push(parentMetadata);
                getAncestorMetadata(parentMetadata, store, rootId, result);
            }
        }
    }
    return result;
}

const folderToProperties: Record<string, AnyProperties> = {
    [FOLDER_MINI]: defaultMiniProperties,
    [FOLDER_MAP]: defaultMapProperties,
};

export function createUploadPlaceholder(store: Store<ReduxStoreType>, rootFolder: string,
                                 name: string, parents: string[], file?: File, directoryDepth = 0, upload = false): FileMetadata {
    // Create a placeholder file, and also increment the target progress of its ancestor directories.
    const metadata: FileMetadata = {
        id: v4(), name, parents, trashed: false, appProperties: undefined, properties: folderToProperties[rootFolder],
        mimeType: directoryDepth ? constants.MIME_TYPE_DRIVE_FOLDER : ''
    };
    store.dispatch(addUploadPlaceholderAction(metadata, rootFolder, file, directoryDepth, upload));
    store.dispatch(addFilesAction([metadata]));
    if (upload) {
        const rootId = getAllFilesFromStore(store.getState()).roots[rootFolder];
        const ancestorMetadata = getAncestorMetadata(metadata, store, rootId);
        if (ancestorMetadata.length > 0) {
            store.dispatch(incrementUploadTargetProgressAction(ancestorMetadata, rootFolder));
        }
    }
    return metadata;
}

export function replaceUploadPlaceholder(store: Store<ReduxStoreType>, rootFolder: string,
                                  oldMetadata: FileMetadata, newMetadata: FileMetadata | null): void {
    if (newMetadata) {
        store.dispatch(replaceFileAction(oldMetadata, newMetadata, rootFolder));
    } else {
        store.dispatch(removeUploadPlaceholderAction(oldMetadata.id));
        store.dispatch(removeFileAction(oldMetadata));
    }
    // update progress on our ancestor folders as well.
    const rootId = getAllFilesFromStore(store.getState()).roots[rootFolder];
    const ancestorMetadata = getAncestorMetadata(oldMetadata, store, rootId);
    if (ancestorMetadata.length > 0) {
        store.dispatch(incrementUploadProgressAction(ancestorMetadata));
    }
}

export async function createMultipleUploadPlaceholders(store: Store<ReduxStoreType>, rootFolder: string,
                                                       fileAPI: FileAPI, upload: UploadType, parents: string[],
                                                       depth = 1, parentExists = true) {
    let siblingMetadata: FileMetadata[] = [];
    const placeholders: FileMetadata[] = [];
    if (parentExists) {
        const parentMetadataId = parents[0];
        const files = getAllFilesFromStore(store.getState());
        if (files.children[parentMetadataId]) {
            siblingMetadata = files.children[parentMetadataId].map((childId) => (files.fileMetadata[childId]));
        } else {
            await fileAPI.loadFilesInFolder(parentMetadataId, (files: FileMetadata[]) => {
                store.dispatch(addFilesAction(files));
                siblingMetadata.push(...files);
            });
        }
    }
    for (let file of upload.files) {
        // Skip files which already exist in the destination with exactly the same name.
        const match = siblingMetadata.find((sibling) => (sibling?.name === file.name));
        if (match) {
            toast(`Skipping existing file "${match.name}".`);
        } else {
            placeholders.push(createUploadPlaceholder(store, rootFolder, file.name, parents, file, 0, true));
        }
    }
    if (upload.subdirectories) {
        for (let subdir of upload.subdirectories) {
            // Merge into existing directories which already exist in the destination with exactly the same name.
            let subdirExists;
            const match = siblingMetadata.find((sibling) => (sibling?.name === subdir.name));
            if (match) {
                subdir.metadataId = match.id;
                subdirExists = true;
            } else {
                const metadata = createUploadPlaceholder(store, rootFolder, subdir.name, parents, undefined, depth, true);
                subdir.metadataId = metadata.id;
                subdirExists = false;
            }
            await createMultipleUploadPlaceholders(store, rootFolder, fileAPI, subdir, [subdir.metadataId], depth + 1, subdirExists);
        }
    }
    return placeholders;
}

async function uploadFileFromPlaceholder(fileAPI: FileAPI, dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>,
                                         placeholder: UploadPlaceholderType): Promise<FileMetadata | null> {
    const {file, metadata} = placeholder;
    if (!file) {
        return null;
    }
    const {parents, id} = metadata;
    try {
        const fileMetadata = await fileAPI.uploadFile({name: file.name, parents}, file, (progress: OnProgressParams) => {
            dispatch(setUploadProgressAction(id, progress.loaded, progress.total));
        });
        await fileAPI.makeFileReadableToAll(fileMetadata);
        return fileMetadata;
    } catch (e) {
        const message = `Failed to upload file ${file.name}`;
        toast(message)
        console.error(message, e);
        return null;
    }
}

export async function uploadFromPlaceholder(store: Store<ReduxStoreType>, fileAPI: FileAPI,
                                            placeholder: UploadPlaceholderType, continueUpload: boolean) {
    let metadata: FileMetadata | null = null;
    if (continueUpload && !placeholder.deleted) {
        if (placeholder.file) {
            metadata = await uploadFileFromPlaceholder(fileAPI, store.dispatch, placeholder);
        } else if (placeholder.directoryDepth) {
            metadata = await fileAPI.createFolder(placeholder.metadata.name, {parents: placeholder.metadata.parents});
        }
    }
    await replaceUploadPlaceholder(store, placeholder.rootFolder, placeholder.metadata, metadata);
}

export async function uploadMultipleFiles(store: Store<ReduxStoreType>, fileAPI: FileAPI,
                                          topDirectory: string, upload: UploadType) {
    const folderStack = getFolderStacksFromStore(store.getState())[topDirectory]
    const parents = folderStack.slice(folderStack.length - 1);
    return createMultipleUploadPlaceholders(store, topDirectory, fileAPI, upload, parents);
}