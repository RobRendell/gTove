import classNames from 'classnames';
import {useCallback} from 'react';
import ReactDropdown, {Option} from 'react-dropdown-now';

export default function EnumSelect<T, F extends keyof T, TEnum extends T[F], TEnumKeys extends string>(props: {
    containingObject: T;
    fieldName: F;
    enumObject: {[keys in TEnumKeys]: TEnum};
    labels: {[key in TEnumKeys]?: string};
    defaultValue: T[F];
    onChange: (update: (old: T | null) => T) => void;
    className?: string;
}) {
    const {enumObject, labels, containingObject, fieldName, defaultValue, onChange} = props;
    const options = Object.keys(enumObject)
        .filter((key) => (labels[key as TEnumKeys]))
        .map((key) => ({label: labels[key as TEnumKeys], value: enumObject[key as TEnumKeys]}));
    const option = options.find((option) => (
        option.value === (containingObject[fieldName] ?? defaultValue)
    ));
    const onSelectionChange = useCallback((selection: Option) => {
        onChange((old) => {
            if (!old) {
                throw new Error(`Cannot update field ${String(fieldName)} on uninitialised object`);
            }
            return {...old, [fieldName]: enumObject[selection.value as TEnumKeys]};
        });
    }, [enumObject, fieldName, onChange]);
    return (
        <ReactDropdown
            className={classNames('select', props.className)}
            options={options}
            value={option}
            onChange={onSelectionChange}
        />
    );
}