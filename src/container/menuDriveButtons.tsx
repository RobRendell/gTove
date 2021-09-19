import {FunctionComponent, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {VirtualGamingTabletopMode} from '../presentation/virtualGamingTabletop';
import * as constants from '../util/constants';
import InputButton from '../presentation/inputButton';
import {getAllFilesFromStore} from '../redux/mainReducer';

export interface MenuDriveButtonsProps {
    readOnly: boolean;
    isCurrentUserPlayer: boolean;
    setCurrentScreen: (state: VirtualGamingTabletopMode) => void;
}

const MenuDriveButtons: FunctionComponent<MenuDriveButtonsProps> = ({readOnly, isCurrentUserPlayer, setCurrentScreen}) => {
    const driveMenuButtons = useMemo(() => ([
        {label: 'Tabletops', state: VirtualGamingTabletopMode.TABLETOP_SCREEN, tooltip: 'Manage your tabletops'},
        {label: 'Maps', state: VirtualGamingTabletopMode.MAP_SCREEN, disabled: readOnly, tooltip: 'Upload and configure map images.'},
        {label: 'Minis', state: VirtualGamingTabletopMode.MINIS_SCREEN, disabled: readOnly, tooltip: 'Upload and configure miniature images.'},
        {label: 'Templates', state: VirtualGamingTabletopMode.TEMPLATES_SCREEN, disabled: readOnly, tooltip: 'Create and manage shapes like circles and squares.'},
        {label: 'Scenarios', state: VirtualGamingTabletopMode.SCENARIOS_SCREEN, disabled: isCurrentUserPlayer || readOnly, tooltip: 'Save your tabletop layouts to scenarios.'},
        {label: 'PDFs', state: VirtualGamingTabletopMode.PDFS_SCREEN, disabled: readOnly, tooltip: 'Upload and manage PDF documents.'},
        {label: 'Bundles', state: VirtualGamingTabletopMode.BUNDLES_SCREEN, tooltip: 'Share your work with other GMs.'}
    ]), [readOnly, isCurrentUserPlayer]);
    const files = useSelector(getAllFilesFromStore);
    return !files.roots[constants.FOLDER_ROOT] ? null : (
        <div>
            <hr/>
            {
                driveMenuButtons.map((buttonData) => (
                    <InputButton
                        key={buttonData.label}
                        type='button'
                        fillWidth={true}
                        disabled={buttonData.disabled ? buttonData.disabled : false}
                        tooltip={buttonData.tooltip}
                        onChange={() => {setCurrentScreen(buttonData.state)}}
                    >{buttonData.label}</InputButton>
                ))
            }
        </div>
    );
};

export default MenuDriveButtons;