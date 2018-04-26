import * as React from 'react';
import * as PropTypes from 'prop-types';

import {ComponentTypeWithDefaultProps} from '../util/types';

import './inputButton.css';

interface InputButtonProps {
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    text: string;
    type: string;
    selected?: boolean;
    multiple?: boolean;
}

class InputButton extends React.Component<InputButtonProps> {

    static propTypes = {
        onChange: PropTypes.func.isRequired,
        text: PropTypes.string.isRequired,
        selected: PropTypes.bool,
        type: PropTypes.string,
        multiple: PropTypes.bool
    };

    static defaultProps = {
        type: 'checkbox'
    };

    render() {
        return  (
            <label className='toggleButton'>
                <input
                    type={this.props.type}
                    checked={this.props.selected}
                    multiple={this.props.multiple}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        this.props.onChange(event);
                    }}
                />
                <span>{this.props.text}</span>
            </label>
        );
    }
}

export default InputButton as ComponentTypeWithDefaultProps<typeof InputButton>;