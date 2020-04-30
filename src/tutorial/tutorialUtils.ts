import {DriveMetadata, MapProperties, MiniProperties} from '../util/googleDriveUtils';

import tutorialScenario from './tutorialScenario.json';
import tutorialMetadata from './tutorialMetadata.json';
import tower from './Tower.png';
import towerUpper from './Tower Upper.png';
import fighter from './Human_warrior_female.png'
import warrior from './Dwarf_warrior_male.png'
import wizard from './Human_mage_male.png';
import ranger from './Elf_sentinel_male.png';
import skeleton from './Skeleton.png';


export function getTutorialScenario() {
    return tutorialScenario;
}

export function buildTutorialMetadata(): {[key: string]: DriveMetadata<void, MiniProperties | MapProperties>} {
    // Substitute the current image URLs
    const urls = {
        tower, towerUpper, fighter, warrior, wizard, ranger, skeleton
    };
    let metadata = tutorialMetadata;
    Object.keys(metadata).forEach((id) => {
        const webLink = metadata[id].properties.webLink;
        if (urls[webLink]) {
            metadata = {...metadata, [id]: {...metadata[id], properties: {...metadata[id].properties, webLink: urls[webLink]}}};
        }
    });
    return metadata as any;
}