import React, {Component} from 'react';
import PropTypes from 'prop-types';

import './InputButton.css';

class InputButton extends Component {

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
                    multiple={this.props.multiple ? 'multiple' : ''}
                    onChange={(event) => {
                        this.props.onChange(event);
                    }}
                />
                <span>{this.props.text}</span>
            </label>
        );
    }
}

export default InputButton;