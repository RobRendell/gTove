import {Action} from 'redux';

// =========================== Action types and generators

enum DebugLogActions {
    ADD_DEBUG_LOG = 'add-debug-log',
    ENABLE_DEBUG_LOG = 'enable-debug-log'
}

interface AddDebugLogActionType extends Action {
    type: DebugLogActions.ADD_DEBUG_LOG;
    logType: string;
    messages: any[];
}

export function addDebugLogAction(logType: string, messages: any[]): AddDebugLogActionType {
    return {type: DebugLogActions.ADD_DEBUG_LOG, logType, messages};
}

interface EnableDebugLogActionType extends Action {
    type: DebugLogActions.ENABLE_DEBUG_LOG;
    enable: boolean;
}

export function enableDebugLogAction(enable: boolean): EnableDebugLogActionType {
    return {type: DebugLogActions.ENABLE_DEBUG_LOG, enable};
}

type DebugLogReducerActions = AddDebugLogActionType | EnableDebugLogActionType;

// =========================== Reducers

interface LogMessage {
    logType: string;
    message: string;
}

export interface DebugLogReducerType {
    enabled: boolean;
    messages: LogMessage[];
    types: {[type: string]: boolean};
}

export function debugLogReducer(state: DebugLogReducerType = {enabled: false, messages: [], types: {}}, action: DebugLogReducerActions) {
    switch (action.type) {
        case DebugLogActions.ENABLE_DEBUG_LOG:
            return {enabled: action.enable, messages: action.enable ? state.messages : [], types: action.enable ? state.types : {}};
        case DebugLogActions.ADD_DEBUG_LOG:
            if (state.enabled) {
                // Only process log messages if logging is enabled.
                const message = action.messages.map((arg) => (
                    typeof(arg) === 'object' ? JSON.stringify(arg)
                        : arg === undefined ? 'undefined'
                        : arg === null ? 'null'
                        : arg.toString()
                )).join(' ');
                return !state.enabled ? state : {
                    ...state,
                    messages: (state.messages || []).concat({logType: action.logType, message}),
                    types: state.types[action.logType] ? state.types : {...state.types, [action.logType]: true}
                };
            } else {
                return state;
            }
        default:
            return state;
    }
}