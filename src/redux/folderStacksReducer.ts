import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AddRootFilesActionType, FileIndexActionTypes, ReplaceFileAction} from './fileIndexReducer';

const folderStacksSlice = createSlice({
    name: 'folderStacks',
    initialState: {} as {[root: string]: string[]},
    reducers: {
        updateFolderStackAction: {
            prepare: (root: string, stack: string[]) => ({payload: {root, stack}}),
            reducer: (state, action: PayloadAction<{root: string, stack: string[]}>) => ({
                ...state,
                [action.payload.root]: action.payload.stack
            })
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(FileIndexActionTypes.ADD_ROOT_FILES_ACTION, (state, action: AddRootFilesActionType) => {
                for (let file of action.files) {
                    state[file.name] = [file.id]
                }
            })
            .addCase(FileIndexActionTypes.REPLACE_FILE_ACTION, (state, action: ReplaceFileAction) => {
                const fromId = action.metadata.id;
                const toId = action.newMetadata.id;
                const idIndex = state[action.rootFolder].findIndex((id) => (id === fromId));
                if (idIndex !== -1) {
                    state[action.rootFolder][idIndex] = toId;
                }
            })
    }
});

export type FolderStacksReducerType = ReturnType<typeof folderStacksSlice.reducer>;

export const {updateFolderStackAction} = folderStacksSlice.actions;

export default folderStacksSlice.reducer;