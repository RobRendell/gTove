import {ScenarioType} from '../util/scenarioUtils';
import {FileMetadata, MapProperties, MiniProperties} from '../util/storage/storageContract';
import warrior from './Dwarf_warrior_male.png'
import ranger from './Elf_sentinel_male.png';
import wizard from './Human_mage_male.png';
import fighter from './Human_warrior_female.png'
import skeleton from './Skeleton.png';
import towerUpper from './Tower Upper.png';
import tower from './Tower.png';
import tutorialMetadata from './tutorialMetadata.json';
import tutorialScenario from './tutorialScenario.json';

export function getTutorialScenario(): ScenarioType {
    return tutorialScenario as any;
}

export function buildTutorialMetadata(): {[key: string]: FileMetadata<void, MiniProperties | MapProperties>} {
    // Substitute the current image URLs
    const urls: {[key: string]: string} = {
        tower, towerUpper, fighter, warrior, wizard, ranger, skeleton
    };
    let metadata: {[key: string]: any} = tutorialMetadata;
    Object.keys(metadata).forEach((id) => {
        const webLink = metadata[id].properties.webLink;
        if (urls[webLink]) {
            metadata = {...metadata, [id]: {...metadata[id], properties: {...metadata[id].properties, webLink: urls[webLink]}}};
        }
    });
    return metadata as any;
}