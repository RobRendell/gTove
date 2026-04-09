import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {v4} from 'uuid';

import {PaintToolEnum} from '../presentation/paintTools';
import {DragModeType, GToveMode, PaintState, ScenarioReplaceState, TabletopStateReducerType} from './tabletopStateReducerTypes';

const initialState: TabletopStateReducerType = {
    currentPage: GToveMode.TABLETOP_SCREEN,
    hasUnsavedChanges: false,
    fullScreen: false,
    selectedNoteMiniId: null,
    editingNote: false,
    playerView: false,
    sideMenuOpen: true,
    adjustingMiniScale: false,
    topDown: false,
    isLookingDown: true,
    deviceLayoutOpen: false,
    diceBagOpen: false,
    showPiecesRoster: false,
    paintState: {
        open: false,
        selected: PaintToolEnum.NONE,
        brushColour: '#000000',
        brushSize: 0.2
    },
}

const tabletopStateSlice = createSlice({
    name: 'tabletopStateSlice',
    initialState,
    reducers: {
        setTabletopStateCurrentPageAction: (state, action: PayloadAction<GToveMode>) => {
            state.currentPage = action.payload;
        },
        setTabletopStateHasUnsavedChangesAction: (state, action: PayloadAction<boolean>) => {
            state.hasUnsavedChanges = action.payload;
        },
        setTabletopStateFullScreenAction: (state, action: PayloadAction<boolean>) => {
            state.fullScreen = action.payload;
        },
        setTabletopStateScenarioReplaceStateAction: (state, action: PayloadAction<undefined | ScenarioReplaceState>) => {
            state.scenarioReplace = action.payload;
        },
        setTabletopStateSelectedNoteMiniIdAction: (state, action: PayloadAction<string | null>) => {
            state.selectedNoteMiniId = action.payload;
        },
        setTabletopStateEditingNoteAction: (state, action: PayloadAction<boolean>) => {
            state.editingNote = action.payload;
        },
        toggleTabletopStateDragModeAction: (state, action: PayloadAction<DragModeType | undefined>) => {
            state.dragMode = (state.dragMode === action.payload) ? undefined : action.payload;
        },
        clearTabletopStateDragModeAction: (state, action: PayloadAction<DragModeType | undefined>) => {
            if (state.dragMode === action.payload) {
                state.dragMode = undefined;
            }
        },
        toggleTabletopStatePlayerViewAction: (state) => {
            state.playerView = !state.playerView;
        },
        setTabletopStateSideMenuOpenAction: (state, action: PayloadAction<boolean>) => {
            state.sideMenuOpen = action.payload;
        },
        startTabletopStateUndoGroupIdAction: {
            prepare: (undoGroupId = v4()) => ({payload: undoGroupId}),
            reducer: (state, action: PayloadAction<string>) => {
                if (!state.undoGroupId) {
                    state.undoGroupId = action.payload;
                }
            }
        },
        clearTabletopStateUndoGroupIdAction: (state) => {
            state.undoGroupId = undefined;
        },
        setTabletopStateAdjustingMiniScaleAction: (state, action: PayloadAction<boolean>) => {
            state.adjustingMiniScale = action.payload;
        },
        setTabletopStateFocusMapIdAction: (state, action: PayloadAction<string | undefined>) => {
            state.focusMapId = action.payload;
        },
        setTabletopStateTopDownAction: (state, action: PayloadAction<boolean>) => {
            state.topDown = action.payload;
        },
        setTabletopStateIsLookingDownAction: (state, action: PayloadAction<boolean>) => {
            state.isLookingDown = action.payload;
        },
        setTabletopStateDeviceLayoutOpenAction: (state, action: PayloadAction<boolean>) => {
            state.deviceLayoutOpen = action.payload;
        },
        setTabletopStateDiceBagOpenAction: (state, action: PayloadAction<boolean>) => {
            state.diceBagOpen = action.payload;
        },
        setTabletopStateShowPiecesRosterAction: (state, action: PayloadAction<boolean>) => {
            state.showPiecesRoster = action.payload;
        },
        setTabletopStatePaintOpenAction: {
            prepare: (open?: boolean) => ({payload: open}),
            reducer: (state, action: PayloadAction<boolean | undefined>) => {
                if (action.payload === undefined) {
                    state.paintState.open = !state.paintState.open;
                } else {
                    state.paintState.open = action.payload;
                }
            }
        },
        updateTabletopPaintStateAction: (state, action: PayloadAction<Partial<PaintState>>) => {
            state.paintState = {...state.paintState, ...action.payload};
        },
    }
});

export const {
    clearTabletopStateDragModeAction,
    clearTabletopStateUndoGroupIdAction,
    setTabletopStateAdjustingMiniScaleAction,
    setTabletopStateCurrentPageAction,
    setTabletopStateDeviceLayoutOpenAction,
    setTabletopStateDiceBagOpenAction,
    setTabletopStateEditingNoteAction,
    setTabletopStateFocusMapIdAction,
    setTabletopStateFullScreenAction,
    setTabletopStateHasUnsavedChangesAction,
    setTabletopStateIsLookingDownAction,
    setTabletopStatePaintOpenAction,
    setTabletopStateScenarioReplaceStateAction,
    setTabletopStateSelectedNoteMiniIdAction,
    setTabletopStateShowPiecesRosterAction,
    setTabletopStateSideMenuOpenAction,
    setTabletopStateTopDownAction,
    startTabletopStateUndoGroupIdAction,
    toggleTabletopStateDragModeAction,
    toggleTabletopStatePlayerViewAction,
    updateTabletopPaintStateAction,
} = tabletopStateSlice.actions;

export default tabletopStateSlice.reducer;