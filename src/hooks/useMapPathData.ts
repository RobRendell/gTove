import {useSelector} from 'react-redux';

import {getScenarioFromStore, getTabletopFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {MapPathData, MapType} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';

function selectMapPathDataFromStore(state: ReduxStoreType) {
    const maps = getScenarioFromStore(state).maps;
    const tabletop = getTabletopFromStore(state);
    return Object.fromEntries(
        Object.keys(maps).map((mapId) => ([mapId, {
            gridType: maps[mapId].metadata.properties?.gridType || GridType.NONE,
            rotation: maps[mapId].rotation.y,
            gridUnit: maps[mapId].metadata.properties?.gridUnit ?? tabletop.gridUnit,
            gridScale: maps[mapId].metadata.properties?.gridScale ?? tabletop.gridScale,
            distanceRound: maps[mapId].metadata.properties?.distanceRound ?? tabletop.distanceRound,
            distanceMode: maps[mapId].metadata.properties?.distanceMode ?? tabletop.distanceMode
        }]))
    ) satisfies MapPathData;
}

export function tmpGetMapPathDataFromMaps(maps: {[mapId: string]: MapType}): MapPathData {
    return Object.fromEntries(
        Object.keys(maps).map((mapId) => ([mapId, {
            gridType: maps[mapId].metadata.properties?.gridType || GridType.NONE,
            rotation: maps[mapId].rotation.y
        }]))
    ) satisfies MapPathData;
}

function compareMapPathData(prev: MapPathData, next: MapPathData): boolean {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) {
        return false;
    }
    for (const key of prevKeys) {
        if (
            prev[key].gridType !== next[key]?.gridType
            || prev[key].rotation !== next[key]?.rotation
            || prev[key].gridUnit !== next[key]?.gridUnit
            || prev[key].gridScale !== next[key]?.gridScale
            || prev[key].distanceRound !== next[key]?.distanceRound
            || prev[key].distanceMode !== next[key]?.distanceMode
        ) {
            return false;
        }
    }
    return true;
}

// Project out just the data from all maps needed to render the paths.
export function useMapPathData() {
    return useSelector(selectMapPathDataFromStore, compareMapPathData);
}