import './menuClearButton.scss';

import {FunctionComponent, useContext} from 'react';
import {useDispatch, useStore} from 'react-redux';

import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {clearDiceAction} from '../redux/diceReducer';
import {getScenarioFromStore} from '../redux/mainReducer';
import {setScenarioAction} from '../redux/scenarioReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {toggleTabletopStateDragModeAction} from '../redux/tabletopStateReducer';
import InputButton from './inputButton';

export interface MenuClearButtonProps {
    loggedInUserIsGM: boolean;
    readOnly: boolean;
}

const MenuClearButton: FunctionComponent<MenuClearButtonProps> = ({loggedInUserIsGM, readOnly}) => {
    const promiseModal = useContext(PromiseModalContextObject);
    const dispatch = useDispatch();
    const store = useStore();
    
    return !loggedInUserIsGM ? null : (
        <div>
            <hr/>
            <InputButton
                type='button' fillWidth={true} className='scaryButton' disabled={readOnly}
                tooltip='Remove all maps, pieces and dice.'
                onChange={async () => {
                    if (promiseModal?.isAvailable()) {
                        const yesOption = 'Yes';
                        const response = await promiseModal({
                            children: 'Are you sure you want to remove all maps, pieces and dice from this tabletop?',
                            options: [yesOption, 'Cancel']
                        });
                        if (response === yesOption) {
                            const scenario = getScenarioFromStore(store.getState());
                            dispatch(setScenarioAction({...scenario, maps: {}, minis: {}}, 'clear'));
                            dispatch(updateTabletopAction({videoMuted: {}}));
                            dispatch(clearDiceAction());
                            dispatch(toggleTabletopStateDragModeAction());
                        }
                    }
                }}
            >Clear Tabletop</InputButton>
        </div>
    );
};

export default MenuClearButton;