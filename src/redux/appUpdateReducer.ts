import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppUpdateReducerType} from './appUpdateReducerTypes';

const appUpdateSlice = createSlice({
    name: 'appUpdateSlice',
    initialState: {} as AppUpdateReducerType,
    reducers: {
        appUpdateSetErrorAction: (state, action: PayloadAction<any>) => {
            state.error = action.payload;
        },
        appUpdateSetUpdateAvailableAction: (state, action: PayloadAction<boolean>) => {
            state.updatePending = action.payload;
            state.promptUpdate = action.payload;
        },
        appUpdateClearUpdatePromptAction: (state) => {
            state.promptUpdate = false;
        },
        appUpdateForceUpdateAction: (state) => {
            state.forceUpdate = true;
        },
        appUpdateCheckForUpdateAction: (state) => {
            state.lastCheckedForUpdate = Date.now();
        }
    }
});

export const {
    appUpdateSetErrorAction,
    appUpdateSetUpdateAvailableAction,
    appUpdateClearUpdatePromptAction,
    appUpdateForceUpdateAction,
    appUpdateCheckForUpdateAction
} = appUpdateSlice.actions;

export default appUpdateSlice.reducer;