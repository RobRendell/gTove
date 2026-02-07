import {AnyAction, combineReducers, Reducer} from 'redux';

import {DriveUser} from '../util/storage/providers/google/googleDriveUtils';
import {AppVersion} from '../util/appVersion';
import {
    AddConnectedUserActionType,
    ConnectedUserActionTypes,
    ConnectedUserReducerAction,
    ConnectedUserReducerType,
    ConnectedUserRuler,
    LocalOnlyAction,
    RemoveAllConnectedUsersActionType,
    RemoveConnectedUserActionType,
    SetUserAllowedActionType,
    SingleConnectedUser,
    UpdateConnectedUserDeviceActionType,
    UpdateUserRulerActionType,
    VerifyConnectionActionType
} from './connectedUserReducerTypes';
import {DeviceLayoutReducerType} from './deviceLayoutReducerTypes';
import {TabletopReducerActionTypes, UpdateTabletopAction} from './tabletopReducerTypes';

// =========================== Action generators

export function addConnectedUserAction(peerId: string, user: DriveUser, version: AppVersion, deviceWidth: number, deviceHeight: number, deviceLayout: DeviceLayoutReducerType): AddConnectedUserActionType {
    return {type: ConnectedUserActionTypes.ADD_CONNECTED_USER, peerId, user, version, deviceWidth, deviceHeight, deviceLayout};
}

export function updateConnectedUserDeviceAction(peerId: string, deviceWidth: number, deviceHeight: number): UpdateConnectedUserDeviceActionType {
    return {type: ConnectedUserActionTypes.UPDATE_CONNECTED_USER, peerId, peerKey: 'device' + peerId, deviceWidth, deviceHeight};
}

export function removeConnectedUserAction(peerId: string): RemoveConnectedUserActionType {
    return {type: ConnectedUserActionTypes.REMOVE_CONNECTED_USER, peerId};
}

export function removeAllConnectedUsersAction(): RemoveAllConnectedUsersActionType {
    return {type: ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS};
}

export function verifyConnectionAction(peerId: string, verifiedConnection: boolean): VerifyConnectionActionType {
    return {type: ConnectedUserActionTypes.VERIFY_CONNECTION_ACTION, peerId, verifiedConnection, private: true};
}

export function setUserAllowedAction(peerId: string, allowed: boolean): SetUserAllowedActionType {
    return {type: ConnectedUserActionTypes.SET_USER_ALLOWED, peerId, allowed, private: true};
}

export function updateUserRulerAction(peerId: string, ruler?: ConnectedUserRuler): UpdateUserRulerActionType {
    return {type: ConnectedUserActionTypes.UPDATE_USER_RULER, peerId, ruler, peerKey: 'ruler_' + peerId};
}

// =========================== Reducers

function localOnlyUpdate(state: {[key: string]: SingleConnectedUser}, action: LocalOnlyAction, update: Partial<SingleConnectedUser>) {
    // Only allow actions which originate locally to update the state.
    if (!action.fromPeerId && state[action.peerId]) {
        return {...state, [action.peerId]: {
                ...state[action.peerId],
                ...update
            }};
    } else {
        return state;
    }
}

const connectedUserUsersReducer: Reducer<{[key: string]: SingleConnectedUser}> =
(state = {}, action: ConnectedUserReducerAction | UpdateTabletopAction): {[key: string]: SingleConnectedUser} => {
    // We need to be picky about what fields we allow actions to update, for security.
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            return {...state, [action.peerId]: {
                    user: action.user,
                    version: action.version,
                    challenge: '',
                    verifiedConnection: action.user.emailAddress && !(action as any)['fromPeerId'] ? true : null,
                    verifiedGM: null,
                    checkedForTabletop: false,
                    deviceWidth: action.deviceWidth,
                    deviceHeight: action.deviceHeight,
                }
            };
        case ConnectedUserActionTypes.UPDATE_CONNECTED_USER:
            return !state[action.peerId] ? state : {...state, [action.peerId]: {
                    ...state[action.peerId],
                    deviceWidth: action.deviceWidth,
                    deviceHeight: action.deviceHeight
                }
            };
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            const {[action.peerId]: _, ...result} = state;
            return result;
        case ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS:
            return {};
        case ConnectedUserActionTypes.VERIFY_CONNECTION_ACTION:
            return localOnlyUpdate(state, action, {verifiedConnection: action.verifiedConnection});
        case ConnectedUserActionTypes.SET_USER_ALLOWED:
            return action.allowed
                ? localOnlyUpdate(state, action, {checkedForTabletop: true, verifiedConnection: true})
                : localOnlyUpdate(state, action, {checkedForTabletop: true, verifiedConnection: false});
        case TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION:
            // Clear checkedForTabletop for everyone
            return Object.keys(state).reduce((nextState: {[key: string]: SingleConnectedUser}, peerId) => {
                (nextState as any)[peerId] = {...state[peerId], checkedForTabletop: false};
                return nextState;
            }, {} as {[key: string]: SingleConnectedUser}) ;
        case ConnectedUserActionTypes.UPDATE_USER_RULER:
            return !state[action.peerId] ? state : {...state, [action.peerId]: {
                    ...state[action.peerId],
                    ruler: action.ruler
                }
            };
        default:
            return state;
    }
};

const connectedUserReducer = combineReducers<ConnectedUserReducerType>({
    users: connectedUserUsersReducer
});

export default connectedUserReducer;

// =========================== Utility

export function isAllowedUnverifiedAction(action: AnyAction) {
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            return true;
        default:
            return false;
    }
}