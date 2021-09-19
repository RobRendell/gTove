import {useEffect, useRef, useState} from 'react';

// Based on code from here: https://stackoverflow.com/a/66650583/9214694
export const useStateWithCallback = <T>(initialState: T): [state: T, setState: (updatedState: React.SetStateAction<T>, callback?: (updatedState: T) => void) => void] => {
    const [state, setState] = useState<T>(initialState);
    const callbackRef = useRef<((updated: T) => void)[]>([]);

    const handleSetState = (updatedState: React.SetStateAction<T>, callback?: (updatedState: T) => void) => {
        if (callback) {
            callbackRef.current.push(callback);
        }
        setState(updatedState);
    };

    useEffect(() => {
        if (callbackRef.current.length > 0) {
            for (let callback of callbackRef.current) {
                callback(state);
            }
            callbackRef.current = [];
        }
    }, [state]);

    return [state, handleSetState];
}