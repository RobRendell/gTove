import {Action, AnyAction, combineReducers, Reducer} from 'redux';
import {randomBytes} from "crypto";
import {enc, HmacSHA256} from 'crypto-js';

import {DriveUser} from '../util/googleDriveUtils';
import {getConnectedUsersFromStore, getTabletopFromStore, ReduxStoreType} from './mainReducer';
import {DeviceLayoutReducerType} from './deviceLayoutReducer';
import {AppVersion} from '../util/appVersion';

// =========================== Action types and generators

export enum ConnectedUserActionTypes {
    ADD_CONNECTED_USER = 'add-connected-user',
    UPDATE_CONNECTED_USER = 'update-connected-user',
    IGNORE_CONNECTED_USER_VERSION = 'ignore-connected-user-version',
    REMOVE_CONNECTED_USER = 'remove-connected-user',
    REMOVE_ALL_CONNECTED_USERS = 'remove-all-connected-users',
    CHALLENGE_USER = 'challenge-user',
    CHALLENGE_RESPONSE = 'challenge-response',
    VERIFY_GM_ACTION = 'verify-gm-action',
    UPDATE_SIGNAL_ERROR = 'update-signal-error'
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

interface IgnoreConnectedUserVersionMismatchActionType extends Action {
    type: ConnectedUserActionTypes.IGNORE_CONNECTED_USER_VERSION;
    peerId: string;
}

export function ignoreConnectedUserVersionMismatchAction(peerId: string): IgnoreConnectedUserVersionMismatchActionType {
    return {type: ConnectedUserActionTypes.IGNORE_CONNECTED_USER_VERSION, peerId};
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

interface ChallengeUserActionType extends Action {
    type: ConnectedUserActionTypes.CHALLENGE_USER;
    peerId: string;
    challenge: string;
}

export function challengeUserAction(peerId: string): ChallengeUserActionType {
    return {type: ConnectedUserActionTypes.CHALLENGE_USER, peerId, challenge: randomBytes(48).toString('hex')};
}

interface ChallengeResponseActionType extends Action {
    type: ConnectedUserActionTypes.CHALLENGE_RESPONSE;
    peerId: string;
    response: string;
}

export function challengeResponseAction(peerId: string, response: string): ChallengeResponseActionType {
    return {type: ConnectedUserActionTypes.CHALLENGE_RESPONSE, peerId, response};
}

interface VerifyGMActionType extends Action {
    type: ConnectedUserActionTypes.VERIFY_GM_ACTION;
    peerId: string;
    verifiedGM: boolean;
}

export function verifyGMAction(peerId: string, verifiedGM: boolean): VerifyGMActionType {
    return {type: ConnectedUserActionTypes.VERIFY_GM_ACTION, peerId, verifiedGM};
}

interface UpdateSignalErrorActionType extends Action {
    type: ConnectedUserActionTypes.UPDATE_SIGNAL_ERROR;
    error: boolean;
}

export function updateSignalErrorAction(error: boolean): UpdateSignalErrorActionType {
    return {type: ConnectedUserActionTypes.UPDATE_SIGNAL_ERROR, error};
}

type ChallengeResponseAction = ChallengeUserActionType | ChallengeResponseActionType | VerifyGMActionType;

type ConnectedUserReducerAction = AddConnectedUserActionType | UpdateConnectedUserDeviceActionType |
    IgnoreConnectedUserVersionMismatchActionType | RemoveConnectedUserActionType | RemoveAllConnectedUsersActionType |
    ChallengeResponseAction | UpdateSignalErrorActionType;

// =========================== Reducers

interface SingleConnectedUser {
    user: DriveUser;
    version?: AppVersion;
    ignoreVersionMismatch: boolean,
    challenge: string;
    verifiedGM: null | boolean;
    deviceWidth: number;
    deviceHeight: number;
}

export type ConnectedUserUsersType = {[key: string]: SingleConnectedUser};

export interface ConnectedUserReducerType {
    signalError: boolean;
    users: ConnectedUserUsersType;
}

const connectedUserUsersReducer: Reducer<{[key: string]: SingleConnectedUser}> = (state = {}, action: ConnectedUserReducerAction) => {
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            return {...state, [action.peerId]: {
                    user: action.user,
                    version: action.version,
                    ignoreVersionMismatch: false,
                    challenge: '',
                    verifiedGM: null,
                    deviceWidth: action.deviceWidth,
                    deviceHeight: action.deviceHeight
                }
            };
        case ConnectedUserActionTypes.UPDATE_CONNECTED_USER:
            return !state[action.peerId] ? state : {...state, [action.peerId]: {
                    ...state[action.peerId],
                    deviceWidth: action.deviceWidth,
                    deviceHeight: action.deviceHeight
                }
            };
        case ConnectedUserActionTypes.IGNORE_CONNECTED_USER_VERSION:
            return !state[action.peerId] ? state : {...state, [action.peerId]: {
                    ...state[action.peerId],
                    ignoreVersionMismatch: true
                }
            };
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            const {[action.peerId]: _, ...result} = state;
            return result;
        case ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS:
            return {};
        case ConnectedUserActionTypes.CHALLENGE_USER:
            if (state[action.peerId]) {
                return {...state, [action.peerId]: {
                        ...state[action.peerId],
                        challenge: action.challenge
                    }};
            } else {
                return state;
            }
        case ConnectedUserActionTypes.VERIFY_GM_ACTION:
            if (state[action.peerId]) {
                return {...state, [action.peerId]: {
                    ...state[action.peerId],
                    verifiedGM: action.verifiedGM
                }};
            } else {
                return state;
            }
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

export function handleChallengeActions(action: ConnectedUserReducerAction, store: ReduxStoreType): ChallengeResponseAction | undefined {
    const tabletop = getTabletopFromStore(store);
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            // If I know the gm secret, challenge any user who claims to be the GM.
            return (tabletop.gmSecret && action.user.emailAddress === tabletop.gm) ? challengeUserAction(action.peerId) : undefined;
        case ConnectedUserActionTypes.CHALLENGE_USER:
            // Respond to a challenge to prove we know the gmSecret.
            const challengeHash = HmacSHA256(action.challenge, tabletop.gmSecret);
            return challengeResponseAction(action.peerId, enc.Base64.stringify(challengeHash));
        case ConnectedUserActionTypes.CHALLENGE_RESPONSE:
            // Verify the response to a challenge.
            const connectedUsers = getConnectedUsersFromStore(store);
            const responseHash = HmacSHA256(connectedUsers[action.peerId].challenge, tabletop.gmSecret);
            return verifyGMAction(action.peerId, action.response === enc.Base64.stringify(responseHash));
        default:
            return undefined;
    }
}
