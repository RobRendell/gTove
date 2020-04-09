import {omit} from 'lodash';

import {NetworkedAction} from '../util/types';
import {ObjectVector3} from '../util/scenarioUtils';
import {ConnectedUserActionTypes, RemoveConnectedUserActionType} from './connectedUserReducer';

// =========================== Action types and generators

enum PingReducerActionTypes {
    ADD_PING_ACTION = 'add-ping-action',
    CLEAR_PING_ACTION = 'clear-ping-action'
}

interface AddPingActionType extends NetworkedAction {
    type: PingReducerActionTypes.ADD_PING_ACTION;
    position: ObjectVector3;
    peerId: string;
    focusMapId?: string;
    timestamp: number;
    peerKey: string;
}

export function addPingAction(position: ObjectVector3, peerId: string, focusMapId?: string): AddPingActionType {
    return {type: PingReducerActionTypes.ADD_PING_ACTION, position, peerId, focusMapId, timestamp: Date.now(), peerKey: 'add' + peerId};
}

interface ClearPingActionType extends NetworkedAction {
    type: PingReducerActionTypes.CLEAR_PING_ACTION;
    peerId: string;
    peerKey: string;
}

export function clearPingAction(peerId: string) {
    return {type: PingReducerActionTypes.CLEAR_PING_ACTION, peerId, peerKey: 'clear' + peerId};
}

type PingReducerActionType = AddPingActionType | ClearPingActionType;

// =========================== Reducers

export interface PingReducerType {
    active: {
        [id: string] : {
            position: ObjectVector3;
            timestamp: number;
            focusMapId?: string;
        }
    }
}

const initialPingReducerType = {active: {}};

export default function pingReducer(state: PingReducerType = initialPingReducerType, action: PingReducerActionType | RemoveConnectedUserActionType): PingReducerType {
    switch (action.type) {
        case PingReducerActionTypes.ADD_PING_ACTION:
            return {
                ...state,
                active: {
                    ...state.active,
                    [action.peerId]: {position: action.position, timestamp: action.timestamp, focusMapId: action.focusMapId}
                }
            };
        case PingReducerActionTypes.CLEAR_PING_ACTION:
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            return {
                ...state,
                active: omit(state.active, action.peerId)
            };
        default:
            return state;
    }
}