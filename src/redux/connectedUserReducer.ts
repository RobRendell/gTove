import {Action, Reducer} from 'redux';
import {randomBytes} from "crypto";
import {enc, HmacSHA256} from 'crypto-js';

import {DriveUser} from '../util/googleDriveUtils';
import {getConnectedUsersFromStore, getTabletopFromStore, ReduxStoreType} from './mainReducer';

// =========================== Action types and generators

enum ConnectedUserActionTypes {
    ADD_CONNECTED_USER = 'add-connected-user',
    REMOVE_CONNECTED_USER = 'remove-connected-user',
    CHALLENGE_USER = 'challenge-user',
    CHALLENGE_RESPONSE = 'challenge-response',
    VERIFY_GM_ACTION = 'verify-gm-action'
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

type ChallengeResponseAction = ChallengeUserActionType | ChallengeResponseActionType | VerifyGMActionType;

type ConnectedUserReducerAction = AddConnectedUserActionType | RemoveConnectedUserActionType | ChallengeResponseAction;

// =========================== Reducers

interface SingleConnectedUser {
    user: DriveUser;
    challenge: string;
    verifiedGM: null | boolean;
}

export type ConnectedUserReducerType = {[key: string]: SingleConnectedUser};

const connectedUserReducer: Reducer<ConnectedUserReducerType> = (state = {}, action: ConnectedUserReducerAction) => {
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            return {...state, [action.peerId]: {
                user: action.user,
                challenge: '',
                verifiedGM: null
            }};
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            const {[action.peerId]: _, ...result} = state;
            return result;
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
