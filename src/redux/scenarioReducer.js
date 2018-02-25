import * as THREE from 'three';
import {combineReducers} from 'redux';

import {objectMapReducer} from './genericReducers';

export const SET_SCENARIO_ACTION = 'set_scenario_action';
const UPDATE_MAP_ACTION = 'update_map_action';
const UPDATE_MINI_ACTION = 'update_mini_action';

const ORIGIN = new THREE.Vector3(0, 0, 0);
const ROTATION_NONE = new THREE.Euler();

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
    return {type: SET_SCENARIO_ACTION, scenario};
}

export function addMapAction(mapId, metadata, position = ORIGIN, rotation = ROTATION_NONE) {
    return {type: UPDATE_MAP_ACTION, mapId, map: {metadata, position, rotation}};
}

export function updateMapPositionAction(mapId, position) {
    return {type: UPDATE_MAP_ACTION, mapId, map: {position}};
}

export function updateMapRotationAction(mapId, rotation) {
    return {type: UPDATE_MAP_ACTION, mapId, map: {rotation}};
}

export function addMiniAction(miniId, metadata, position = ORIGIN, rotation = ROTATION_NONE) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {metadata, position, rotation, elevation: 0}};
}

export function updateMiniPositionAction(miniId, position) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {position}};
}

export function updateMiniRotationAction(miniId, rotation) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {rotation}};
}

export function updateMiniElevationAction(miniId, elevation) {
    return {type: UPDATE_MINI_ACTION, miniId, mini: {elevation}};
}

// ============ Getters ============

export function getScenarioFromStore(store) {
    return store.scenario;
}

// ============ Utility functions ============

function replaceMetadataWithId(all) {
    return Object.keys(all).reduce((result, guid) => {
        result[guid] = {
            ...all[guid],
            metadata: {id: all[guid].metadata.id}
        };
        return result;
    }, {});
}

export function scenarioToJson(scenario) {
    return {
        maps: replaceMetadataWithId(scenario.maps),
        minis: replaceMetadataWithId(scenario.minis)
    }
}

function restoreMetadataAndThreeObjects(driveMetadata, all) {
    return Object.keys(all).reduce((result, guid) => {
        result[guid] = {
            ...all[guid],
            metadata: driveMetadata[all[guid].metadata.id],
            position: new THREE.Vector3(all[guid].position.x, all[guid].position.y, all[guid].position.z),
            rotation: new THREE.Euler(all[guid].rotation._x, all[guid].rotation._y, all[guid].rotation._z, all[guid].rotation._order),
        };
        return result;
    }, {});
}

export function jsonToScenario(driveMetadata, json) {
    return {
        maps: restoreMetadataAndThreeObjects(driveMetadata, json.maps),
        minis: restoreMetadataAndThreeObjects(driveMetadata, json.minis)
    }
}