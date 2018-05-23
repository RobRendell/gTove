import * as React from 'react';
import * as PropTypes from 'prop-types';

interface InputFieldProps {
    type: 'text' | 'number' | 'checkbox';
    initialValue: string | number | boolean;
    onChange: (value: string | number | boolean) => void;
    heading?: string;
    specialKeys?: {[keyCode: string]: () => void};
    select?: boolean;
    focus?: boolean
}

interface InputFieldState {
    value: string | number | boolean;
}

class InputField extends React.Component<InputFieldProps, InputFieldState> {

    static propTypes = {
        type: PropTypes.oneOf(['text', 'number', 'checkbox']).isRequired,
        initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]).isRequired,
        onChange: PropTypes.func.isRequired,
        heading: PropTypes.string,
        specialKeys: PropTypes.object,
        select: PropTypes.bool,
        focus: PropTypes.bool
    };

    private element: HTMLInputElement | null;

    constructor(props: InputFieldProps) {
        super(props);
        this.state = {
            value: props.initialValue
        }
    }

    componentDidMount() {
        this.element && this.props.select && this.element.select();
    }

    componentWillReceiveProps(props: InputFieldProps) {
        if (props.initialValue !== this.props.initialValue) {
            this.setState({value: props.initialValue});
        }
    }

    render() {
        const targetField = (this.props.type === 'checkbox') ? 'checked' : 'value';
        const attributes = {
            type: this.props.type,
            [targetField]: this.state.value,
            onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                const keyCode = event.key;
                if (this.props.specialKeys && this.props.specialKeys[keyCode]) {
                    this.props.onChange(this.state.value);
                    this.props.specialKeys[keyCode]();
                }
            },
            onBlur: () => (this.props.onChange(this.state.value)),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                this.setState({value: event.target[targetField]})
            },
            autoFocus: this.props.focus,
            onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
                if (this.props.focus) {
                    const value = event.target.value;
                    event.target.value = '';
                    event.target.value = value;
                }
            }
        };
        return (
            <div className='inputField'>
                {
                    this.props.heading ? (
                        <label>
                            <span>{this.props.heading}</span>
                            <input {...attributes} ref={(element) => {this.element = element}}/>
                        </label>
                    ) : (
                        <input {...attributes} ref={(element) => {this.element = element}}/>
                    )
                }
            </div>
        );
    }
}

export default InputField;