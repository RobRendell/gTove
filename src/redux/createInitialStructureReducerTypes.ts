import {Action} from 'redux';

export enum CreateInitialStructureActionTypes {
    SET_CREATE_INITIAL_STRUCTURE = 'set-create-initial-structure'
}

export type CreateInitialStructureReducerType = boolean | null;

export interface SetCreateInitialStructureActionType extends Action {
    type: CreateInitialStructureActionTypes.SET_CREATE_INITIAL_STRUCTURE;
    create: CreateInitialStructureReducerType;
}