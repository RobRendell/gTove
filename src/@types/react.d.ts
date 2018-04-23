import * as React from 'react';

// Typescript magic from here: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/11640

type ExtractProps<T> = T extends React.ComponentType<infer Q> ? Q : never;
export type ExtractDefaultProps<T> = T extends { defaultProps?: infer Q } ? Q : never;
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

