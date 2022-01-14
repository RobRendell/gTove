import {createEntityAdapter, createSlice, PayloadAction} from '@reduxjs/toolkit';

import {DriveMetadata} from '../util/googleDriveUtils';
import {FileIndexActionTypes, RemoveFileActionType, ReplaceFileAction} from './fileIndexReducer';

/**
 * It's not recommended to store non-serializable objects like File in the redux store, but these are short-lived
 * objects which are just used to maintain the state of an ongoing multi-file upload while the user does other things.
 */
export type UploadPlaceholderType = {
    metadata: DriveMetadata;
    rootFolder: string;
    file?: File;
    isDirectory?: boolean
    progress: number;
    targetProgress: number;
    upload: boolean;
}

const uploadPlaceholderAdaptor = createEntityAdapter<UploadPlaceholderType>({
    selectId: (entity) => (entity.metadata.id)
});

const initialState = uploadPlaceholderAdaptor.getInitialState({
    uploading: false,
    singleMetadata: undefined as null | undefined | DriveMetadata
});

const uploadPlaceholderSlice = createSlice({
    name: 'uploadPlaceholder',
    initialState,
    reducers: {
        addUploadPlaceholderAction: {
            prepare: (metadata: DriveMetadata, rootFolder: string, file?: File, isDirectory?: boolean, upload = true) => (
                {payload: {metadata, rootFolder, file, isDirectory, upload, progress: 0, targetProgress: 0}}
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
        incrementUploadProgressAction: (state, action: PayloadAction<DriveMetadata[]>) => {
            for (let metadata of action.payload) {
                const entity = state.entities[metadata.id];
                if (entity && ++entity.progress >= entity.targetProgress) {
                    uploadPlaceholderAdaptor.removeOne(state, metadata.id);
                }
                if (state.ids.length === 0) {
                    state.uploading = false;
                }
            }
        },
        incrementUploadTargetProgressAction: {
            prepare: (metadataList: DriveMetadata[], rootFolder: string) => ({payload: {metadataList, rootFolder}}),
            reducer: (state, action: PayloadAction<{metadataList: DriveMetadata[], rootFolder: string}>) => {
                const {metadataList, rootFolder} = action.payload;
                for (let metadata of metadataList) {
                    if (state.entities[metadata.id]) {
                        state.entities[metadata.id]!.targetProgress++;
                    } else {
                        uploadPlaceholderAdaptor.addOne(state, {
                            metadata,
                            rootFolder,
                            isDirectory: true,
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
        },
        clearSingleMetadata: (state) => {
            state.singleMetadata = undefined;
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
                            placeholder.metadata.parents = placeholder.metadata.parents.map((id) => (id === oldId ? newId : id));
                        }
                    }
                }
                if (placeholder?.file) {
                    if (state.singleMetadata) {
                        state.singleMetadata = null;
                    } else if (state.singleMetadata === undefined) {
                        state.singleMetadata = action.newMetadata;
                    }
                }
            })
            .addCase(FileIndexActionTypes.REMOVE_FILE_ACTION, (state, action: RemoveFileActionType) => {
                const placeholder = state.entities[action.file.id];
                if (placeholder?.isDirectory) {
                    // Mark pending uploads with the removed folder as an ancestor as not-for-upload
                    const descendents = findAllPlaceholderDescendents(state, action.file.id, 0);
                    for (let id of descendents) {
                        const entity = state.entities[id];
                        entity && (entity.upload = false);
                    }
                }
                uploadPlaceholderAdaptor.removeOne(state, action.file.id);
                if (state.ids.length === 0) {
                    state.uploading = false;
                }
            });
    }
});

function findAllPlaceholderDescendents(state: typeof initialState, targetId: string, startIndex: number, result: string[] = []): string[] {
    for (let index = startIndex; targetId && index < state.ids.length; index++) {
        const id = state.ids[index] as string;
        const placeholder = state.entities[id];
        if (placeholder && placeholder.upload && placeholder.metadata.parents.indexOf(targetId) >= 0) {
            result.push(id);
            if (placeholder.isDirectory) {
                findAllPlaceholderDescendents(state, id, index + 1, result);
            }
        }
    }
    return result;
}

export type UploadPlaceholderReducerType = ReturnType<typeof uploadPlaceholderSlice.reducer>;

export const {
    addUploadPlaceholderAction,
    cancelUploadPlaceholderUploadingAction,
    clearSingleMetadata,
    incrementUploadProgressAction,
    incrementUploadTargetProgressAction,
    removeUploadPlaceholderAction,
    setUploadProgressAction
} = uploadPlaceholderSlice.actions;

export default uploadPlaceholderSlice.reducer;