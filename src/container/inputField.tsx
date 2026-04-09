import {
    CSSProperties,
    FunctionComponent,
    InputHTMLAttributes,
    KeyboardEvent,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import {DisableGlobalKeyboardHandlerContextObject} from '../context/disableGlobalKeyboardHandlerProvider';
import Tooltip from '../presentation/tooltip';

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
    style?: CSSProperties;
    heading?: string;
    specialKeys?: {[keyCode: string]: (event: KeyboardEvent) => void};
    select?: boolean;
    focus?: boolean;
    placeholder?: string;
    updateOnChange?: boolean;
    tooltip?: string;
}

type InputFieldProps = (InputFieldStringProps | InputFieldNumberProps | InputFieldRangeProps | InputFieldBooleanProps) & InputFieldOtherProps;

const InputField: FunctionComponent<InputFieldProps> = ({initialValue, className, style, heading, specialKeys, select, focus, placeholder, tooltip, ...props}) => {
    const disableGlobalKeyboardHandler = useContext(DisableGlobalKeyboardHandlerContextObject);

    const inputRef = useRef<HTMLInputElement>(null);
    const didDisableKeyboardRef = useRef(false);

    const [value, setValue] = useState<string | number | boolean>(initialValue ?? '');
    const [invalid, setInvalid] = useState(false);

    useEffect(() => {
        if (initialValue !== undefined) {
            setValue(initialValue);
        }
    }, [initialValue]);

    useEffect(() => {
        if (select) {
            inputRef.current?.select();
        }
    }, [select]);

    useEffect(() => () => {
        // Re-enable the global keyboard handler on unmount, if we disabled it.
        if (didDisableKeyboardRef.current) {
            disableGlobalKeyboardHandler(false);
        }
    }, [disableGlobalKeyboardHandler]);

    const castValue = useCallback((value: string | number | boolean): string | number | boolean => {
        if (props.type === 'number' || props.type === 'range') {
            value = Number(value);
            if (props.minValue !== undefined) {
                value = Math.max(props.minValue, value);
            }
            if (props.maxValue !== undefined) {
                value = Math.min(props.maxValue, value);
            }
        }
        return value;
    }, [props]);

    const onChange = useCallback((value: string | number | boolean) => {
        if (props.type === 'number' && value === '') {
            setInvalid(true);
        } else {
            setInvalid(false);
            (props.onChange as any)?.(castValue(value));
        }
    }, [castValue, props.onChange, props.type]);

    const showValue = props.type === 'range' && props.showValue;

    const attributes = useMemo<InputHTMLAttributes<HTMLInputElement>>(() => {
        const targetField = (props.type === 'checkbox') ? 'checked' : 'value';

        const updateOnChange = (props.type === 'checkbox' || props.type === 'range'
            || props.updateOnChange === true || props.value !== undefined);

        const currentValue = props.value === undefined ? value : props.value;

        return {
            type: props.type,
            [targetField]: invalid ? '' : currentValue,
            onKeyDown: (event) => {
                const keyCode = event.key;
                if (specialKeys?.[keyCode]) {
                    onChange(currentValue);
                    specialKeys[keyCode](event);
                }
            },
            onChange: (event) => {
                if (updateOnChange) {
                    onChange(event.target[targetField]);
                } else {
                    setValue(event.target[targetField]);
                }
            },
            onBlur: () => {
                if (disableGlobalKeyboardHandler) {
                    disableGlobalKeyboardHandler(false);
                    didDisableKeyboardRef.current = false;
                }
                !updateOnChange && onChange(currentValue);
                (props.onBlur as any)?.(castValue(currentValue));
            },
            autoFocus: focus,
            onFocus: (event) => {
                if (disableGlobalKeyboardHandler) {
                    disableGlobalKeyboardHandler(true);
                    didDisableKeyboardRef.current = true;
                }
                if (focus) {
                    const value = event.target.value;
                    event.target.value = '';
                    event.target.value = value;
                }
            },
            ...(
                props.type === 'range' ? {
                    min: props.minValue,
                    max: props.maxValue,
                    step: props.step
                } : undefined
            ),
            placeholder: placeholder
        };
    }, [castValue, disableGlobalKeyboardHandler, focus, invalid, onChange, placeholder, props, specialKeys, value]);

    return (
        <Tooltip className='inputField' tooltip={tooltip}>
            {
                heading ? (
                    <label className={className} style={style}>
                        <span>{heading}</span>
                        <input {...attributes} ref={inputRef}/>
                        {
                            !showValue ? null : (
                                <span className='rangeValue'>{value}</span>
                            )
                        }
                    </label>
                ) : (
                    <>
                        <input className={className} style={style} {...attributes} ref={inputRef}/>
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

export default InputField;