import {Component, createContext} from 'react';
import PropTypes from 'prop-types';

import {PromiseModalDialogType} from '../container/promiseModalDialog';

export interface PromiseModalContext {
    promiseModal: PromiseModalDialogType;
}

export const PromiseModalContextObject = createContext<PromiseModalDialogType | undefined>(undefined);

interface PromiseModalContextBridgeProps {
    value: PromiseModalDialogType | undefined;
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
        console.debug('promiseModal bridge render', this.props.value);
        return (
            <PromiseModalContextObject.Provider value={this.props.value}>
                {this.props.children}
            </PromiseModalContextObject.Provider>
        )
    }
}