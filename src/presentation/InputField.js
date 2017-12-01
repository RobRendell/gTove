import React, {Component} from 'react';
import PropTypes from 'prop-types';

class InputField extends Component {

    static propTypes = {
        type: PropTypes.oneOf(['text', 'number', 'checkbox']).isRequired,
        initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]).isRequired,
        onChange: PropTypes.func.isRequired,
        heading: PropTypes.string
    };

    constructor(props) {
        super(props);
        this.state = {
            value: props.initialValue
        }
    }

    componentWillReceiveProps(props) {
        if (props.initialValue !== this.props.initialValue) {
            this.setState({value: props.initialValue});
        }
    }

    render() {
        const targetField = (this.props.type === 'checkbox') ? 'checked' : 'value';
        const attributes = {
            type: this.props.type,
            [targetField]: this.state.value,
            onBlur: () => (this.props.onChange(this.state.value)),
            onChange: (event) => {
                this.setState({value: event.target[targetField]})
            }
        };
        return (
            <div className='inputField'>
                {
                    this.props.heading ? (
                        <label>
                            <span>{this.props.heading}</span>
                            <input {...attributes} />
                        </label>
                    ) : (
                        <input {...attributes} />
                    )
                }
            </div>
        );
    }
}

export default InputField;