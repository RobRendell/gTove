import {Action} from 'redux';

export enum MyPeerIdActionTypes {
    SET_MY_PEER_ID = 'set-my-peer-id'
}

export type MyPeerIdReducerType = string | null;

export interface SetMyPeerIdActionType extends Action {
    type: MyPeerIdActionTypes.SET_MY_PEER_ID;
    myPeerId: MyPeerIdReducerType;
}