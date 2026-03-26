import './menuControlPanel.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import MenuDriveButtons, {MenuDriveButtonsProps} from '../container/menuDriveButtons';
import {getTabletopStateFromStore} from '../redux/mainReducer';
import {setTabletopStateSideMenuOpenAction} from '../redux/tabletopStateReducer';
import MenuClearButton, {MenuClearButtonProps} from './menuClearButton';
import MenuEveryone, {MenuEveryoneProps} from './menuEveryone';
import MenuGmOnly, {MenuGmOnlyProps} from './menuGmOnly';

type MenuControlPanelProps = MenuGmOnlyProps & MenuEveryoneProps & MenuDriveButtonsProps & MenuClearButtonProps;

export const MenuControlPanel: FunctionComponent<MenuControlPanelProps> = (props) => {
    const {sideMenuOpen} = useSelector(getTabletopStateFromStore);
    const dispatch = useDispatch();
    const setSideMenuOpen = useCallback((open: boolean) => {
        dispatch(setTabletopStateSideMenuOpenAction(open));
    }, [dispatch]);
    
    return (
        <>
            <div className={classNames('controlPanel', {
                open: sideMenuOpen
            })}>
                <div className='material-icons openMenuControl' onClick={() => {
                    setSideMenuOpen(false);
                }}>close</div>
                <div className='scrollWrapper'>
                    <div className='buttonsPanel'>
                        <MenuEveryone {...props} />
                        <MenuGmOnly {...props} />
                        <MenuDriveButtons {...props} />
                        <MenuClearButton {...props} />
                    </div>
                </div>
            </div>
            {
                sideMenuOpen ? null : (
                    <div className='menuControl material-icons' onClick={() => {
                        setSideMenuOpen(true);
                    }}>menu</div>
                )

            }
        </>
    );
};

export default MenuControlPanel;