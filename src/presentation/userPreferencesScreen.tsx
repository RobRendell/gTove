import React, {FunctionComponent} from 'react';

import {GtoveDispatchProp} from '../redux/mainReducer';
import {getColourHex, TabletopUserPreferencesType} from '../util/scenarioUtils';
import InputButton from './inputButton';
import ColourPicker from './colourPicker';
import {updateTabletopUserPreferencesAction} from '../redux/tabletopReducer';

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
                    <ColourPicker disableAlpha={true} initialColour={getColourHex(preferences.dieColour)}
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