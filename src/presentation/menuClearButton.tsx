import {FunctionComponent, useContext} from 'react';
import {useDispatch} from 'react-redux';

import './menuClearButton.scss';

import InputButton from './inputButton';
import {setScenarioAction} from '../redux/scenarioReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {clearDiceAction} from '../redux/diceReducer';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import {ScenarioType} from '../util/scenarioUtils';

export interface MenuClearButtonProps {
    loggedInUserIsGM: boolean;
    readOnly: boolean;
    scenario: ScenarioType;
    clearDragMode: () => void;
}

const MenuClearButton: FunctionComponent<MenuClearButtonProps> = ({loggedInUserIsGM, readOnly, scenario, clearDragMode}) => {
    const promiseModal = useContext(PromiseModalContextObject);
    const dispatch = useDispatch();
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
                            dispatch(setScenarioAction({...scenario, maps: {}, minis: {}}, 'clear'));
                            dispatch(updateTabletopAction({videoMuted: {}}));
                            dispatch(clearDiceAction());
                            clearDragMode();
                        }
                    }
                }}
            >Clear Tabletop</InputButton>
        </div>
    );
};

export default MenuClearButton;