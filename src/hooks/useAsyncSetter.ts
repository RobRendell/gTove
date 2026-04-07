import {useGranularEffect} from 'granular-hooks';

// A convenience hook to launch the nominated async function when `deps` changes, and invoke the provided setter with
// the result when it resolves, unless `deps` change or the hook is unmounted in the meantime.
export function useAsyncSetter<T>(setter: (value: T) => void, asyncFn: () => Promise<T>, deps: any[], otherDeps: any[] = []) {
    useGranularEffect(() => {
        let valid = true;
        (async () => {
            const value = await asyncFn();
            if (valid) {
                setter(value);
            }
        })();
        return () => {
            valid = false;
        }
    }, deps, otherDeps);
}