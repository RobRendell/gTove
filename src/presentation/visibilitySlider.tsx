import * as React from 'react';
import MultiToggle from 'react-multi-toggle';

import './visibilitySlider.scss';

import {MINI_VISIBILITY_OPTIONS} from '../util/scenarioUtils';
import {PieceVisibilityEnum} from '../util/storage/storageContract';

interface VisibilitySliderProps {
    visibility: PieceVisibilityEnum;
    onChange: (value: PieceVisibilityEnum) => void;
}

export default class VisibilitySlider extends React.Component<VisibilitySliderProps> {
    render() {
        return (
            <MultiToggle
                className='visibilitySlider'
                options={MINI_VISIBILITY_OPTIONS}
                selectedOption={this.props.visibility}
                onSelectOption={this.props.onChange}
            />
        );
    }
}