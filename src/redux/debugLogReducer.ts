import {Action} from 'redux';
import {LoggedInUserActionTypes, SetLoggedInUserActionType} from './loggedInUserReducer';

// =========================== Action types and generators

enum DebugLogActions {
    ADD_DEBUG_LOG = 'add-debug-log'
}

interface AddDebugLogActionType extends Action {
    type: DebugLogActions.ADD_DEBUG_LOG;
    logType: string;
    messages: any[];
}

export function addDebugLogAction(logType: string, messages: any[]): AddDebugLogActionType {
    return {type: DebugLogActions.ADD_DEBUG_LOG, logType, messages};
}

type DebugLogReducerActions = AddDebugLogActionType;

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

export function debugLogReducer(state: DebugLogReducerType = {enabled: false, messages: [], types: {}}, action: DebugLogReducerActions | SetLoggedInUserActionType) {
    switch (action.type) {
        case LoggedInUserActionTypes.SET_LOGGED_IN_USER:
            return {...state, enabled: action.user === null ? false: action.user.emailAddress === 'rob.rendell.au@gmail.com'};
        case DebugLogActions.ADD_DEBUG_LOG:
            if (state.enabled) {
                // Only process log messages if logging is enabled.
                const message = action.messages.map((arg) => (
                    typeof(arg) === 'object' ? JSON.stringify(arg) : arg.toString()
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