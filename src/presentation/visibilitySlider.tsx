import './visibilitySlider.scss';

import {Component} from 'react';
import MultiToggle from 'react-multi-toggle';

import {MINI_VISIBILITY_OPTIONS} from '../util/scenarioUtils';
import {PieceVisibilityEnum} from '../util/storage/storageContract';

interface VisibilitySliderProps {
    visibility: PieceVisibilityEnum;
    onChange: (value: PieceVisibilityEnum) => void;
}

export default class VisibilitySlider extends Component<VisibilitySliderProps> {
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