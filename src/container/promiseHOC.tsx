import * as React from 'react';

export interface PromiseHOC {
    setResult: (value?: any) => void;
    isAvailable: () => boolean;
}

export type PromiseComponentFunc<T extends PromiseHOC> = undefined | (PromiseHOC & ((props: PromiseExternalProps<T>) => Promise<any>));

type PromiseComponentProps<T extends PromiseHOC> = T & {
    setPromiseComponent: (promiseComponent?: PromiseComponentFunc<T>) => void;
}

export type PromiseExternalProps<T extends PromiseHOC> = Omit<T, keyof PromiseHOC>;

interface PromiseComponentState<T extends PromiseHOC> {
    componentProps?: PromiseExternalProps<T>;
    resolve?: (value?: any) => void;
}

export function promiseHOC<TOriginalProps extends PromiseHOC>(component: (React.ComponentType<TOriginalProps>)) {

    type ResultProps = PromiseExternalProps<PromiseComponentProps<TOriginalProps>>;

    return class PromiseComponent extends React.Component<ResultProps, PromiseComponentState<TOriginalProps>> {

        private readonly promiseComponentFunc: PromiseComponentFunc<TOriginalProps>;

        constructor(props: ResultProps) {
            super(props);
            this.promiseComponent = this.promiseComponent.bind(this);
            this.onResolve = this.onResolve.bind(this);
            this.promiseComponentFunc = Object.assign(this.promiseComponent, {
                setResult: this.onResolve,
                isAvailable: () => (this.state.componentProps === undefined)
            });
            props.setPromiseComponent(this.promiseComponentFunc);
            this.state = {};
        }

        UNSAFE_componentWillReceiveProps(props: PromiseComponentProps<TOriginalProps>) {
            props.setPromiseComponent(this.promiseComponentFunc);
        }

        componentWillUnmount() {
            this.props.setPromiseComponent();
        }

        promiseComponent(componentProps: PromiseExternalProps<TOriginalProps>) {
            return new Promise((resolve: (value?: any) => any) => {
                this.setState({componentProps, resolve});
            });
        }

        onResolve(value?: any) {
            if (typeof(value) === 'function') {
                value = value();
            }
            this.state.resolve && this.state.resolve(value);
            this.setState({componentProps: undefined, resolve: undefined});
        }

        render() {
            return (!this.state.componentProps) ? null : (
                React.createElement(component, {...this.state.componentProps, setResult: this.onResolve} as any)
            )
        }
    }
}