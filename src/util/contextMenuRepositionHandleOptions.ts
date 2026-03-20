import {updateMapSelectedByAction} from '../redux/scenarioReducer';
import {ContextMenuOption} from './contextMenuTypes';

export const contextMenuRepositionHandleOptions: ContextMenuOption[] = [
    {
        label: 'Finish',
        title: 'Stop repositioning the map',
        onClick: ({scenario, myPeerId, dispatch}) => {
            const mapId = Object.keys(scenario.maps)
                .find((mapId) => (scenario.maps[mapId]?.selectedBy === myPeerId))
            if (mapId) {
                dispatch(updateMapSelectedByAction(mapId, null))
            }
        },
        show: ({userIsGM}) => (userIsGM)
    }
];
