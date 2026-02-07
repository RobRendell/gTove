import {omit} from 'lodash';
import {ObjectVector3} from '../util/scenarioUtils';
import {ConnectedUserActionTypes, RemoveConnectedUserActionType} from './connectedUserReducerTypes';
import {AddPingActionType, PingReducerActionType, PingReducerActionTypes, PingReducerType} from './pingReducerTypes';

// =========================== Action generators

export function addPingAction(position: ObjectVector3, peerId: string, focusMapId?: string): AddPingActionType {
    return {type: PingReducerActionTypes.ADD_PING_ACTION, position, peerId, focusMapId, timestamp: Date.now(), peerKey: 'add' + peerId};
}

export function clearPingAction(peerId: string) {
    return {type: PingReducerActionTypes.CLEAR_PING_ACTION, peerId, peerKey: 'clear' + peerId};
}

// =========================== Reducers

const initialPingReducerType: PingReducerType = {active: {}};

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