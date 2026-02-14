import {ChangeEvent, Component, FocusEvent, KeyboardEvent} from 'react';

import {DisableGlobalKeyboardHandlerContextObject} from '../context/disableGlobalKeyboardHandlerContextBridge';
import Tooltip from './tooltip';

interface InputFieldStringProps {
    type: 'text',
    initialValue?: string;
    value?: string;
    onChange: (value: string) => void;
    onBlur?: (value: string) => void;
}

interface InputFieldNumericProps {
    initialValue?: number;
    value?: number;
    minValue?: number;
    maxValue?: number;
    onChange: (value: number) => void;
    onBlur?: (value: number) => void;
}

interface InputFieldNumberProps extends InputFieldNumericProps {
    type: 'number',
}

interface InputFieldRangeProps extends InputFieldNumericProps {
    type: 'range';
    step?: number;
    showValue?: boolean;
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
    style?: React.CSSProperties;
    heading?: string;
    specialKeys?: {[keyCode: string]: (event: React.KeyboardEvent) => void};
    select?: boolean;
    focus?: boolean;
    placeholder?: string;
    updateOnChange?: boolean;
    tooltip?: string;
}

type InputFieldProps = (InputFieldStringProps | InputFieldNumberProps | InputFieldRangeProps | InputFieldBooleanProps) & InputFieldOtherProps;

interface InputFieldState {
    value: string | number | boolean;
    invalid: boolean;
    disabledKeyboardHandler: boolean;
}

class InputField extends Component<InputFieldProps, InputFieldState> {

    static contextType = DisableGlobalKeyboardHandlerContextObject;
    declare context: React.ContextType<typeof DisableGlobalKeyboardHandlerContextObject>;

    private element: HTMLInputElement | null;

    constructor(props: InputFieldProps) {
        super(props);
        this.state = {
            value: props.initialValue === undefined ? '' : props.initialValue,
            invalid: false,
            disabledKeyboardHandler: false
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

    componentWillUnmount(): void {
        if (this.context && this.state.disabledKeyboardHandler) {
            this.context(false);
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
        const showValue = this.props.type === 'range' && this.props.showValue;
        const attributes = {
            type: this.props.type,
            [targetField]: this.state.invalid ? '' : value,
            onKeyDown: (event: KeyboardEvent) => {
                const keyCode = event.key;
                if (this.props.specialKeys && this.props.specialKeys[keyCode]) {
                    this.onChange(value);
                    this.props.specialKeys[keyCode](event);
                }
            },
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
                if (updateOnChange) {
                    this.onChange(event.target[targetField]);
                } else {
                    this.setState({value: event.target[targetField]});
                }
            },
            onBlur: () => {
                if (this.context) {
                    this.context(false);
                    this.setState({disabledKeyboardHandler: false});
                }
                !updateOnChange && this.onChange(value);
                this.props.onBlur && (this.props.onBlur as any)(this.castValue(value));
            },
            autoFocus: this.props.focus,
            onFocus: (event: FocusEvent<HTMLInputElement>) => {
                if (this.context) {
                    this.context(true);
                    this.setState({disabledKeyboardHandler: true});
                }
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
                        <label className={this.props.className} style={this.props.style}>
                            <span>{this.props.heading}</span>
                            <input {...attributes} ref={(element) => {this.element = element}}/>
                            {
                                !showValue ? null : (
                                    <span className='rangeValue'>{value}</span>
                                )
                            }
                        </label>
                    ) : (
                        <>
                            <input className={this.props.className} style={this.props.style} {...attributes}
                                   ref={(element) => {this.element = element}}/>
                            {
                                !showValue ? null : (
                                    <span className='rangeValue'>{value}</span>
                                )
                            }
                        </>
                    )
                }
            </Tooltip>
        );
    }
}

export default InputField;