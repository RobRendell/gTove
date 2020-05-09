import {Action, AnyAction, combineReducers, Reducer} from 'redux';
import {randomBytes} from 'crypto';

import {DriveUser} from '../util/googleDriveUtils';
import {DeviceLayoutReducerType} from './deviceLayoutReducer';
import {AppVersion} from '../util/appVersion';
import {NetworkedAction} from '../util/types';
import {TabletopReducerActionTypes, UpdateTabletopAction} from './tabletopReducer';

// =========================== Action types and generators

export enum ConnectedUserActionTypes {
    ADD_CONNECTED_USER = 'add-connected-user',
    UPDATE_CONNECTED_USER = 'update-connected-user',
    REMOVE_CONNECTED_USER = 'remove-connected-user',
    REMOVE_ALL_CONNECTED_USERS = 'remove-all-connected-users',
    CHALLENGE_USER = 'challenge-user',
    CHALLENGE_RESPONSE = 'challenge-response',
    VERIFY_CONNECTION_ACTION = 'verify-connection-action',
    VERIFY_GM_ACTION = 'verify-gm-action',
    UPDATE_SIGNAL_ERROR = 'update-signal-error',
    SET_USER_ALLOWED = 'set-user-allowed'
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
    peerKey: string;
}

export function removeConnectedUserAction(peerId: string): RemoveConnectedUserActionType {
    return {type: ConnectedUserActionTypes.REMOVE_CONNECTED_USER, peerId, peerKey: 'removeUser' + peerId};
}

interface RemoveAllConnectedUsersActionType extends Action {
    type: ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS;
}

export function removeAllConnectedUsersAction(): RemoveAllConnectedUsersActionType {
    return {type: ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS};
}

interface ChallengeUserActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.CHALLENGE_USER;
    peerId: string;
    challenge: string;
    private: true;
}

export function challengeUserAction(peerId: string): ChallengeUserActionType {
    return {type: ConnectedUserActionTypes.CHALLENGE_USER, peerId, challenge: randomBytes(48).toString('hex'), private: true};
}

interface ChallengeResponseActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.CHALLENGE_RESPONSE;
    peerId: string;
    response: string;
    private: true;
}

export function challengeResponseAction(peerId: string, response: string): ChallengeResponseActionType {
    return {type: ConnectedUserActionTypes.CHALLENGE_RESPONSE, peerId, response, private: true};
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

interface VerifyGMActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.VERIFY_GM_ACTION;
    peerId: string;
    verifiedGM: boolean;
    private: true;
}

export function verifyGMAction(peerId: string, verifiedGM: boolean): VerifyGMActionType {
    return {type: ConnectedUserActionTypes.VERIFY_GM_ACTION, peerId, verifiedGM, private: true};
}

interface UpdateSignalErrorActionType extends Action {
    type: ConnectedUserActionTypes.UPDATE_SIGNAL_ERROR;
    error: boolean;
}

export function updateSignalErrorAction(error: boolean): UpdateSignalErrorActionType {
    return {type: ConnectedUserActionTypes.UPDATE_SIGNAL_ERROR, error};
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

type LocalOnlyAction = ChallengeUserActionType | ChallengeResponseActionType | VerifyConnectionActionType | VerifyGMActionType | SetUserAllowedActionType;

export type ConnectedUserReducerAction = AddConnectedUserActionType | UpdateConnectedUserDeviceActionType |
    RemoveConnectedUserActionType | RemoveAllConnectedUsersActionType | LocalOnlyAction | UpdateSignalErrorActionType;

// =========================== Reducers

interface SingleConnectedUser {
    user: DriveUser;
    version?: AppVersion;
    challenge: string;
    verifiedConnection: null | boolean;
    verifiedGM: null | boolean;
    checkedForTabletop: boolean;
    deviceWidth: number;
    deviceHeight: number;
}

export type ConnectedUserUsersType = {[key: string]: SingleConnectedUser};

export interface ConnectedUserReducerType {
    signalError: boolean;
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

const connectedUserUsersReducer: Reducer<{[key: string]: SingleConnectedUser}> = (state = {}, action: ConnectedUserReducerAction | UpdateTabletopAction) => {
    // We need to be picky about what fields we allow actions to update, for security.
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            return {...state, [action.peerId]: {
                    user: action.user,
                    version: action.version,
                    challenge: '',
                    verifiedConnection: null,
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
        case ConnectedUserActionTypes.CHALLENGE_USER:
            return localOnlyUpdate(state, action, {challenge: action.challenge});
        case ConnectedUserActionTypes.VERIFY_CONNECTION_ACTION:
            return localOnlyUpdate(state, action, {verifiedConnection: action.verifiedConnection});
        case ConnectedUserActionTypes.VERIFY_GM_ACTION:
            return localOnlyUpdate(state, action, {verifiedGM: action.verifiedGM});
        case ConnectedUserActionTypes.SET_USER_ALLOWED:
            return action.allowed
                ? localOnlyUpdate(state, action, {checkedForTabletop: true, verifiedConnection: true})
                : localOnlyUpdate(state, action, {checkedForTabletop: true, verifiedConnection: false});
        case TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION:
            // Clear checkedForTabletop for everyone
            return Object.keys(state).reduce((nextState, peerId) => {
                nextState[peerId] = {...state[peerId], checkedForTabletop: false};
                return nextState;
            }, {});
        default:
            return state;
    }
};

const signalErrorReducer: Reducer<boolean> = (state: boolean = false, action: UpdateSignalErrorActionType | AnyAction) => {
    switch (action.type) {
        case ConnectedUserActionTypes.UPDATE_SIGNAL_ERROR:
            return action.error;
        default:
            return state;
    }
};

const connectedUserReducer = combineReducers<ConnectedUserReducerType>({
    users: connectedUserUsersReducer,
    signalError: signalErrorReducer
});

export default connectedUserReducer;

// =========================== Utility

export function isAllowedUnverifiedAction(action: AnyAction) {
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
        case ConnectedUserActionTypes.CHALLENGE_USER:
            return true;
        default:
            return false;
    }
}