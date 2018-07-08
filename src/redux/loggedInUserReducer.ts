import {Action, Reducer} from 'redux';

import {DriveUser} from '../util/googleDriveUtils';

// =========================== Action types and generators

enum LoggedInUserActionTypes {
    SET_LOGGED_IN_USER = 'set-logged-in-user'
}

export type LoggedInUserReducerType = DriveUser | null;

interface SetLoggedInUserActionType extends Action {
    type: LoggedInUserActionTypes.SET_LOGGED_IN_USER;
    user: LoggedInUserReducerType;
}

export function setLoggedInUserAction(user: LoggedInUserReducerType): SetLoggedInUserActionType {
    return {type: LoggedInUserActionTypes.SET_LOGGED_IN_USER, user};
}

// =========================== Reducers

const loggedInUserReducer: Reducer<LoggedInUserReducerType> = (state = null, action: SetLoggedInUserActionType) => {
    switch (action.type) {
        case LoggedInUserActionTypes.SET_LOGGED_IN_USER:
            return action.user;
        default:
            return state;
    }
};

export default loggedInUserReducer;
