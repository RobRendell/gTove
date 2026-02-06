import {ScenarioType} from './scenarioUtils';
import {FileAPI} from './storage/storageContract';

export enum BundleTypeEnum {
    DRIVE = 'drive'
}

export interface BundleType {
    name: string;
    bundleType: BundleTypeEnum;
    scenarios: {[name: string]: ScenarioType & {metadataId: string}};
    driveMaps: string[];
    driveMinis: string[];
}

export async function buildBundleJson(fileAPI: FileAPI, name: string, scenarioMetadataIds: string[], mapMetadataIds: string[], miniMetadataIds: string[]): Promise<BundleType> {
    let bundle: BundleType = {
        bundleType: BundleTypeEnum.DRIVE,
        name,
        scenarios: {},
        driveMaps: mapMetadataIds,
        driveMinis: miniMetadataIds
    };
    for (let metadataId of scenarioMetadataIds) {
        const scenarioMetadata = await fileAPI.getFullMetadata(metadataId);
        bundle.scenarios[scenarioMetadata.name] = await fileAPI.getJsonFileContents({id: metadataId});
        bundle.scenarios[scenarioMetadata.name].metadataId = metadataId;
    }
    return bundle;
}

export function isBundle(value: any): value is BundleType {
    return value && value.bundleType !== undefined;
}
