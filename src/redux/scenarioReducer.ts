import * as THREE from 'three';
import {Action, combineReducers, Reducer} from 'redux';

import {objectMapReducer} from './genericReducers';
import {FileIndexActionTypes, UpdateFileActionType} from './fileIndexReducer';
import {MapParameterType, MapType, MiniType, ScenarioType} from '../@types/scenario';
import {ThunkAction} from 'redux-thunk';
import {getScenarioFromStore, ReduxStoreType} from './mainReducer';
import {DriveMetadata} from '../@types/googleDrive';
import {eulerToObject, vector3ToObject} from '../util/threeUtils';

// =========================== Action types and generators

enum ScenarioReducerActionTypes {
    SET_SCENARIO_ACTION = 'set-scenario-action',
    UPDATE_MAP_ACTION = 'update-map-action',
    UPDATE_MINI_ACTION = 'update-mini-action',
    REMOVE_MAP_ACTION = 'remove-map-action',
    REMOVE_MINI_ACTION = 'remove-mini-action',
    UPDATE_SNAP_TO_GRID_ACTION = 'update-snap-to-grid-action',
}

export function setScenarioAction(scenario = {}, peerKey = null) {
    return {type: ScenarioReducerActionTypes.SET_SCENARIO_ACTION, scenario, peerKey};
}

interface UpdateSnapToGridActionType extends Action {
    type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION;
    snapToGrid: boolean;
    peerKey: string;
}

export function updateSnapToGridAction (snapToGrid: boolean): UpdateSnapToGridActionType {
    return {type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION, snapToGrid, peerKey: 'snapToGrid'};
}

interface RemoveMapActionType extends Action {
    type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION;
    mapId: string;
    peerKey?: string;
}

export function removeMapAction(mapId: string): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: RemoveMapActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, mapId});
        dispatch({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, mapId, peerKey});
    };
}

interface UpdateMapActionType extends Action {
    type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION;
    mapId: string;
    map: Partial<MapType>;
    peerKey?: string;
}

export function addMapAction(mapId: string, {metadata, name, position = ORIGIN, rotation = ROTATION_NONE, gmOnly = true, fogOfWar = []}: MapParameterType): UpdateMapActionType {
    const peerKey = gmOnly ? undefined : mapId;
    return {type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map: {metadata, name, position: vector3ToObject(position), rotation: eulerToObject(rotation), gmOnly, fogOfWar}, peerKey};
}

export function updateMapPositionAction(mapId: string, position: THREE.Vector3, snapping: boolean | null = null): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMapActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, mapId, extra: 'position'});
        dispatch({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map: {position: vector3ToObject(position), snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMapRotationAction(mapId: string, rotation: THREE.Euler, snapping: boolean | null = null): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMapActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, mapId, extra: 'rotation'});
        dispatch({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map: {rotation: eulerToObject(rotation), snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMapGMOnlyAction(mapId: string, gmOnly: boolean): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMapActionType | RemoveMapActionType) => void, getState) => {
        const scenario = getScenarioFromStore(getState());
        const map = {...scenario.maps[mapId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the map from peers, then put it back for us
            dispatch({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, mapId, peerKey: mapId});
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map});
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the map
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map, peerKey: mapId});
        }
    };
}

export function updateMapFogOfWarAction(mapId: string, fogOfWar: number[] | null): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMapActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, mapId, extra: 'fogOfWar'});
        dispatch({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map: {fogOfWar}, peerKey});
    };
}

interface RemoveMiniActionType {
    type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION;
    miniId: string;
    peerKey?: string;
}

export function removeMiniAction(miniId: string): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: RemoveMiniActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, miniId});
        dispatch({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, miniId, peerKey});
    };
}

interface UpdateMiniActionType {
    type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION;
    miniId: string;
    mini: Partial<MiniType>;
    peerKey?: string;
}

export function addMiniAction(miniId: string, metadata: DriveMetadata, name: string, position: THREE.Vector3 = ORIGIN,
                              rotation: THREE.Euler = ROTATION_NONE, scale: number = 1.0, elevation: number = 0.0, gmOnly: boolean = true): UpdateMiniActionType {
    const peerKey = gmOnly ? undefined : miniId;
    return {type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini: {metadata, name, position: vector3ToObject(position), rotation: eulerToObject(rotation), scale, elevation, gmOnly}, peerKey};
}

export function updateMiniPositionAction(miniId: string, position: THREE.Vector3, snapping: boolean | null = null): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMiniActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'position'});
        dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini: {position: vector3ToObject(position), snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniRotationAction(miniId: string, rotation: THREE.Euler, snapping: boolean | null = null): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMiniActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'rotation'});
        dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini: {rotation: eulerToObject(rotation), snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniScaleAction(miniId: string, scale: number, snapping: boolean | null = null): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMiniActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'scale'});
        dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini: {scale, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniElevationAction(miniId: string, elevation: number, snapping: boolean | null = null): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMiniActionType) => void, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'elevation'});
        dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini: {elevation, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniGMOnlyAction(miniId: string, gmOnly: boolean): ThunkAction<void, ReduxStoreType, void> {
    return (dispatch: (action: UpdateMiniActionType | RemoveMiniActionType) => void, getState) => {
        const scenario = getScenarioFromStore(getState());
        const mini = {...scenario.minis[miniId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the mini from peers, then put it back for us
            dispatch({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, miniId, peerKey: miniId});
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini});
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the mini
            dispatch({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini, peerKey: miniId});
        }
    };
}

type ScenarioReducerActionType = UpdateSnapToGridActionType | RemoveMapActionType | UpdateMapActionType | RemoveMiniActionType | UpdateMiniActionType;

// =========================== Reducers

const ORIGIN = new THREE.Vector3(0, 0, 0);
const ROTATION_NONE = new THREE.Euler();

const gmReducer: Reducer<string | null> = (state = null) => {
    return state;
};

const snapToGridReducer: Reducer<boolean> = (state = false, action: ScenarioReducerActionType) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION:
            return action.snapToGrid;
        default:
            return state;
    }
};

const remapMetadata = <T extends MapType | MiniType>(state: {[key: string]: T}, action: UpdateFileActionType): {[key: string]: T} => {
    // Have to search for matching metadata in all objects in state.
    return Object.keys(state).reduce((result: {[key: string]: T} | undefined, id) => {
        if (state[id].metadata && state[id].metadata.id === action.metadata.id) {
            result = result || {...state};
            result[id] = Object.assign({}, result[id], {metadata: {...result[id].metadata, ...action.metadata}});
        }
        return result;
    }, undefined) || state;
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
            return remapMetadata(state, action as UpdateFileActionType);
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
            return remapMetadata(state, action as UpdateFileActionType);
        default:
            return allMinisReducer(state, action);
    }
};

const scenarioReducer = combineReducers<ScenarioType>({
    gm: gmReducer,
    snapToGrid: snapToGridReducer,
    maps: allMapsFileUpdateReducer,
    minis: allMinisFileUpdateReducer
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

// ============ Utility ============

interface GetPeerKeyParams {
    getState: () => ReduxStoreType;
    mapId?: string | null;
    miniId?: string | null;
    extra?: string;
}

function getPeerKey({getState, mapId = null, miniId = null, extra = ''}: GetPeerKeyParams): string | undefined {
    const scenario = getScenarioFromStore(getState());
    if (mapId) {
        return scenario.maps[mapId].gmOnly ? undefined : mapId + extra;
    } else if (miniId) {
        return scenario.minis[miniId].gmOnly ? undefined : miniId + extra;
    } else {
        return undefined;
    }
}

function getSnapping(getState: () => ReduxStoreType, snapping: boolean | null) {
    return (snapping === null) ? getScenarioFromStore(getState()).snapToGrid : snapping;
}

