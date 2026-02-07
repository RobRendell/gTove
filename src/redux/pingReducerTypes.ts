import {NetworkedAction} from '../util/types';
import {ObjectVector3} from '../util/scenarioUtils';

export enum PingReducerActionTypes {
    ADD_PING_ACTION = 'add-ping-action',
    CLEAR_PING_ACTION = 'clear-ping-action'
}

export interface AddPingActionType extends NetworkedAction {
    type: PingReducerActionTypes.ADD_PING_ACTION;
    position: ObjectVector3;
    peerId: string;
    focusMapId?: string;
    timestamp: number;
    peerKey: string;
}

interface ClearPingActionType extends NetworkedAction {
    type: PingReducerActionTypes.CLEAR_PING_ACTION;
    peerId: string;
    peerKey: string;
}

export type PingReducerActionType = AddPingActionType | ClearPingActionType;

export interface PingReducerType {
    active: {
        [id: string]: {
            position: ObjectVector3;
            timestamp: number;
            focusMapId?: string;
        }
    }
}