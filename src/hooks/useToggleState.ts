import {useCallback, useMemo, useState} from 'react';

export function useToggleState(initialValue: boolean) {
    const [value, setValue] = useState(initialValue);
    const toggle = useCallback(() => {
        setValue((value) => (!value));
    }, []);
    return useMemo(() => (
        [value, toggle, setValue] as const
    ), [toggle, value]);
}