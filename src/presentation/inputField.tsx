import * as React from 'react';
import * as PropTypes from 'prop-types';
import requiredIf from 'react-required-if';

interface InputFieldProps {
    className?: string;
    type: 'text' | 'number' | 'checkbox' | 'range';
    initialValue: string | number | boolean;
    minValue?: number;
    maxValue?: number;
    step?: number;
    onChange: (value: string | number | boolean) => void;
    heading?: string;
    specialKeys?: {[keyCode: string]: () => void};
    select?: boolean;
    focus?: boolean;
    placeholder?: string;
    updateOnChange?: boolean;
}

interface InputFieldState {
    value: string | number | boolean;
}

class InputField extends React.Component<InputFieldProps, InputFieldState> {

    static propTypes = {
        className: PropTypes.string,
        type: PropTypes.oneOf(['text', 'number', 'checkbox', 'range']).isRequired,
        initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]).isRequired,
        minValue: requiredIf(PropTypes.number, (props: InputFieldProps) => (props.type === 'range')),
        maxValue: requiredIf(PropTypes.number, (props: InputFieldProps) => (props.type === 'range')),
        step: requiredIf(PropTypes.number, (props: InputFieldProps) => (props.type === 'range')),
        onChange: PropTypes.func.isRequired,
        heading: PropTypes.string,
        specialKeys: PropTypes.object,
        select: PropTypes.bool,
        focus: PropTypes.bool,
        placeholder: PropTypes.string,
        updateOnChange: PropTypes.bool
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

    onChange(value: string | number | boolean) {
        if (this.props.type === 'number' || this.props.type === 'range') {
            value = Number(value);
            if (this.props.minValue !== undefined) {
                value = Math.max(this.props.minValue, value);
            }
            if (this.props.maxValue !== undefined) {
                value = Math.min(this.props.maxValue, value);
            }
        }
        this.props.onChange(value);
    }

    render() {
        const targetField = (this.props.type === 'checkbox') ? 'checked' : 'value';
        const updateOnChange = (this.props.type === 'checkbox' || this.props.type === 'range' || this.props.updateOnChange === true);
        const attributes = {
            type: this.props.type,
            [targetField]: this.state.value,
            onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                const keyCode = event.key;
                if (this.props.specialKeys && this.props.specialKeys[keyCode]) {
                    this.onChange(this.state.value);
                    this.props.specialKeys[keyCode]();
                }
            },
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                if (updateOnChange) {
                    this.onChange(event.target[targetField]);
                } else {
                    this.setState({value: event.target[targetField]})
                }
            },
            onBlur: () => (!updateOnChange && this.onChange(this.state.value)),
            autoFocus: this.props.focus,
            onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
                if (this.props.focus) {
                    const value = event.target.value;
                    event.target.value = '';
                    event.target.value = value;
                }
            },
            ...(
                this.props.type === 'range' ? {
                    min: this.props.minValue,
                    max: this.props.maxValue,
                    step: this.props.step
                } : undefined
            ),
            placeholder: this.props.placeholder
        };
        return (
            <div className='inputField'>
                {
                    this.props.heading ? (
                        <label className={this.props.className}>
                            <span>{this.props.heading}</span>
                            <input {...attributes} ref={(element) => {this.element = element}}/>
                        </label>
                    ) : (
                        <input className={this.props.className} {...attributes} ref={(element) => {this.element = element}}/>
                    )
                }
            </div>
        );
    }
}

export default InputField;