import * as React from 'react';

import Tooltip from './tooltip';

interface InputFieldStringProps {
    type: 'text',
    initialValue?: string;
    value?: string;
    onChange: (value: string) => void;
    onBlur?: (value: string) => void;
}

interface InputFieldNumberProps {
    type: 'number' | 'range',
    initialValue?: number;
    value?: number;
    onChange: (value: number) => void;
    onBlur?: (value: number) => void;
}

interface InputFieldBooleanProps {
    type: 'checkbox',
    initialValue?: boolean;
    value?: boolean;
    onChange: (value: boolean) => void;
    onBlur?: (value: boolean) => void;
}

interface InputFieldOtherProps {
    className?: string;
    minValue?: number;
    maxValue?: number;
    step?: number;
    heading?: string;
    specialKeys?: {[keyCode: string]: (event: React.KeyboardEvent) => void};
    select?: boolean;
    focus?: boolean;
    placeholder?: string;
    updateOnChange?: boolean;
    tooltip?: string;
}

type InputFieldProps = (InputFieldStringProps | InputFieldNumberProps | InputFieldBooleanProps) & InputFieldOtherProps;

interface InputFieldState {
    value: string | number | boolean;
    invalid: boolean;
}

class InputField extends React.Component<InputFieldProps, InputFieldState> {

    private element: HTMLInputElement | null;

    constructor(props: InputFieldProps) {
        super(props);
        this.state = {
            value: props.initialValue === undefined ? '' : props.initialValue,
            invalid: false
        }
    }

    componentDidMount() {
        this.element && this.props.select && this.element.select();
    }

    UNSAFE_componentWillReceiveProps(props: InputFieldProps) {
        if (props.initialValue !== this.props.initialValue && props.initialValue !== undefined) {
            this.setState({value: props.initialValue});
        }
    }

    private castValue(value: string | number | boolean): string | number | boolean {
        if (this.props.type === 'number' || this.props.type === 'range') {
            value = Number(value);
            if (this.props.minValue !== undefined) {
                value = Math.max(this.props.minValue, value);
            }
            if (this.props.maxValue !== undefined) {
                value = Math.min(this.props.maxValue, value);
            }
        }
        return value;
    }

    onChange(value: string | number | boolean) {
        if (this.props.type === 'number' && value === '') {
            this.setState({invalid: true});
        } else {
            this.setState({invalid: false});
            (this.props.onChange as any)(this.castValue(value));
        }
    }

    render() {
        const targetField = (this.props.type === 'checkbox') ? 'checked' : 'value';
        const updateOnChange = (this.props.type === 'checkbox' || this.props.type === 'range'
            || this.props.updateOnChange === true || this.props.value !== undefined);
        const value = this.props.value === undefined ? this.state.value : this.props.value;
        const attributes = {
            type: this.props.type,
            [targetField]: this.state.invalid ? '' : value,
            onKeyDown: (event: React.KeyboardEvent) => {
                const keyCode = event.key;
                if (this.props.specialKeys && this.props.specialKeys[keyCode]) {
                    this.onChange(value);
                    this.props.specialKeys[keyCode](event);
                }
            },
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                if (updateOnChange) {
                    this.onChange(event.target[targetField]);
                } else {
                    this.setState({value: event.target[targetField]});
                }
            },
            onBlur: () => {
                !updateOnChange && this.onChange(value);
                this.props.onBlur && (this.props.onBlur as any)(this.castValue(value));
            },
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
            <Tooltip className='inputField' tooltip={this.props.tooltip}>
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
            </Tooltip>
        );
    }
}

export default InputField;