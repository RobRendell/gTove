import * as THREE from 'three';
import {combineReducers} from 'redux';

import {objectMapReducer} from './genericReducers';
import {UPDATE_FILE_ACTION} from './fileIndexReducer';

export const SET_SCENARIO_ACTION = 'set-scenario-action';
const UPDATE_MAP_ACTION = 'update-map-action';
const UPDATE_MINI_ACTION = 'update-mini-action';
const REMOVE_MAP_ACTION = 'remove-map-action';
const REMOVE_MINI_ACTION = 'remove-mini-action';
const UPDATE_SNAP_TO_GRID_ACTION = 'update-snap-to-grid-action';

const ORIGIN = new THREE.Vector3(0, 0, 0);
const ROTATION_NONE = new THREE.Euler();

function gmReducer(state = null) {
    return state;
}

function snapToGridReducer(state = false, action) {
    switch (action.type) {
        case UPDATE_SNAP_TO_GRID_ACTION:
            return action.snapToGrid;
        default:
            return state;
    }
}

function remapMetadata(state, action) {
    // Have to search for matching metadata in all objects in state.
    return Object.keys(state).reduce((result, id) => {
        if (state[id].metadata && state[id].metadata.id === action.metadata.id) {
            result = result || {...state};
            result[id] = {...result[id], metadata: {...result[id].metadata, ...action.metadata}};
        }
        return result;
    }, undefined) || state;
}

function singleMapReducer(state = {}, action) {
    switch (action.type) {
        case UPDATE_MAP_ACTION:
            return {...state, ...action.map};
        default:
            return state;
    }
}

const allMapsReducer = objectMapReducer('mapId', singleMapReducer, {deleteActionType: REMOVE_MAP_ACTION});

function allMapsFileUpdateReducer(state = {}, action) {
    switch (action.type) {
        case UPDATE_FILE_ACTION:
            return remapMetadata(state, action);
        default:
            return allMapsReducer(state, action);
    }
}

function singleMiniReducer(state = {}, action) {
    switch (action.type) {
        case UPDATE_MINI_ACTION:
            return {...state, ...action.mini};
        default:
            return state;
    }
}

const allMinisReducer = objectMapReducer('miniId', singleMiniReducer, {deleteActionType: REMOVE_MINI_ACTION});

function allMinisFileUpdateReducer(state = {}, action) {
    switch (action.type) {
        case UPDATE_FILE_ACTION:
            return remapMetadata(state, action);
        default:
            return allMinisReducer(state, action);
    }
}

const scenarioReducer = combineReducers({
    gm: gmReducer,
    snapToGrid: snapToGridReducer,
    maps: allMapsFileUpdateReducer,
    minis: allMinisFileUpdateReducer
});

function settableScenarioReducer(state = {}, action) {
    switch (action.type) {
        case SET_SCENARIO_ACTION:
            return scenarioReducer(action.scenario, action);
        default:
            return scenarioReducer(state, action);
    }
}

export default settableScenarioReducer;

// ============ Utility ============

function getPeerKey({getState, mapId = null, miniId = null, extra = ''}) {
    const scenario = getScenarioFromStore(getState());
    if (mapId) {
        return scenario.maps[mapId].gmOnly ? null : mapId + extra;
    } else if (miniId) {
        return scenario.minis[miniId].gmOnly ? null : miniId + extra;
    }
}

function getSnapping(getState, snapping) {
    return (snapping === null) ? getScenarioFromStore(getState()).snapToGrid : snapping;
}

// ============ Action creators ============

export function setScenarioAction(scenario = {}, peerKey = null) {
    return {type: SET_SCENARIO_ACTION, scenario, peerKey};
}

export function updateSnapToGridAction(snapToGrid) {
    return {type: UPDATE_SNAP_TO_GRID_ACTION, snapToGrid, peerKey: 'snapToGrid'};
}

export function addMapAction(mapId, {metadata, name, position = ORIGIN, rotation = ROTATION_NONE, gmOnly = true, fogOfWar = []}) {
    const peerKey = gmOnly ? null : mapId;
    return {type: UPDATE_MAP_ACTION, mapId, map: {metadata, name, position: {...position}, rotation: {...rotation}, gmOnly, fogOfWar}, peerKey};
}

export function removeMapAction(mapId) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, mapId});
        dispatch({type: REMOVE_MAP_ACTION, mapId, peerKey});
    };
}

export function updateMapPositionAction(mapId, position, snapping = null) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, mapId, extra: 'position'});
        dispatch({type: UPDATE_MAP_ACTION, mapId, map: {position: {...position}, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMapRotationAction(mapId, rotation, snapping = null) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, mapId, extra: 'rotation'});
        dispatch({type: UPDATE_MAP_ACTION, mapId, map: {rotation: {...rotation}, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMapGMOnlyAction(mapId, gmOnly) {
    return (dispatch, getState) => {
        const scenario = getScenarioFromStore(getState());
        const map = {...scenario.maps[mapId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the map from peers, then put it back for us
            dispatch({type: REMOVE_MAP_ACTION, mapId, peerKey: mapId});
            dispatch({type: UPDATE_MAP_ACTION, mapId, map});
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the map
            dispatch({type: UPDATE_MAP_ACTION, mapId, map, peerKey: mapId});
        }
    };
}

export function updateMapFogOfWarAction(mapId, fogOfWar) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, mapId, extra: 'fogOfWar'});
        dispatch({type: UPDATE_MAP_ACTION, mapId, map: {fogOfWar}, peerKey});
    };
}

export function addMiniAction(miniId, metadata, name, position = ORIGIN, rotation = ROTATION_NONE, scale = 1.0, elevation = 0.0, gmOnly = true) {
    const peerKey = gmOnly ? null : miniId;
    return {type: UPDATE_MINI_ACTION, miniId, mini: {metadata, name, position: {...position}, rotation: {...rotation}, scale, elevation, gmOnly}, peerKey};
}

export function removeMiniAction(miniId) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId});
        dispatch({type: REMOVE_MINI_ACTION, miniId, peerKey});
    };
}

export function updateMiniPositionAction(miniId, position, snapping = null) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'position'});
        dispatch({type: UPDATE_MINI_ACTION, miniId, mini: {position: {...position}, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniRotationAction(miniId, rotation, snapping = null) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'rotation'});
        dispatch({type: UPDATE_MINI_ACTION, miniId, mini: {rotation: {...rotation}, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniScaleAction(miniId, scale, snapping = null) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'scale'});
        dispatch({type: UPDATE_MINI_ACTION, miniId, mini: {scale, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniElevationAction(miniId, elevation, snapping = null) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId, extra: 'elevation'});
        dispatch({type: UPDATE_MINI_ACTION, miniId, mini: {elevation, snapping: getSnapping(getState, snapping)}, peerKey});
    };
}

export function updateMiniGMOnlyAction(miniId, gmOnly) {
    return (dispatch, getState) => {
        const scenario = getScenarioFromStore(getState());
        const mini = {...scenario.minis[miniId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the mini from peers, then put it back for us
            dispatch({type: REMOVE_MINI_ACTION, miniId, peerKey: miniId});
            dispatch({type: UPDATE_MINI_ACTION, miniId, mini});
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the mini
            dispatch({type: UPDATE_MINI_ACTION, miniId, mini, peerKey: miniId});
        }
    };
}

// ============ Getters ============

export function getScenarioFromStore(store) {
    return store.scenario;
}
