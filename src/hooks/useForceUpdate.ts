import {useCallback, useState} from 'react';

export const useForceUpdate = () => {
    const [, updateState] = useState({});
    return useCallback(() => {
        // This relies on the fact that the object {} will be new each time we create it, forcing a re-render.
        updateState({});
    }, []);
}