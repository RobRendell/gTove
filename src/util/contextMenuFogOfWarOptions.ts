import {updateMapFogOfWarAction} from '../redux/scenarioReducer';
import {toggleTabletopStateDragModeAction} from '../redux/tabletopStateReducer';
import {ContextMenuOption} from './contextMenuTypes';

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
        onClick: ({dispatch}) => {dispatch(toggleTabletopStateDragModeAction('fogOfWarMode'))},
        show: ({userIsGM}) => (userIsGM)
    }
];

