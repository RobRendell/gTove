import {MapType, MiniType, ScenarioType, TabletopType} from '../@types/scenario';

function replaceMetadataWithId(all: {[key: string]: any}): {[key: string]: any} {
    return Object.keys(all).reduce((result, guid) => {
        result[guid] = {
            ...all[guid],
            metadata: {id: all[guid].metadata.id}
        };
        return result;
    }, {});
}

function filterObject<T>(object: {[key: string]: T}, filterFn: (object: T, key?: string, collection?: {[key: string]: T}) => boolean) {
    return Object.keys(object).reduce((result, key) => {
        if (filterFn(object[key], key, object)) {
            result[key] = object[key];
        }
        return result;
    }, {});
}

export function scenarioToJson(scenario: ScenarioType, publicActionId?: string): ScenarioType[] {
    // Split the scenario into private (everything) and public information.
    const maps = replaceMetadataWithId(scenario.maps);
    const minis = replaceMetadataWithId(scenario.minis);
    return [
        {
            snapToGrid: scenario.snapToGrid,
            lastActionId: scenario.lastActionId,
            maps,
            minis
        },
        {
            snapToGrid: scenario.snapToGrid,
            lastActionId: publicActionId || scenario.lastActionId,
            maps: filterObject(maps, (map: MapType) => (!map.gmOnly)),
            minis: filterObject(minis, (mini: MiniType) => (!mini.gmOnly))
        }
    ]
}


export function splitTabletop(combined: ScenarioType & TabletopType): [ScenarioType, TabletopType] {
    return [
        {
            snapToGrid: combined.snapToGrid,
            lastActionId: combined.lastActionId,
            maps: combined.maps,
            minis: combined.minis
        },
        {
            gm: combined.gm,
            gmSecret: combined.gmSecret
        }
    ];
}

export function getAllScenarioMetadataIds(scenario: ScenarioType): string[] {
    const metadataMap = Object.keys(scenario.maps).reduce((all, mapId) => {
        all[scenario.maps[mapId].metadata.id] = true;
        return all;
    }, Object.keys(scenario.minis).reduce((all, miniId) => {
        all[scenario.minis[miniId].metadata.id] = true;
        return all;
    }, {}));
    return Object.keys(metadataMap);
}