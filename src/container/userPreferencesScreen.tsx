import {FunctionComponent} from 'react';

import InputButton from '../presentation/inputButton';
import {GtoveDispatchProp} from '../redux/mainReducerTypes';
import {updateTabletopUserPreferencesAction} from '../redux/tabletopReducer';
import {getColourHex, GRID_COLOUR, TabletopUserPreferencesType} from '../util/scenarioUtils';
import ColourPicker from './colourPicker';

interface UserPreferencesScreenProps extends GtoveDispatchProp {
    preferences: TabletopUserPreferencesType;
    emailAddress: string;
    onFinish: () => void;
}

const UserPreferencesScreen: FunctionComponent<UserPreferencesScreenProps> = ({dispatch, preferences, emailAddress, onFinish}) => {
    return (
        <div className='fullHeight'>
            <InputButton onChange={onFinish} type='button'>Finish</InputButton>
            <fieldset>
                <legend>Dice Colour</legend>
                <div>
                    <ColourPicker disableAlpha={true} initialColour={getColourHex(preferences.dieColour as GRID_COLOUR)}
                                  onColourChange={(result) => {
                                      dispatch(updateTabletopUserPreferencesAction(emailAddress, {dieColour: result.hex}));
                                  }}
                    />
                </div>
            </fieldset>
        </div>
    )
};

export default UserPreferencesScreen;