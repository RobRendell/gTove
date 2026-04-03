import {FunctionComponent, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import InputButton from '../presentation/inputButton';
import {getAllFilesFromStore} from '../redux/mainReducer';
import {setTabletopStateCurrentPageAction} from '../redux/tabletopStateReducer';
import {GToveMode} from '../redux/tabletopStateReducerTypes';
import * as constants from '../util/constants';

export interface MenuDriveButtonsProps {
    readOnly: boolean;
    isCurrentUserPlayer: boolean;
}

const MenuDriveButtons: FunctionComponent<MenuDriveButtonsProps> = ({readOnly, isCurrentUserPlayer}) => {
    const dispatch = useDispatch();
    const driveMenuButtons = useMemo(() => ([
        {label: 'Tabletops', state: GToveMode.TABLETOP_SCREEN, tooltip: 'Manage your tabletops'},
        {label: 'Maps', state: GToveMode.MAP_SCREEN, disabled: readOnly, tooltip: 'Upload and configure map images.'},
        {label: 'Minis', state: GToveMode.MINIS_SCREEN, disabled: readOnly, tooltip: 'Upload and configure miniature images.'},
        {label: 'Templates', state: GToveMode.TEMPLATES_SCREEN, disabled: readOnly, tooltip: 'Create and manage shapes like circles and squares.'},
        {label: 'Scenarios', state: GToveMode.SCENARIOS_SCREEN, disabled: isCurrentUserPlayer || readOnly, tooltip: 'Save your tabletop layouts to scenarios.'},
        {label: 'PDFs', state: GToveMode.PDFS_SCREEN, disabled: readOnly, tooltip: 'Upload and manage PDF documents.'},
        {label: 'Bundles', state: GToveMode.BUNDLES_SCREEN, tooltip: 'Share your work with other GMs.'}
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
                        onChange={() => {
                            dispatch(setTabletopStateCurrentPageAction(buttonData.state));
                        }}
                    >{buttonData.label}</InputButton>
                ))
            }
        </div>
    );
};

export default MenuDriveButtons;