import {LoggedInUserActionTypes, LoggedInUserReducerType, SetLoggedInUserActionType} from './loggedInUserReducerTypes';

export function setLoggedInUserAction(user: LoggedInUserReducerType): SetLoggedInUserActionType {
    return {type: LoggedInUserActionTypes.SET_LOGGED_IN_USER, user};
}

function loggedInUserReducer(state: LoggedInUserReducerType = null, action: SetLoggedInUserActionType) {
    switch (action.type) {
        case LoggedInUserActionTypes.SET_LOGGED_IN_USER:
            // Ignore this action if it doesn't originate locally
            return action.fromPeerId ? state : action.user;
        default:
            return state;
    }
}

export default loggedInUserReducer;
