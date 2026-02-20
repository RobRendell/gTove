import {updateMapFogOfWarAction} from '../redux/scenarioReducer';
import {ContextMenuOption} from './contextMenuTypes';

export const contextMenuFogOfWarRectOptions: ContextMenuOption[] = [
    {
        label: 'Cover',
        title: 'Cover the selected area with fog of war',
        onClick: ({changeFogOfWarBitmask}) => {
            changeFogOfWarBitmask(false);
        }
    },
    {
        label: 'Uncover',
        title: 'Remove fog of war from the selected area',
        onClick: ({changeFogOfWarBitmask}) => {
            changeFogOfWarBitmask(true);
        }
    },
    {
        label: 'Cancel',
        title: 'Cancel',
        onClick: ({cancelFogOfWarRect}) => {
            cancelFogOfWarRect();
        }
    },
];

export const contextMenuFogOfWarHandleOptions: ContextMenuOption[] = [
    {
        label: 'Cover all maps',
        title: 'Cover all maps with Fog of War.',
        onClick: async ({scenario, dispatch, confirmLargeFogOfWarAction}) => {
            const mapIds = Object.keys(scenario.maps);
            if (await confirmLargeFogOfWarAction(mapIds)) {
                mapIds.forEach((mapId) => {
                    dispatch(updateMapFogOfWarAction(mapId, []));
                });
            }
        },
        show: ({userIsGM}) => (userIsGM)
    },
    {
        label: 'Uncover all maps',
        title: 'Remove Fog of War from all maps.',
        onClick: async ({scenario, dispatch, confirmLargeFogOfWarAction}) => {
            const mapIds = Object.keys(scenario.maps);
            if (await confirmLargeFogOfWarAction(mapIds)) {
                mapIds.forEach((mapId) => {
                    dispatch(updateMapFogOfWarAction(mapId));
                });
            }
        },
        show: ({userIsGM}) => (userIsGM)
    },
    {
        label: 'Finish',
        title: 'Exit Fog of War Mode',
        onClick: ({endFogOfWarMode}) => {endFogOfWarMode()},
        show: ({userIsGM}) => (userIsGM)
    }
];

