import {Omit} from 'react-redux';
import {Action} from 'redux';
import * as THREE from 'three';

import {MapType, MiniType, ObjectEuler, ObjectVector3, ScenarioType} from '../util/scenarioUtils';
import {FileMetadata, MapProperties, MiniProperties} from '../util/storage/storageContract';
import {ScenarioAction} from '../util/types';
import {ReduxStoreType} from './mainReducerTypes';

export enum ScenarioReducerActionTypes {
    SET_SCENARIO_ACTION = 'set-scenario-action',
    APPEND_SCENARIO_ACTION = 'append-scenario-action',
    SET_SCENARIO_LOCAL_ACTION = 'set-scenario-local-action',
    UPDATE_MAP_ACTION = 'update-map-action',
    UPDATE_MINI_ACTION = 'update-mini-action',
    ADJUST_MINIS_ON_MAP_ACTION = 'adjust-minis-on-map-action',
    REMOVE_MAP_ACTION = 'remove-map-action',
    REMOVE_MINI_ACTION = 'remove-mini-action',
    UPDATE_SNAP_TO_GRID_ACTION = 'update-snap-to-grid-action',
    REPLACE_METADATA_ACTION = 'replace-metadata-action',
    REPLACE_MAP_IMAGE_ACTION = 'replace-map-image-action',
    UPDATE_CONFIRM_MOVES_ACTION = 'update-confirm-moves-action',
    UPDATE_HEAD_ACTION_ID = 'update-head-action-id',
    CLEAR_UPDATE_SIDE_EFFECT = 'clear-update-side-effect'
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface SetScenarioAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.SET_SCENARIO_ACTION;
    scenario: Partial<ScenarioType>
}

export interface AppendScenarioAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.APPEND_SCENARIO_ACTION;
    scenario: Partial<ScenarioType>
}

export interface SetScenarioLocalAction {
    type: ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION;
    scenario: ScenarioType
}

export interface UpdateSnapToGridActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION;
    snapToGrid: boolean;
}

export interface UpdateConfirmMovesActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION;
    confirmMoves: boolean;
}

export interface RemoveMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION;
    mapId: string;
}

export interface UpdateMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION;
    mapId: string;
    map: Partial<MapType>;
}

export interface RemoveMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION;
    miniId: string;
    positionObj?: ObjectVector3;
    rotationObj?: ObjectEuler;
    elevation?: number;
}

export interface UpdateMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION;
    miniId: string;
    mini: Partial<MiniType>;
}

export interface UpdateMinisOnMapActionType {
    type: ScenarioReducerActionTypes.ADJUST_MINIS_ON_MAP_ACTION;
    mapId: string;
    gmOnly: boolean;
    oldCentre: ObjectVector3;
    newCentre: ObjectVector3;
    deltaPosition?: THREE.Vector3;
    deltaRotation?: number;
}

export interface ReplaceMetadataAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.REPLACE_METADATA_ACTION;
    oldMetadataId: string;
    newMetadata: FileMetadata<void, MiniProperties | MapProperties>;
}

export interface ReplaceMapImageAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.REPLACE_MAP_IMAGE_ACTION;
    mapId: string;
    newMetadata: FileMetadata<void, MapProperties>;
}

export interface UpdateHeadActionIdAction extends Action {
    type: ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_ID;
    actionId: string;
    gmOnly: boolean;
}

export interface ClearUpdateSideEffectAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.CLEAR_UPDATE_SIDE_EFFECT;
}

export type ScenarioReducerActionType = UpdateSnapToGridActionType | UpdateConfirmMovesActionType | RemoveMapActionType
    | UpdateMapActionType | RemoveMiniActionType | UpdateMiniActionType | ClearUpdateSideEffectAction;

export interface GetGmOnlyParams {
    getState: () => ReduxStoreType;
    mapId?: string | null;
    miniId?: string | null;
}

export interface UndoRedoAction extends ScenarioAction {
}

export interface SeparateUndoGroupActionType extends Action {
}