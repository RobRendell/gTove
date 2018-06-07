import {MapType, MiniType, ScenarioType} from '../@types/scenario';

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

export function scenarioToJson(scenario: ScenarioType): ScenarioType[] {
    // Split the scenario into private (everything) and public information.
    const maps = replaceMetadataWithId(scenario.maps);
    const minis = replaceMetadataWithId(scenario.minis);
    return [
        {
            gm: scenario.gm,
            snapToGrid: scenario.snapToGrid,
            lastActionId: scenario.lastActionId,
            maps,
            minis
        },
        {
            gm: scenario.gm,
            snapToGrid: scenario.snapToGrid,
            lastActionId: scenario.lastActionId,
            maps: filterObject(maps, (map: MapType) => (!map.gmOnly)),
            minis: filterObject(minis, (mini: MiniType) => (!mini.gmOnly))
        }
    ]
}
