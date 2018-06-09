import {Action, Reducer} from 'redux';

// =========================== Action types and generators

enum MyPeerIdActionTypes {
    SET_MY_PEER_ID = 'set-my-peer-id'
}

export type MyPeerIdReducerType = string | null;

interface SetMyPeerIdActionType extends Action {
    type: MyPeerIdActionTypes.SET_MY_PEER_ID;
    myPeerId: MyPeerIdReducerType;
}

export function setMyPeerIdAction(myPeerId: MyPeerIdReducerType): SetMyPeerIdActionType {
    return {type: MyPeerIdActionTypes.SET_MY_PEER_ID, myPeerId};
}

// =========================== Reducers

const myPeerIdReducer: Reducer<MyPeerIdReducerType> = (state = null, action: SetMyPeerIdActionType) => {
    switch (action.type) {
        case MyPeerIdActionTypes.SET_MY_PEER_ID:
            return action.myPeerId;
        default:
            return state;
    }
};

export default myPeerIdReducer;
