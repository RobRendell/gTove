import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {without} from 'lodash';

import {DieShapeEnum} from '../util/dieObjectUtils';

export interface DieDefinitionType {
    poolName?: string;
    shape: DieShapeEnum;
    buttonLabel?: string;
    buttonUseBlank?: boolean;
    labelX?: number;
    labelY?: number;
    faceTexts: string[];
    faceTextSplit?: string;
    textMargin?: number;
    faceToValue?: number[];
}

export interface DiceBagReducerType {
    dieType: {[dieName: string]: DieDefinitionType};
    dieTypeNames: string[];
}

const diceBagInitialState: DiceBagReducerType = {
    dieType: {
        'd4': {
            shape: DieShapeEnum.d4,
            faceTexts: ['2,4,3', '1,3,4', '2,1,4', '1,2,3'],
            faceTextSplit: ','
        },
        'd6': {
            shape: DieShapeEnum.d6,
            faceTexts: ['1', '2', '3', '4', '5', '6'],
        },
        'd8': {
            shape: DieShapeEnum.d8,
            faceTexts: ['1', '2', '3', '4', '5', '6', '7', '8'],
        },
        'd10': {
            shape: DieShapeEnum.d10,
            faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10'],
        },
        'd12': {
            shape: DieShapeEnum.d12,
            faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10', '11', '12'],
        },
        'd20': {
            shape: DieShapeEnum.d20,
            faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10',
                '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
        },
        'd%': {
            poolName: 'd%',
            shape: DieShapeEnum.d10,
            buttonUseBlank: true,
            buttonLabel: '%',
            labelX: 50,
            labelY: 37,
            faceTexts: ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'],
            textMargin: 1.5,
            faceToValue: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
        },
        'd10.0': {
            poolName: 'd%',
            shape: DieShapeEnum.d10,
            faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '0'],
            faceToValue: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
        }
    },
    dieTypeNames: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd%', 'd10.0']
};

const diceBagSlice = createSlice({
    name: 'diceBag',
    initialState: diceBagInitialState,
    reducers: {
        setDieTypeAction: {
            prepare: (name: string, die: DieDefinitionType) => ({payload: {name, die}}),
            reducer: (state, action: PayloadAction<{name: string, die: DieDefinitionType}>) => {
                state.dieType[action.payload.name] = action.payload.die;
                if (state.dieTypeNames.indexOf(action.payload.name) < 0) {
                    state.dieTypeNames.push(action.payload.name);
                }
            }
        },
        renameDieTypeAction: {
            prepare: (oldName: string, newName: string) => ({payload: {oldName, newName}}),
            reducer: (state, action: PayloadAction<{oldName: string, newName: string}>) => {
                state.dieType[action.payload.newName] = state.dieType[action.payload.oldName];
                delete(state.dieType[action.payload.oldName]);
                const index = state.dieTypeNames.indexOf(action.payload.oldName);
                if (index >= 0) {
                    state.dieTypeNames[index] = action.payload.newName;
                }
            }
        },
        removeDieTypeAction: {
            prepare: (name: string) => ({payload: {name}}),
            reducer: (state, action: PayloadAction<{name: string}>) => {
                state.dieTypeNames = without(state.dieTypeNames, action.payload.name);
                delete(state.dieType[action.payload.name]);
            }
        },
        setDieTypeNamesAction: {
            prepare: (names: string[]) => ({payload: {names}}),
            reducer: (state, action: PayloadAction<{names: string[]}>) => {
                state.dieTypeNames = action.payload.names;
            }
        }
    }
});

export const {setDieTypeAction, removeDieTypeAction, setDieTypeNamesAction} = diceBagSlice.actions;

export default diceBagSlice.reducer;