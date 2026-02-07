import {AnyAction, Reducer} from 'redux';

import {
    CreateInitialStructureActionTypes,
    CreateInitialStructureReducerType,
    SetCreateInitialStructureActionType
} from './createInitialStructureReducerTypes';

// =========================== Action generators

export function setCreateInitialStructureAction(create: CreateInitialStructureReducerType): SetCreateInitialStructureActionType {
    return {type: CreateInitialStructureActionTypes.SET_CREATE_INITIAL_STRUCTURE, create};
}

// =========================== Reducers

const createInitialStructureReducer: Reducer<CreateInitialStructureReducerType> = (state = null, action: SetCreateInitialStructureActionType | AnyAction) => {
    switch (action.type) {
        case CreateInitialStructureActionTypes.SET_CREATE_INITIAL_STRUCTURE:
            return action.create;
        default:
            return state;
    }
};

export default createInitialStructureReducer;
