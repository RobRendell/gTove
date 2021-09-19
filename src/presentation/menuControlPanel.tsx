import {FunctionComponent} from 'react';
import classNames from 'classnames';

import './menuControlPanel.scss';

import MenuGmOnly, {MenuGmOnlyProps} from './menuGmOnly';
import MenuEveryone, {MenuEveryoneProps} from './menuEveryone';
import MenuDriveButtons, {MenuDriveButtonsProps} from '../container/menuDriveButtons';
import MenuClearButton, {MenuClearButtonProps} from './menuClearButton';

interface MenuControlPanelProps extends MenuGmOnlyProps, MenuEveryoneProps, MenuDriveButtonsProps, MenuClearButtonProps {
    panelOpen: boolean;
    setPanelOpen: (set: boolean) => void;
}

export const MenuControlPanel: FunctionComponent<MenuControlPanelProps> = (props) => {
    const {panelOpen, setPanelOpen, ...otherProps} = props;
    return (
        <>
            <div className={classNames('controlPanel', {
                open: panelOpen
            })}>
                <div className='material-icons openMenuControl' onClick={() => {
                    setPanelOpen(false);
                }}>close</div>
                <div className='scrollWrapper'>
                    <div className='buttonsPanel'>
                        <MenuEveryone {...otherProps} />
                        <MenuGmOnly {...otherProps} />
                        <MenuDriveButtons {...otherProps} />
                        <MenuClearButton {...otherProps} />
                    </div>
                </div>
            </div>
            {
                panelOpen ? null : (
                    <div className='menuControl material-icons' onClick={() => {
                        setPanelOpen(true);
                    }}>menu</div>
                )

            }
        </>
    );
};

export default MenuControlPanel;