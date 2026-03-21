import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {v4} from 'uuid';

import {PaintToolEnum} from '../presentation/paintTools';
import {DragModeType, PaintState, TabletopStateReducerType} from './tabletopStateReducerTypes';

const initialState: TabletopStateReducerType = {
    paintState: {
        open: false,
        selected: PaintToolEnum.NONE,
        brushColour: '#000000',
        brushSize: 0.2
    },
    selectedNoteMiniId: null,
    editingNote: false,
    playerView: false,
    adjustingMiniScale: false,
}

const tabletopStateSlice = createSlice({
    name: 'tabletopStateSlice',
    initialState,
    reducers: {
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
        setTabletopStateUndoGroupIdAction: (state, action: PayloadAction<string | undefined>) => {
            state.undoGroupId = action.payload;
        },
        setTabletopStateAdjustingMiniScaleAction: (state, action: PayloadAction<boolean>) => {
            state.adjustingMiniScale = action.payload;
        }
    }
});

export const {
    clearTabletopStateDragModeAction,
    clearTabletopStateUndoGroupIdAction,
    setTabletopStateAdjustingMiniScaleAction,
    setTabletopStateEditingNoteAction,
    setTabletopStatePaintOpenAction,
    setTabletopStateSelectedNoteMiniIdAction,
    setTabletopStateUndoGroupIdAction,
    startTabletopStateUndoGroupIdAction,
    toggleTabletopStateDragModeAction,
    toggleTabletopStatePlayerViewAction,
    updateTabletopPaintStateAction,
} = tabletopStateSlice.actions;

export default tabletopStateSlice.reducer;