import {Action, AnyAction, combineReducers, Reducer} from 'redux';

import {DriveUser} from '../util/storage/providers/google/googleDriveUtils';
import {DeviceLayoutReducerType} from './deviceLayoutReducer';
import {AppVersion} from '../util/appVersion';
import {NetworkedAction} from '../util/types';
import {TabletopReducerActionTypes, UpdateTabletopAction} from './tabletopReducer';
import {TabletopPathPoint} from '../presentation/tabletopPathComponent';
import {ObjectVector3} from '../util/scenarioUtils';

// =========================== Action types and generators

export enum ConnectedUserActionTypes {
    ADD_CONNECTED_USER = 'add-connected-user',
    UPDATE_CONNECTED_USER = 'update-connected-user',
    REMOVE_CONNECTED_USER = 'remove-connected-user',
    REMOVE_ALL_CONNECTED_USERS = 'remove-all-connected-users',
    VERIFY_CONNECTION_ACTION = 'verify-connection-action',
    SET_USER_ALLOWED = 'set-user-allowed',
    UPDATE_USER_RULER = 'update-user-ruler'
}

export interface AddConnectedUserActionType extends Action {
    type: ConnectedUserActionTypes.ADD_CONNECTED_USER;
    peerId: string;
    user: DriveUser;
    version: AppVersion;
    deviceWidth: number;
    deviceHeight: number;
    deviceLayout: DeviceLayoutReducerType;
}

export function addConnectedUserAction(peerId: string, user: DriveUser, version: AppVersion, deviceWidth: number, deviceHeight: number, deviceLayout: DeviceLayoutReducerType): AddConnectedUserActionType {
    return {type: ConnectedUserActionTypes.ADD_CONNECTED_USER, peerId, user, version, deviceWidth, deviceHeight, deviceLayout};
}

interface UpdateConnectedUserDeviceActionType extends Action {
    type: ConnectedUserActionTypes.UPDATE_CONNECTED_USER;
    peerId: string;
    peerKey: string;
    deviceWidth: number;
    deviceHeight: number;
}

export function updateConnectedUserDeviceAction(peerId: string, deviceWidth: number, deviceHeight: number): UpdateConnectedUserDeviceActionType {
    return {type: ConnectedUserActionTypes.UPDATE_CONNECTED_USER, peerId, peerKey: 'device' + peerId, deviceWidth, deviceHeight};
}

export interface RemoveConnectedUserActionType extends Action {
    type: ConnectedUserActionTypes.REMOVE_CONNECTED_USER;
    peerId: string;
}

export function removeConnectedUserAction(peerId: string): RemoveConnectedUserActionType {
    return {type: ConnectedUserActionTypes.REMOVE_CONNECTED_USER, peerId};
}

interface RemoveAllConnectedUsersActionType extends Action {
    type: ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS;
}

export function removeAllConnectedUsersAction(): RemoveAllConnectedUsersActionType {
    return {type: ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS};
}

interface VerifyConnectionActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.VERIFY_CONNECTION_ACTION;
    peerId: string;
    verifiedConnection: boolean;
    private: true;
}

export function verifyConnectionAction(peerId: string, verifiedConnection: boolean): VerifyConnectionActionType {
    return {type: ConnectedUserActionTypes.VERIFY_CONNECTION_ACTION, peerId, verifiedConnection, private: true};
}

interface SetUserAllowedActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.SET_USER_ALLOWED;
    peerId: string;
    allowed: boolean;
    private: true;
}

export function setUserAllowedAction(peerId: string, allowed: boolean): SetUserAllowedActionType {
    return {type: ConnectedUserActionTypes.SET_USER_ALLOWED, peerId, allowed, private: true};
}

interface UpdateUserRulerActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.UPDATE_USER_RULER;
    peerId: string;
    ruler?: ConnectedUserRuler;
    peerKey: string;
}

export function updateUserRulerAction(peerId: string, ruler?: ConnectedUserRuler): UpdateUserRulerActionType {
    return {type: ConnectedUserActionTypes.UPDATE_USER_RULER, peerId, ruler, peerKey: 'ruler_' + peerId};
}

type LocalOnlyAction = VerifyConnectionActionType | SetUserAllowedActionType;

export type ConnectedUserReducerAction = AddConnectedUserActionType | UpdateConnectedUserDeviceActionType |
    RemoveConnectedUserActionType | RemoveAllConnectedUsersActionType | LocalOnlyAction | UpdateUserRulerActionType;

// =========================== Reducers

interface ConnectedUserRuler {
    start: TabletopPathPoint;
    end: ObjectVector3;
    distance: string;
    mapId?: string;
}

interface SingleConnectedUser {
    user: DriveUser;
    version?: AppVersion;
    challenge: string;
    verifiedConnection: null | boolean;
    verifiedGM: null | boolean;
    checkedForTabletop: boolean;
    deviceWidth: number;
    deviceHeight: number;
    ruler?: ConnectedUserRuler;
}

export type ConnectedUserUsersType = {[key: string]: SingleConnectedUser};

export interface ConnectedUserReducerType {
    users: ConnectedUserUsersType;
}

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