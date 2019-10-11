import * as React from 'react';

export interface PromiseHOC {
    setResult: (value?: any) => void;
}

export type PromiseComponentFunc<T> = undefined | (PromiseHOC & ((props: T) => Promise<any>));

export const promiseHOC = <TOriginalProps extends PromiseHOC>
    (Component: (React.ComponentClass<TOriginalProps> | React.StatelessComponent<TOriginalProps>)) => {

    interface PromiseComponentProps {
        setPromiseComponent: (promiseComponent?: PromiseComponentFunc<TOriginalProps>) => void;
    }

    interface PromiseComponentState {
        componentProps?: TOriginalProps;
        resolve?: (value?: any) => void;
    }

    return class PromiseComponent extends React.Component<PromiseComponentProps, PromiseComponentState> {

        private readonly promiseComponentFunc: PromiseComponentFunc<TOriginalProps>;

        constructor(props: PromiseComponentProps) {
            super(props);
            this.promiseComponent = this.promiseComponent.bind(this);
            this.onResolve = this.onResolve.bind(this);
            this.promiseComponentFunc = Object.assign(this.promiseComponent, {
                setResult: this.onResolve
            });
            props.setPromiseComponent(this.promiseComponentFunc);
            this.state = {};
        }

        componentWillReceiveProps(props: PromiseComponentProps) {
            props.setPromiseComponent(this.promiseComponentFunc);
        }

        componentWillUnmount() {
            this.props.setPromiseComponent();
        }

        promiseComponent(componentProps: TOriginalProps) {
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
                <Component {...this.state.componentProps} setResult={this.onResolve}/>
            )
        }
    }

};