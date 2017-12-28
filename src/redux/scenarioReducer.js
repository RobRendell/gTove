import * as THREE from 'three';
import {combineReducers} from 'redux';

import {objectMapReducer} from './genericReducers';

const RESET_SCENARIO_ACTION = 'reset_scenario_action';
const ADD_MAP_ACTION = 'add_map_action';
const ADD_MINI_ACTION = 'add_mini_action';
const UPDATE_MAP_POSITION = 'update_map_position';
const UPDATE_MAP_ROTATION = 'update_map_rotation';
const UPDATE_MINI_POSITION = 'update_mini_position';
const UPDATE_MINI_ROTATION = 'update_mini_rotation';
const UPDATE_MINI_ELEVATION = 'update_mini_elevation';

const ORIGIN = new THREE.Vector3(0, 0, 0);
const ROTATION_NONE = new THREE.Euler();

function singleMapReducer(state = {}, action) {
    switch (action.type) {
        case ADD_MAP_ACTION:
            return {...state, ...action.map};
        case UPDATE_MAP_POSITION:
            return {...state, position: action.position};
        case UPDATE_MAP_ROTATION:
            return {...state, rotation: action.rotation};
        default:
            return state;
    }
}

const allMapsReducer = objectMapReducer('mapId', singleMapReducer);

function singleMiniReducer(state = {}, action) {
    switch (action.type) {
        case ADD_MINI_ACTION:
            return {...state, ...action.mini};
        case UPDATE_MINI_POSITION:
            return {...state, position: action.position};
        case UPDATE_MINI_ROTATION:
            return {...state, rotation: action.rotation};
        case UPDATE_MINI_ELEVATION:
            return {...state, elevation: action.elevation};
        default:
            return state;
    }
}

const allMinisReducer = objectMapReducer('miniId', singleMiniReducer);

const scenarioReducer = combineReducers({
    maps: allMapsReducer,
    minis: allMinisReducer
});

function resettableScenarioReducer(state = {}, action) {
    switch (action.type) {
        case RESET_SCENARIO_ACTION:
            return scenarioReducer(undefined, action);
        default:
            return scenarioReducer(state, action);
    }
}

export default resettableScenarioReducer;

export function resetScenarioAction() {
    return {type: RESET_SCENARIO_ACTION};
}

export function addMapAction(mapId, metadata, position = ORIGIN, rotation = ROTATION_NONE) {
    return {type: ADD_MAP_ACTION, mapId, map: {metadata, position, rotation}};
}

export function addMiniAction(miniId, metadata, position = ORIGIN, rotation = ROTATION_NONE) {
    return {type: ADD_MINI_ACTION, miniId, mini: {metadata, position, rotation, elevation: 0}};
}

export function updateMapPositionAction(mapId, position) {
    return {type: UPDATE_MAP_POSITION, mapId, position};
}

export function updateMapRotationAction(mapId, rotation) {
    return {type: UPDATE_MAP_ROTATION, mapId, rotation};
}

export function updateMiniPositionAction(miniId, position) {
    return {type: UPDATE_MINI_POSITION, miniId, position};
}

export function updateMiniRotationAction(miniId, rotation) {
    return {type: UPDATE_MINI_ROTATION, miniId, rotation};
}

export function updateMiniElevationAction(miniId, elevation) {
    return {type: UPDATE_MINI_ELEVATION, miniId, elevation};
}

export function getScenarioFromStore(store) {
    return store.scenario;
}
