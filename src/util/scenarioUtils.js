function replaceMetadataWithId(all) {
    return Object.keys(all).reduce((result, guid) => {
        result[guid] = {
            ...all[guid],
            metadata: {id: all[guid].metadata.id}
        };
        return result;
    }, {});
}

function filterObject(object, filterFn) {
    return Object.keys(object).reduce((result, key) => {
        if (filterFn(object[key], key, object)) {
            result[key] = object[key];
        }
        return result;
    }, {});
}

export function scenarioToJson(scenario) {
    // Split the scenario into private (everything) and public information.
    const maps = replaceMetadataWithId(scenario.maps);
    const minis = replaceMetadataWithId(scenario.minis);
    return [
        {
            gm: scenario.gm,
            maps,
            minis
        },
        {
            gm: scenario.gm,
            maps: filterObject(maps, (map) => (!map.gmOnly)),
            minis: filterObject(minis, (mini) => (!mini.gmOnly))
        }
    ]
}

function restoreMetadata(driveMetadata, json) {
    return Object.keys(json).reduce((result, guid) => {
        const id = json[guid].metadata.id;
        const metadata = driveMetadata[id] || {id};
        result[guid] = {
            ...json[guid],
            metadata
        };
        return result;
    }, {});
}

export function jsonToScenario(driveMetadata, json) {
    return {
        gm: json.gm,
        maps: restoreMetadata(driveMetadata, json.maps),
        minis: restoreMetadata(driveMetadata, json.minis)
    }
}

export function getMissingScenarioDriveMetadata(fileAPI, driveMetadata, json) {
    const findMissingIds = (collection) => (result, guid) => {
        const id = collection[guid].metadata.id;
        if (!driveMetadata[id]) {
            result.push(id);
        }
        return result;
    };
    const missingIds = Object.keys(json.maps).reduce(findMissingIds(json.maps),
        Object.keys(json.minis).reduce(findMissingIds(json.minis), []));
    return Promise.all(missingIds.map((id) => (fileAPI.getFullMetadata(id))));
}