import {getFullMetadata} from './googleAPIUtils';

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
        gm: scenario.gm,
        maps: replaceMetadataWithId(scenario.maps),
        minis: replaceMetadataWithId(scenario.minis)
    }
}

function restoreMetadata(driveMetadata, json) {
    return Object.keys(json).reduce((result, guid) => {
        const id = json[guid].metadata.id;
        const metadata = driveMetadata[id] || {id};
        result[guid] = {
            ...json[guid],
            metadata: metadata
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

export function getMissingScenarioDriveMetadata(driveMetadata, json) {
    const findMissingIds = (collection) => (result, guid) => {
        const id = collection[guid].metadata.id;
        if (!driveMetadata[id]) {
            result.push(id);
        }
        return result;
    };
    const missingIds = Object.keys(json.maps).reduce(findMissingIds(json.maps),
        Object.keys(json.minis).reduce(findMissingIds(json.minis), []));
    return Promise.all(missingIds.map((id) => (getFullMetadata(id))));
}