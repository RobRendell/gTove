import {Action, Reducer} from 'redux';

import {DriveUser} from '../@types/googleDrive';

// =========================== Action types and generators

enum ConnectedUserActionTypes {
    ADD_CONNECTED_USER = 'add-connected-user',
    REMOVE_CONNECTED_USER = 'remove-connected-user'
}

interface AddConnectedUserActionType extends Action {
    type: ConnectedUserActionTypes.ADD_CONNECTED_USER;
    peerId: string;
    user: DriveUser;
}

export function addConnectedUserAction(peerId: string, user: DriveUser): AddConnectedUserActionType {
    return {type: ConnectedUserActionTypes.ADD_CONNECTED_USER, peerId, user};
}

interface RemoveConnectedUserActionType extends Action {
    type: ConnectedUserActionTypes.REMOVE_CONNECTED_USER;
    peerId: string;
}

export function removeConnectedUserAction(peerId: string): RemoveConnectedUserActionType {
    return {type: ConnectedUserActionTypes.REMOVE_CONNECTED_USER, peerId};
}

type ConnectedUserReducerAction = AddConnectedUserActionType | RemoveConnectedUserActionType;

// =========================== Reducers

export type ConnectedUserReducerType = {[key: string]: DriveUser};

const connectedUserReducer: Reducer<ConnectedUserReducerType> = (state = {}, action: ConnectedUserReducerAction) => {
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            return {...state, [action.peerId]: action.user};
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            const {[action.peerId]: _, ...result} = state;
            return result;
        default:
            return state;
    }
};

export default connectedUserReducer;
