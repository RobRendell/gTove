import {createEntityAdapter, createSlice, PayloadAction} from '@reduxjs/toolkit';

import {FileMetadata} from '../util/storage/storageContract';
import {FileIndexActionTypes, RemoveFileActionType, ReplaceFileAction} from './fileIndexReducer';

/**
 * It's not recommended to store non-serializable objects like File in the redux store, but these are short-lived
 * objects which are just used to maintain the state of an ongoing multi-file upload while the user does other things.
 */
export type UploadPlaceholderType = {
    metadata: FileMetadata;
    rootFolder: string;
    file?: File;
    directoryDepth: number;
    progress: number;
    targetProgress: number;
    upload: boolean;
    deleted?: boolean;
}

const uploadPlaceholderAdaptor = createEntityAdapter<UploadPlaceholderType>({
    selectId: (entity) => (entity.metadata.id)
});

const initialState = uploadPlaceholderAdaptor.getInitialState({
    uploading: false,
    singleMetadata: undefined as null | undefined | FileMetadata
});

const uploadPlaceholderSlice = createSlice({
    name: 'uploadPlaceholder',
    initialState,
    reducers: {
        addUploadPlaceholderAction: {
            prepare: (metadata: FileMetadata, rootFolder: string, file: File | undefined, directoryDepth: number, upload = true) => (
                {payload: {metadata, rootFolder, file, directoryDepth, upload, progress: 0, targetProgress: 0}}
            ),
            reducer: (state, action: PayloadAction<UploadPlaceholderType>) => {
                uploadPlaceholderAdaptor.addOne(state, action.payload);
                if (action.payload.upload && !state.uploading) {
                    state.uploading = true;
                    state.singleMetadata = undefined;
                }
            }
        },
        removeUploadPlaceholderAction: {
            prepare: (id: string) => ({payload: id}),
            reducer: (state, action: PayloadAction<string>) => {
                uploadPlaceholderAdaptor.removeOne(state, action.payload);
                if (state.ids.length === 0) {
                    state.uploading = false;
                }
            }
        },
        setUploadProgressAction: {
            prepare: (id: string, progress: number, targetProgress: number) => ({payload: {id, progress, targetProgress}}),
            reducer: (state, action: PayloadAction<{id: string, progress: number, targetProgress: number}>) => {
                const {id, progress, targetProgress} = action.payload;
                const entity = state.entities[id];
                if (entity) {
                    entity.progress = progress;
                    entity.targetProgress = targetProgress;
                }
            }
        },
            incrementUploadProgressAction: (state, action: PayloadAction<FileMetadata[]>) => {
            for (let metadata of action.payload) {
                const entity = state.entities[metadata.id];
                // Increment progress, and if progress reaches target, remove the placeholder unless it's a pending upload.
                if (entity && ++entity.progress >= entity.targetProgress && !entity.upload) {
                    uploadPlaceholderAdaptor.removeOne(state, metadata.id);
                }
                if (state.ids.length === 0) {
                    state.uploading = false;
                }
            }
        },
        incrementUploadTargetProgressAction: {
            prepare: (metadataList: FileMetadata[], rootFolder: string) => ({payload: {metadataList, rootFolder}}),
            reducer: (state, action: PayloadAction<{metadataList: FileMetadata[], rootFolder: string}>) => {
                const {metadataList, rootFolder} = action.payload;
                for (let metadata of metadataList) {
                    if (state.entities[metadata.id]) {
                        state.entities[metadata.id]!.targetProgress++;
                    } else {
                        uploadPlaceholderAdaptor.addOne(state, {
                            metadata,
                            rootFolder,
                            directoryDepth: 1,
                            upload: false,
                            progress: 0,
                            targetProgress: 1
                        })
                    }
                }
            }
        },
        cancelUploadPlaceholderUploadingAction: (state) => {
            state.uploading = false;
            state.singleMetadata = null;
            // sort ids so that directories come are after files, deeper directories come before shallower ones.
            state.ids.sort((id1, id2) => {
                const p1 = state.entities[id1]!;
                const p2 = state.entities[id2]!;
                const diff = p2.directoryDepth - p1.directoryDepth;
                return (p1.directoryDepth === 0 || p2.directoryDepth === 0) ? -diff : diff;
            });
            for (let id of state.ids) {
                const entity = state.entities[id];
                entity?.upload && (entity.deleted = true);
            }
        },
        clearSingleMetadata: (state) => {
            state.singleMetadata = undefined;
        },
        clearUploadingPlaceholderDataAction: (state) => {
            state.singleMetadata = undefined;
            state.uploading = false;
            uploadPlaceholderAdaptor.removeAll(state);
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(FileIndexActionTypes.REPLACE_FILE_ACTION, (state, action: ReplaceFileAction) => {
                const oldId = action.metadata.id;
                const newId = action.newMetadata.id;
                const placeholder = state.entities[oldId];
                uploadPlaceholderAdaptor.removeOne(state, oldId);
                if (placeholder && placeholder.progress < placeholder.targetProgress) {
                    // Preserve the old placeholder's progress under the new id
                    const newPlaceholder = {...placeholder, upload: false, metadata: {...placeholder.metadata, id: newId}};
                    uploadPlaceholderAdaptor.addOne(state, newPlaceholder);
                }
                if (state.ids.length === 0) {
                    state.uploading = false;
                } else {
                    // Update any placeholders which have oldId as a parent
                    for (let id of state.ids) {
                        const placeholder = state.entities[id];
                        if (placeholder && placeholder.metadata.parents.indexOf(oldId) >= 0) {
                            placeholder.metadata.parents = placeholder.metadata.parents.map((parentId) => (parentId === oldId ? newId : parentId));
                        }
                    }
                }
                if (placeholder?.file && !placeholder.deleted) {
                    if (state.singleMetadata) {
                        state.singleMetadata = null;
                    } else if (state.singleMetadata === undefined) {
                        state.singleMetadata = action.newMetadata;
                    }
                }
            })
            .addCase(FileIndexActionTypes.REMOVE_FILE_ACTION, (state, action: RemoveFileActionType) => {
                const placeholder = state.entities[action.fileId];
                if (placeholder) {
                    placeholder.deleted = true;
                    if (placeholder.directoryDepth) {
                        markPlaceholderDescendentsDeleted(state, action.fileId);
                    }
                    // sort ids so that deleted placeholders are last, with deleted files before deleted folders, and
                    // deeper deleted folders before shallower deleted ones.
                    state.ids.sort((id1, id2) => {
                        const p1 = state.entities[id1]!;
                        const p2 = state.entities[id2]!;
                        if (p1.deleted && p2.deleted) {
                            const diff = p2.directoryDepth - p1.directoryDepth;
                            return (p1.directoryDepth === 0 || p2.directoryDepth === 0) ? -diff : diff;
                        } else if (p1.deleted) {
                            return 1;
                        } else {
                            return p2.deleted ? -1 : 0;
                        }
                    });
                }
            });
    }
});

function markPlaceholderDescendentsDeleted(state: typeof initialState, targetId: string): void {
    for (let id of state.ids) {
        const placeholder = state.entities[id];
        if (placeholder && placeholder.metadata.parents.indexOf(targetId) >= 0) {
            placeholder.deleted = true;
            if (placeholder.directoryDepth) {
                markPlaceholderDescendentsDeleted(state, id as string);
            }
        }
    }
}

export type UploadPlaceholderReducerType = ReturnType<typeof uploadPlaceholderSlice.reducer>;

export const {
    addUploadPlaceholderAction,
    cancelUploadPlaceholderUploadingAction,
    clearSingleMetadata,
    clearUploadingPlaceholderDataAction,
    incrementUploadProgressAction,
    incrementUploadTargetProgressAction,
    removeUploadPlaceholderAction,
    setUploadProgressAction
} = uploadPlaceholderSlice.actions;

export default uploadPlaceholderSlice.reducer;