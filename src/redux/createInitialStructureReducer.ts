import {Action, AnyAction, Reducer} from 'redux';

// =========================== Action types and generators

enum CreateInitialStructureActionTypes {
    SET_CREATE_INITIAL_STRUCTURE = 'set-create-initial-structure'
}

export type CreateInitialStructureReducerType = boolean | null;

interface SetCreateInitialStructureActionType extends Action {
    type: CreateInitialStructureActionTypes.SET_CREATE_INITIAL_STRUCTURE;
    create: CreateInitialStructureReducerType;
}

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
