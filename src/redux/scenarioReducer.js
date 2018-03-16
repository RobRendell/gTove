import * as THREE from 'three';
import {combineReducers} from 'redux';

import {objectMapReducer} from './genericReducers';

export const SET_SCENARIO_ACTION = 'set_scenario_action';
const UPDATE_MAP_ACTION = 'update_map_action';
const UPDATE_MINI_ACTION = 'update_mini_action';

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

const allMapsReducer = objectMapReducer('mapId', singleMapReducer);

function singleMiniReducer(state = {}, action) {
    switch (action.type) {
        case UPDATE_MINI_ACTION:
            return {...state, ...action.mini};
        default:
            return state;
    }
}

const allMinisReducer = objectMapReducer('miniId', singleMiniReducer);

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

// ============ Action creators ============

export function setScenarioAction(scenario = {}) {
    return {type: SET_SCENARIO_ACTION, scenario, peerKey: true};
}

export function addMapAction(mapId, metadata, position = ORIGIN, rotation = ROTATION_NONE) {
    return {type: UPDATE_MAP_ACTION, mapId, map: {metadata, position: {...position}, rotation: {...rotation}}, peerKey: mapId};
}

export function updateMapPositionAction(mapId, position) {
    return {type: UPDATE_MAP_ACTION, mapId, map: {position: {...position}}, peerKey: mapId};
}

export function updateMapRotationAction(mapId, rotation) {
    return {type: UPDATE_MAP_ACTION, mapId, map: {rotation: {...rotation}}, peerKey: mapId};
}

export function addMiniAction(miniId, metadata, position = ORIGIN, rotation = ROTATION_NONE) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {metadata, position: {...position}, rotation: {...rotation}, elevation: 0}, peerKey: miniId};
}

export function updateMiniPositionAction(miniId, position) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {position: {...position}}, peerKey: miniId};
}

export function updateMiniRotationAction(miniId, rotation) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {rotation: {...rotation}}, peerKey: miniId};
}

export function updateMiniElevationAction(miniId, elevation) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {elevation}, peerKey: miniId};
}

// ============ Getters ============

export function getScenarioFromStore(store) {
    return store.scenario;
}
