const ADD_CONNECTED_USER = 'add-connected-user';
const REMOVE_CONNECTED_USER = 'remove-connected-user';

export default function connectedUserReducer(state = {}, action) {
    switch (action.type) {
        case ADD_CONNECTED_USER:
            return {...state, [action.peerId]: action.user};
        case REMOVE_CONNECTED_USER:
            const {[action.peerId]: _, ...result} = state;
            return result;
        default:
            return state;
    }
}

export function addConnectedUserAction(peerId, user) {
    return {type: ADD_CONNECTED_USER, peerId, user};
}

export function removeConnectedUserAction(peerId) {
    return {type: REMOVE_CONNECTED_USER, peerId};
}

export function getConnectedUsersFromStore(store) {
    return store.connectedUsers;
}