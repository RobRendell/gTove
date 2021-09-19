import {Component, createContext} from 'react';
import PropTypes from 'prop-types';

export const DisableGlobalKeyboardHandlerContextObject = createContext((_: boolean) => {});

export interface DisableGlobalKeyboardHandlerContext {
    disableGlobalKeyboardHandler: (disable: boolean) => void;
}

interface DisableGlobalKeyboardHandlerContextBridgeProps {
    value: (disable: boolean) => void;
}

/** Support both legacy and new context APIs until we finish migrating to the new API. */
export class DisableGlobalKeyboardHandlerContextBridge extends Component<DisableGlobalKeyboardHandlerContextBridgeProps> {

    static childContextTypes = {
        disableGlobalKeyboardHandler: PropTypes.func
    };

    getChildContext() {
        return {
            disableGlobalKeyboardHandler: this.props.value
        };
    }

    render() {
        return (
            <DisableGlobalKeyboardHandlerContextObject.Provider value={this.props.value}>
                {this.props.children}
            </DisableGlobalKeyboardHandlerContextObject.Provider>
        );
    }
}
