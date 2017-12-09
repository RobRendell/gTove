import * as THREE from 'three';

const RESET_SCENARIO_ACTION = 'reset_scenario_action';
const ADD_MAP_ACTION = 'add_map_action';
const ADD_MINI_ACTION = 'add_mini_action';
const UPDATE_MAP_POSITION = 'update_map_position';
const UPDATE_MINI_POSITION = 'update_mini_position';

const EMPTY_SCENARIO = {maps: {}, minis: {}};
const ORIGIN = new THREE.Vector3(0, 0, 0);

function scenarioReducer(state = EMPTY_SCENARIO, action) {
    switch (action.type) {
        case RESET_SCENARIO_ACTION:
            return EMPTY_SCENARIO;
        case ADD_MAP_ACTION:
            return {...state, maps: {...state.maps, [action.map.metadata.id]: action.map}};
        case ADD_MINI_ACTION:
            return {...state, minis: {...state.minis, [action.mini.metadata.id]: action.mini}};
        case UPDATE_MAP_POSITION:
            return {...state, maps: {...state.maps, [action.id]: {
                ...state.maps[action.id],
                position: action.position
            }}};
        case UPDATE_MINI_POSITION:
            return {...state, minis: {...state.minis, [action.id]: {
                ...state.minis[action.id],
                position: action.position
            }}};
        default:
            return state;
    }
}

export default scenarioReducer;

export function resetScenarioAction() {
    return {type: RESET_SCENARIO_ACTION};
}

export function addMapAction(metadata, position = ORIGIN) {
    return {type: ADD_MAP_ACTION, map: {metadata, position}};
}

export function addMiniAction(metadata, position = ORIGIN) {
    return {type: ADD_MINI_ACTION, mini: {metadata, position}};
}

export function updateMapPositionAction(id, position) {
    return {type: UPDATE_MAP_POSITION, id, position};
}

export function updateMiniPositionAction(id, position) {
    return {type: UPDATE_MINI_POSITION, id, position};
}

export function getScenarioFromStore(store) {
    return store.scenario;
}
