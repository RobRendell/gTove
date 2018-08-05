import * as THREE from 'three';
import {Action, combineReducers, Reducer} from 'redux';
import {ThunkAction} from 'redux-thunk';
import {v4} from 'uuid';

import {objectMapReducer} from './genericReducers';
import {FileIndexActionTypes, RemoveFilesActionType, UpdateFileActionType} from './fileIndexReducer';
import {MapType, MiniType, ObjectEuler, ObjectVector3, ScenarioType} from '../util/scenarioUtils';
import {getScenarioFromStore, ReduxStoreType} from './mainReducer';
import {eulerToObject, vector3ToObject} from '../util/threeUtils';
import {DriveMetadata} from '../util/googleDriveUtils';

// =========================== Action types and generators

export enum ScenarioReducerActionTypes {
    SET_SCENARIO_ACTION = 'set-scenario-action',
    UPDATE_MAP_ACTION = 'update-map-action',
    UPDATE_MINI_ACTION = 'update-mini-action',
    REMOVE_MAP_ACTION = 'remove-map-action',
    REMOVE_MINI_ACTION = 'remove-mini-action',
    UPDATE_SNAP_TO_GRID_ACTION = 'update-snap-to-grid-action',
    REPLACE_METADATA_ACTION = 'replace-metadata-action',
    UPDATE_CONFIRM_MOVES_ACTION = 'update-confirm-moves-action'
}

interface ScenarioAction extends Action {
    actionId: string;
    peerKey?: string;
    gmOnly: boolean;
}

interface SetScenarioAction extends ScenarioAction {
    scenario: Partial<ScenarioType>
}

export function setScenarioAction(scenario: Partial<ScenarioType> = {}, peerKey?: string): SetScenarioAction {
    return {type: ScenarioReducerActionTypes.SET_SCENARIO_ACTION, actionId: scenario.lastActionId || v4(), scenario, peerKey, gmOnly: false};
}

interface UpdateSnapToGridActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION;
    snapToGrid: boolean;
}

export function updateSnapToGridAction(snapToGrid: boolean): UpdateSnapToGridActionType {
    return {type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION, actionId: v4(), snapToGrid, peerKey: 'snapToGrid', gmOnly: false};
}

interface UpdateConfirmMovesActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION;
    confirmMoves: boolean;
}

export function updateConfirmMovesAction(confirmMoves: boolean): UpdateConfirmMovesActionType {
    return {type: ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION, actionId: v4(), confirmMoves, peerKey: 'confirmMoves', gmOnly: false};
}

interface RemoveMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION;
    mapId: string;
}

export function removeMapAction(mapId: string): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: RemoveMapActionType) => void, getState) => {
        dispatch({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, actionId: v4(), mapId, peerKey: mapId, gmOnly: getGmOnly({getState, mapId})} as RemoveMapActionType);
    };
}

interface UpdateMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION;
    mapId: string;
    map: Partial<MapType>;
}

export function addMapAction(mapParameter: Partial<MapType>): UpdateMapActionType {
    const mapId = v4();
    const map = {position: ORIGIN, rotation: ROTATION_NONE, gmOnly: true, fogOfWar: [], ...mapParameter};
    return {type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, actionId: v4(), mapId, map, peerKey: mapId, gmOnly: map.gmOnly};
}

function updateMapAction(mapId: string, map: Partial<MapType>, selectedBy: string | null, extra: string = ''): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMapActionType) => void, getState) => {
        dispatch({
            type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION,
            actionId: v4(),
            mapId,
            map: {...map, selectedBy},
            peerKey: mapId + extra,
            gmOnly: getGmOnly({getState, mapId})
        });
    };
}

export function updateMapPositionAction(mapId: string, position: THREE.Vector3 | ObjectVector3, selectedBy: string | null): ThunkAction<void, ReduxStoreType, void> {
    return updateMapAction(mapId, {position: vector3ToObject(position)}, selectedBy, 'position');
}

export function updateMapRotationAction(mapId: string, rotation: THREE.Euler | ObjectEuler, selectedBy: string | null): ThunkAction<void, ReduxStoreType, void> {
    return updateMapAction(mapId, {rotation: eulerToObject(rotation)}, selectedBy, 'rotation');
}

export function updateMapFogOfWarAction(mapId: string, fogOfWar?: number[]): ThunkAction<void, ReduxStoreType, void> {
    return updateMapAction(mapId, {fogOfWar}, null, 'fogOfWar');
}

export function updateMapGMOnlyAction(mapId: string, gmOnly: boolean): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMapActionType | RemoveMapActionType) => void, getState) => {
        const scenario = getScenarioFromStore(getState());
        const map = {...scenario.maps[mapId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the map from peers, then put it back for GMs
            dispatch({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, actionId: v4(), mapId, peerKey: mapId, gmOnly: false});
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, actionId: v4(), mapId, peerKey: mapId, map, gmOnly: true});
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the map
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, actionId: v4(), mapId, map, peerKey: mapId, gmOnly: false});
        }
    };
}

export function updateMapMetadataLocalAction(mapId: string, metadata: DriveMetadata) {
    return {type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map: {metadata}};
}

interface RemoveMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION;
    miniId: string;
}

export function removeMiniAction(miniId: string): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: RemoveMiniActionType) => void, getState) => {
        dispatch({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, actionId: v4(), miniId, peerKey: miniId, gmOnly: getGmOnly({getState, miniId})} as RemoveMiniActionType);
    };
}

interface UpdateMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION;
    miniId: string;
    mini: Partial<MiniType>;
}

export function addMiniAction(miniParameter: Partial<MiniType>): UpdateMiniActionType {
    const miniId: string = v4();
    const mini = {position: ORIGIN, rotation: ROTATION_NONE, scale: 1.0, elevation: 0.0, gmOnly: true, prone: false, flat: false, ...miniParameter};
    return {type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, actionId: v4(), miniId, mini, peerKey: miniId, gmOnly: mini.gmOnly};
}

function updateMiniAction(miniId: string, mini: Partial<MiniType> | ((state: ReduxStoreType) => Partial<MiniType>), selectedBy: string | null, extra: string = ''): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMiniActionType) => void, getState) => {
        if (typeof(mini) === 'function') {
            mini = mini(getState());
        }
        dispatch({
            type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION,
            actionId: v4(),
            miniId,
            mini: {...mini, selectedBy},
            peerKey: miniId + extra,
            gmOnly: getGmOnly({getState, miniId})
        });
    };
}

export function updateMiniNameAction(miniId: string, name: string): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, {name}, null, 'name');
}

export function updateMiniPositionAction(miniId: string, position: THREE.Vector3 | ObjectVector3, selectedBy: string | null): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, {position: vector3ToObject(position)}, selectedBy, 'position');
}

export function updateMiniRotationAction(miniId: string, rotation: THREE.Euler | ObjectEuler, selectedBy: string | null): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, {rotation: eulerToObject(rotation)}, selectedBy, 'rotation');
}

export function updateMiniScaleAction(miniId: string, scale: number, selectedBy: string | null): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, {scale}, selectedBy, 'scale');
}

export function updateMiniElevationAction(miniId: string, elevation: number, selectedBy: string | null): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, {elevation}, selectedBy, 'elevation');
}

export function updateMiniProneAction(miniId: string, prone: boolean): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, {prone}, null, 'prone');
}

export function updateMiniFlatAction(miniId: string, flat: boolean): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, {flat}, null, 'flat');
}

export function confirmMiniMoveAction(miniId: string): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, (state) => ({movementPath: [getCurrentPositionWaypoint(getScenarioFromStore(state).minis[miniId])]}), null, 'movementPath');
}

export function addMiniWaypointAction(miniId: string): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, (state) => {
        const mini = getScenarioFromStore(state).minis[miniId];
        return (mini.movementPath) ? {movementPath: [...mini.movementPath, getCurrentPositionWaypoint(mini)]} : {}
    }, null, 'movementPath');
}

export function removeMiniWaypointAction(miniId: string): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, (state) => {
        const mini = getScenarioFromStore(state).minis[miniId];
        return (mini.movementPath) ? {movementPath: mini.movementPath.slice(0, mini.movementPath.length - 1)} : {}
    }, null, 'movementPath');
}

export function cancelMiniMoveAction(miniId: string): ThunkAction<void, ReduxStoreType, void> {
    return updateMiniAction(miniId, (state) => {
        const mini = getScenarioFromStore(state).minis[miniId];
        return (mini.movementPath) ? {position: mini.movementPath[0], movementPath: [mini.movementPath[0]]} : {}
    }, null, 'position+movementPath');
}

export function updateMiniGMOnlyAction(miniId: string, gmOnly: boolean): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMiniActionType | RemoveMiniActionType) => void, getState) => {
        const scenario = getScenarioFromStore(getState());
        const mini = {...scenario.minis[miniId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the mini from peers, then put it back for GMs
            dispatch({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, actionId: v4(), miniId, peerKey: miniId, gmOnly: false});
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, actionId: v4(), miniId, peerKey: miniId, mini, gmOnly: true});
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the mini
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, actionId: v4(), miniId, mini, peerKey: miniId, gmOnly: false});
        }
    };
}

export function updateMiniMetadataLocalAction(miniId: string, metadata: DriveMetadata) {
    return {type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini: {metadata}};
}

interface ReplaceMetadataAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.REPLACE_METADATA_ACTION;
    oldMetadataId: string;
    newMetadataId: string;
}

export function replaceMetadataAction(oldMetadataId: string, newMetadataId: string, gmOnly: boolean): ReplaceMetadataAction {
    return {type: ScenarioReducerActionTypes.REPLACE_METADATA_ACTION, oldMetadataId, newMetadataId, actionId: v4(), peerKey: 'replace' + oldMetadataId, gmOnly};
}

export type ScenarioReducerActionType = UpdateSnapToGridActionType | UpdateConfirmMovesActionType | RemoveMapActionType | UpdateMapActionType | RemoveMiniActionType | UpdateMiniActionType;

// =========================== Utility functions

function getCurrentPositionWaypoint(state: MiniType): ObjectVector3 {
    return {...state.position, y: state.position.y + state.elevation};
}

// =========================== Reducers

const ORIGIN = {x: 0, y: 0, z: 0};
const ROTATION_NONE = {x: 0, y: 0, z: 0, order: 'XYZ'};

const snapToGridReducer: Reducer<boolean> = (state = false, action: ScenarioReducerActionType) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION:
            return action.snapToGrid;
        default:
            return state;
    }
};

const confirmMovesReducer: Reducer<boolean> = (state = false, action: UpdateConfirmMovesActionType) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION:
            return action.confirmMoves;
        default:
            return state;
    }
};

const singleMapReducer: Reducer<MapType> = (state, action) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_MAP_ACTION:
            return {...state, ...action.map};
        default:
            return state;
    }
};

const allMapsReducer = objectMapReducer<MapType>('mapId', singleMapReducer, {deleteActionType: ScenarioReducerActionTypes.REMOVE_MAP_ACTION});

const allMapsFileUpdateReducer: Reducer<{[key: string]: MapType}> = (state, action) => {
    switch (action.type) {
        case FileIndexActionTypes.UPDATE_FILE_ACTION:
            const updateFile = action as UpdateFileActionType;
            return updateMetadata(state, updateFile.metadata.id, updateFile.metadata, true);
        case ScenarioReducerActionTypes.REPLACE_METADATA_ACTION:
            const replaceMetadata = action as ReplaceMetadataAction;
            return updateMetadata(state, replaceMetadata.oldMetadataId, {id: replaceMetadata.newMetadataId}, false);
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            return removeObjectsReferringToMetadata(state, action as RemoveFilesActionType);
        default:
            return allMapsReducer(state, action);
    }
};

const singleMiniReducer: Reducer<MiniType> = (state, action) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_MINI_ACTION:
            return {...state, ...action.mini};
        default:
            return state;
    }
};

const allMinisReducer = objectMapReducer<MiniType>('miniId', singleMiniReducer, {deleteActionType: ScenarioReducerActionTypes.REMOVE_MINI_ACTION});

const allMinisFileUpdateReducer: Reducer<{[key: string]: MiniType}> = (state = {}, action) => {
    switch (action.type) {
        case FileIndexActionTypes.UPDATE_FILE_ACTION:
            const updateFile = action as UpdateFileActionType;
            return updateMetadata(state, updateFile.metadata.id, updateFile.metadata, true);
        case ScenarioReducerActionTypes.REPLACE_METADATA_ACTION:
            const replaceMetadata = action as ReplaceMetadataAction;
            return updateMetadata(state, replaceMetadata.oldMetadataId, {id: replaceMetadata.newMetadataId}, false);
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            return removeObjectsReferringToMetadata(state, action as RemoveFilesActionType);
        case ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION:
            return Object.keys(state).reduce((nextState, miniId) => {
                const miniState = state[miniId];
                nextState[miniId] = {...miniState, movementPath: action.confirmMoves ? [getCurrentPositionWaypoint(miniState)] : undefined};
                return nextState;
            }, {});
        default:
            return allMinisReducer(state, action);
    }
};

const lastActionIdReducer: Reducer<string | null> = (state = null, action) => {
    return action.actionId ? action.actionId : state;
};

const scenarioReducer = combineReducers<ScenarioType>({
    snapToGrid: snapToGridReducer,
    confirmMoves: confirmMovesReducer,
    maps: allMapsFileUpdateReducer,
    minis: allMinisFileUpdateReducer,
    lastActionId: lastActionIdReducer
});

const settableScenarioReducer: Reducer<ScenarioType> = (state, action) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.SET_SCENARIO_ACTION:
            return scenarioReducer(action.scenario, action);
        default:
            return scenarioReducer(state, action);
    }
};

export default settableScenarioReducer;

// =========================== Utility

interface GetGmOnlyParams {
    getState: () => ReduxStoreType;
    mapId?: string | null;
    miniId?: string | null;
}

function getGmOnly({getState, mapId = null, miniId = null}: GetGmOnlyParams): boolean {
    const scenario = getScenarioFromStore(getState());
    if (mapId) {
        return scenario.maps[mapId].gmOnly;
    } else if (miniId) {
        return scenario.minis[miniId].gmOnly;
    } else {
        return false;
    }
}

const updateMetadata = <T extends MapType | MiniType>(state: {[key: string]: T}, metadataId: string, metadata: Partial<DriveMetadata>, merge: boolean): {[key: string]: T} => {
    // Have to search for matching metadata in all objects in state.
    return Object.keys(state).reduce((result: {[key: string]: T} | undefined, id) => {
        if (state[id].metadata && state[id].metadata.id === metadataId) {
            result = result || {...state};
            result[id] = Object.assign({}, result[id], {metadata: {...(merge && result[id].metadata), ...metadata}});
        }
        return result;
    }, undefined) || state;
};

const removeObjectsReferringToMetadata = <T extends MapType | MiniType>(state: {[key: string]: T}, action: RemoveFilesActionType): {[key: string]: T} => {
    // Remove any objects that reference the metadata
    return Object.keys(state).reduce((result: {[key: string]: T} | undefined, id) => {
        if (state[id].metadata && state[id].metadata.id === action.file.id) {
            result = result || {...state};
            delete(result[id]);
        }
        return result;
    }, undefined) || state;
};
