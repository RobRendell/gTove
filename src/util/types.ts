import * as React from 'react';

export interface SizedEvent {
    target: {
        width: number;
        height: number;
    }
}

export function isSizedEvent(e: any): e is SizedEvent {
    return (e && e.target && e.target.width !== undefined && e.target.height !== undefined);
}

// Typescript magic from here: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/11640

type ExtractProps<T> = T extends React.ComponentType<infer Q> ? Q : never;
type ExtractDefaultProps<T> = T extends { defaultProps?: infer Q } ? Q : never;
type RequiredProps<P, DP> = Pick<P, Exclude<keyof P, keyof DP>>;
type RequiredAndPartialDefaultProps<RP, DP> = RP & Partial<DP>;

export type ComponentTypeWithDefaultProps<T> =
    React.ComponentType<
        RequiredAndPartialDefaultProps<
            RequiredProps<ExtractProps<T>, ExtractDefaultProps<T>>,
            ExtractDefaultProps<T>
        >
    >;

// Usage: MyComponent as ComponentTypeWithDefaultProps<typeof MyComponent>
