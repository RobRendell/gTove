import {ContextMenuOption} from './contextMenuTypes';

export const contextMenuRepositionHandleOptions: ContextMenuOption[] = [
    {
        label: 'Finish',
        title: 'Stop repositioning the map',
        onClick: ({setSelected}) => {
            setSelected(undefined);
        },
        show: ({userIsGM}) => (userIsGM)
    }
];
