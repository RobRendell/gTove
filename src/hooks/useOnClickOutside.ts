import {useCallback, useEffect, useRef} from 'react';

export function useOnClickOutside<T extends HTMLElement>(callbackFn: () => void, deps: any[]) {
    const clickOutsideRef = useRef<T | null>(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const callback = useCallback(callbackFn, deps);

    const onClick = useCallback((evt: PointerEvent) => {
        if (clickOutsideRef.current && evt.target instanceof Node && !clickOutsideRef.current.contains(evt.target)) {
            evt.stopPropagation();
            callback();
        }
    }, [callback]);

    useEffect(() => {
        const document = clickOutsideRef.current?.ownerDocument;
        document?.addEventListener('pointerdown', onClick);
        return () => {
            document?.removeEventListener('pointerdown', onClick);
        }
    }, [onClick]);

    return clickOutsideRef;
}