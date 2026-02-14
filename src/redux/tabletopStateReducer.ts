import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {PaintToolEnum} from '../presentation/paintTools';
import {PaintState, TabletopStateReducerType} from './tabletopStateReducerTypes';

const initialState: TabletopStateReducerType = {
    paintState: {
        open: false,
        selected: PaintToolEnum.NONE,
        brushColour: '#000000',
        brushSize: 0.2
    }
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
        }
    }
});

export const {
    setTabletopStatePaintOpenAction,
    updateTabletopPaintStateAction,
} = tabletopStateSlice.actions;

export default tabletopStateSlice.reducer;