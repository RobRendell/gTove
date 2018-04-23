
declare module 'react-sizeme' {

    import * as React from 'react';

    type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

    export interface ReactSizeMeProps {
        size: {
            width: number;
            height: number;
        };
    }

    export interface SizeMeOptions {
        monitorWidth?: boolean;
        monitorHeight?: boolean;
        monitorPosition?: boolean;
        refreshRate?: number;
        refreshMode?: 'throttle' | 'debounce';
        noPlaceholder?: boolean;
    }

    const sizeMe: (options?: SizeMeOptions) => <P extends ReactSizeMeProps>(component: React.ComponentType<P>) => React.ComponentType<Omit<P, 'size'>>;

    export default sizeMe;
}