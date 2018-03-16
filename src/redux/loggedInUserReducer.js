const SET_LOGGED_IN_USER = 'set-logged-in-user';

const loggedInUserReducer = (state = null, action) => {
    switch (action.type) {
        case SET_LOGGED_IN_USER:
            return action.user;
        default:
            return state;
    }
};

export default loggedInUserReducer;

export function setLoggedInUserAction(user) {
    return {type: SET_LOGGED_IN_USER, user};
}

export function getLoggedInUserFromStore(store) {
    return store.loggedInUser;
}