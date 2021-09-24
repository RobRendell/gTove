import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AddRootFilesActionType, FileIndexActionTypes} from './fileIndexReducer';

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
        builder.addCase(FileIndexActionTypes.ADD_ROOT_FILES_ACTION, (state, action: AddRootFilesActionType) => {
            for (let file of action.files) {
                state[file.name] = [file.id]
            }
        });
    }
});

export type FolderStacksReducerType = ReturnType<typeof folderStacksSlice.reducer>;

export const {updateFolderStackAction} = folderStacksSlice.actions;

export default folderStacksSlice.reducer;