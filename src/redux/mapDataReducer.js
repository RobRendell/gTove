const UPDATE_MAP_ACTION = 'update_map_action';

export default function mapDataReducer(state = {}, action) {
    switch (action.type) {
        case UPDATE_MAP_ACTION:
            return {
                ...state,
                [action.mapId]: action.mapData
            };
        default:
            return state;
    }
}

export function updateMapAction(mapId, mapData) {
    return {type: UPDATE_MAP_ACTION, mapId, mapData};
}

export function getMapDataFromStore(store) {
    return store.mapData;
}