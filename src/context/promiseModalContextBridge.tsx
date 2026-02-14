import PropTypes from 'prop-types';
import {Component, createContext, PropsWithChildren} from 'react';

import {PromiseModalDialogType} from '../container/promiseModalDialog';

export interface PromiseModalContext {
    promiseModal: PromiseModalDialogType;
}

export const PromiseModalContextObject = createContext<PromiseModalDialogType | undefined>(undefined);

interface PromiseModalContextBridgeProps extends PropsWithChildren {
    value?: PromiseModalDialogType;
}

/** Support both legacy and new context APIs until we finish migrating to the new API. */
export default class PromiseModalContextBridge extends Component<PromiseModalContextBridgeProps> {

    static childContextTypes = {
        promiseModal: PropTypes.func
    }

    getChildContext(): PromiseModalContext {
        return {
            promiseModal: this.props.value
        };
    }

    render() {
        return (
            <PromiseModalContextObject.Provider value={this.props.value}>
                {this.props.children}
            </PromiseModalContextObject.Provider>
        )
    }
}