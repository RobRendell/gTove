import {MyPeerIdActionTypes, MyPeerIdReducerType, SetMyPeerIdActionType} from './myPeerIdReducerTypes';

// =========================== Action generators

export function setMyPeerIdAction(myPeerId: MyPeerIdReducerType): SetMyPeerIdActionType {
    return {type: MyPeerIdActionTypes.SET_MY_PEER_ID, myPeerId};
}

// =========================== Reducers

function myPeerIdReducer(state: MyPeerIdReducerType = null, action: SetMyPeerIdActionType) {
    switch (action.type) {
        case MyPeerIdActionTypes.SET_MY_PEER_ID:
            return action.myPeerId;
        default:
            return state;
    }
}

export default myPeerIdReducer;
