import * as THREE from 'three';
import {combineReducers} from 'redux';

import {objectMapReducer} from './genericReducers';

export const SET_SCENARIO_ACTION = 'set-scenario-action';
const UPDATE_MAP_ACTION = 'update-map-action';
const UPDATE_MINI_ACTION = 'update-mini-action';
const REMOVE_MAP_ACTION = 'remove-map-action';
const REMOVE_MINI_ACTION = 'remove-mini-action';

const ORIGIN = new THREE.Vector3(0, 0, 0);
const ROTATION_NONE = new THREE.Euler();

function gmReducer(state = null) {
    return state;
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

function singleMiniReducer(state = {}, action) {
    switch (action.type) {
        case UPDATE_MINI_ACTION:
            return {...state, ...action.mini};
        default:
            return state;
    }
}

const allMinisReducer = objectMapReducer('miniId', singleMiniReducer, {deleteActionType: REMOVE_MINI_ACTION});

const scenarioReducer = combineReducers({
    gm: gmReducer,
    maps: allMapsReducer,
    minis: allMinisReducer
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

function getPeerKey({getState, mapId = null, miniId = null}) {
    const scenario = getScenarioFromStore(getState());
    if (mapId) {
        return scenario.maps[mapId].gmOnly ? null : mapId;
    } else if (miniId) {
        return scenario.minis[miniId].gmOnly ? null : miniId;
    }
}

// ============ Action creators ============

export function setScenarioAction(scenario = {}) {
    return {type: SET_SCENARIO_ACTION, scenario};
}

export function addMapAction(mapId, metadata, name, position = ORIGIN, rotation = ROTATION_NONE, gmOnly = true) {
    const peerKey = gmOnly ? null : mapId;
    return {type: UPDATE_MAP_ACTION, mapId, map: {metadata, name, position: {...position}, rotation: {...rotation}, gmOnly}, peerKey};
}

export function removeMapAction(mapId) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, mapId});
        dispatch({type: REMOVE_MAP_ACTION, mapId, peerKey});
    };
}

export function updateMapPositionAction(mapId, position) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, mapId});
        dispatch({type: UPDATE_MAP_ACTION, mapId, map: {position: {...position}}, peerKey});
    };
}

export function updateMapRotationAction(mapId, rotation) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, mapId});
        dispatch({type: UPDATE_MAP_ACTION, mapId, map: {rotation: {...rotation}}, peerKey});
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

export function addMiniAction(miniId, metadata, name, position = ORIGIN, rotation = ROTATION_NONE, gmOnly = true) {
    const peerKey = gmOnly ? null : miniId;
    return {type: UPDATE_MINI_ACTION, miniId, mini: {metadata, name, position: {...position}, rotation: {...rotation}, elevation: 0, gmOnly}, peerKey};
}

export function removeMiniAction(miniId) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId});
        dispatch({type: REMOVE_MINI_ACTION, miniId, peerKey});
    };
}

export function updateMiniPositionAction(miniId, position) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId});
        dispatch({type: UPDATE_MINI_ACTION, miniId, mini: {position: {...position}}, peerKey});
    };
}

export function updateMiniRotationAction(miniId, rotation) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId});
        dispatch({type: UPDATE_MINI_ACTION, miniId, mini: {rotation: {...rotation}}, peerKey});
    };
}

export function updateMiniElevationAction(miniId, elevation) {
    return (dispatch, getState) => {
        const peerKey = getPeerKey({getState, miniId});
        dispatch({type: UPDATE_MINI_ACTION, miniId, mini: {elevation}, peerKey});
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
