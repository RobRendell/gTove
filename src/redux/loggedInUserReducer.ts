import {Action, Reducer} from 'redux';

import {User} from '../@types/googleDrive';

// =========================== Action types and generators

enum LoggedInUserActionTypes {
    SET_LOGGED_IN_USER = 'set-logged-in-user'
}

interface SetLoggedInUserActionType extends Action {
    type: LoggedInUserActionTypes.SET_LOGGED_IN_USER;
    user: User;
}

export function setLoggedInUserAction(user: User): SetLoggedInUserActionType {
    return {type: LoggedInUserActionTypes.SET_LOGGED_IN_USER, user};
}

// =========================== Reducers

const loggedInUserReducer: Reducer<User | null> = (state = null, action: SetLoggedInUserActionType) => {
    switch (action.type) {
        case LoggedInUserActionTypes.SET_LOGGED_IN_USER:
            return action.user;
        default:
            return state;
    }
};

export default loggedInUserReducer;
