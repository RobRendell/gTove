import * as React from 'react';
import * as PropTypes from 'prop-types';
import requiredIf from 'react-required-if';

interface InputFieldStringProps {
    type: 'text',
    initialValue: string;
    onChange: (value: string) => void;
    onBlur?: (value: string) => void;
}

interface InputFieldNumberProps {
    type: 'number' | 'range',
    initialValue: number;
    onChange: (value: number) => void;
    onBlur?: (value: number) => void;
}

interface InputFieldBooleanProps {
    type: 'checkbox',
    initialValue: boolean;
    onChange: (value: boolean) => void;
    onBlur?: (value: boolean) => void;
}

interface InputFieldOtherProps {
    className?: string;
    minValue?: number;
    maxValue?: number;
    step?: number;
    heading?: string;
    specialKeys?: {[keyCode: string]: () => void};
    select?: boolean;
    focus?: boolean;
    placeholder?: string;
    updateOnChange?: boolean;
    title?: string;
}

type InputFieldProps = (InputFieldStringProps | InputFieldNumberProps | InputFieldBooleanProps) & InputFieldOtherProps;

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
        onBlur: PropTypes.func,
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
        (this.props.onChange as any)(this.castValue(value));
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
                    this.setState({value: event.target[targetField]});
                }
            },
            onBlur: () => {
                !updateOnChange && this.onChange(this.state.value);
                this.props.onBlur && (this.props.onBlur as any)(this.castValue(this.state.value));
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
            <div className='inputField' title={this.props.title}>
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