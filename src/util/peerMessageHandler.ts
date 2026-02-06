import {AnyAction, Store} from 'redux';
import {toast} from 'react-toastify';

import {CommsNode} from './commsNode';
import {ScenarioReducerActionType, updateHeadActionIdAction} from '../redux/scenarioReducer';
import {setLastCommonScenarioAction} from '../redux/tabletopValidationReducer';
import {
    ConnectedUserActionTypes,
    ConnectedUserReducerAction,
    removeConnectedUserAction,
    verifyConnectionAction
} from '../redux/connectedUserReducer';
import {
    getConnectedUsersFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import {isScenarioAction, NetworkedAction, NetworkedMeta} from './types';
import {isUserAllowedOnTabletop} from './scenarioUtils';
import {setTabletopIdAction} from '../redux/locationReducer';

export enum MessageTypeEnum {
    CLOSE_MESSAGE = 'close'
}

interface CloseMessage {
    message: MessageTypeEnum.CLOSE_MESSAGE;
    reason: string;
}

export function closeMessage(reason: string): CloseMessage {
    return {message: MessageTypeEnum.CLOSE_MESSAGE, reason};
}

type MessageType = CloseMessage;

async function receiveMessageFromPeer(store: Store<ReduxStoreType>, commsNode: CommsNode, peerId: string, message: MessageType) {
    switch (message.message) {
        case MessageTypeEnum.CLOSE_MESSAGE:
            // The peer has closed the connection deliberately!
            store.dispatch(setTabletopIdAction());
            if (message.reason) {
                toast(message.reason);
            }
            break;
    }
}

export async function handleConnectionActions(action: ConnectedUserReducerAction, fromPeerId: string, store: Store<ReduxStoreType>, commsNode: CommsNode) {
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            const tabletop = getTabletopFromStore(store.getState());
            const allowed = isUserAllowedOnTabletop(tabletop.gm, action.user.emailAddress, tabletop.tabletopUserControl);
            if (allowed !== null) {
                store.dispatch(verifyConnectionAction(fromPeerId, allowed));
            }
            const peerId = action.peerId;
            const isConnectionValid = await commsNode.isPeerIdValid(peerId);
            if (!isConnectionValid) {
                store.dispatch(removeConnectedUserAction(peerId));
            }
            break;
    }
}

async function receiveActionFromPeer(store: Store<ReduxStoreType>, commsNode: CommsNode, peerId: string, action: AnyAction) {
    if (!commsNode.options.shouldDispatchLocally || commsNode.options.shouldDispatchLocally(action, store.getState(), commsNode)) {
        store.dispatch(action);
    }
    if (isScenarioAction(action)) {
        store.dispatch(updateHeadActionIdAction(action));
        store.dispatch(setLastCommonScenarioAction(getScenarioFromStore(store.getState()), action as ScenarioReducerActionType));
    }
    // Handle actions when a new user connects
    await handleConnectionActions(action, peerId, store, commsNode);
}

function buildNetworkMetadata(state: ReduxStoreType, fromPeerId: string, originPeerId?: string): NetworkedMeta {
    const tabletop = getTabletopFromStore(state);
    const connectedUsers = getConnectedUsersFromStore(state).users;
    const fromGM = (connectedUsers[fromPeerId]
        && connectedUsers[fromPeerId].verifiedConnection
        && connectedUsers[fromPeerId].user.emailAddress === tabletop.gm);
    return {fromPeerId, originPeerId: originPeerId || fromPeerId, fromGM: fromGM || false};
}

export default async function peerMessageHandler(store: Store<ReduxStoreType>, peerNode: CommsNode, peerId: string, data: string): Promise<void> {
    const rawMessage = JSON.parse(data);
    // Add network metadata to the action
    const meta = buildNetworkMetadata(store.getState(), peerId, rawMessage.meta?.originPeerId || rawMessage.originPeerId);
    const message = {...rawMessage, ...meta, meta: {...rawMessage.meta, ...meta}};
    if (message.type) {
        await receiveActionFromPeer(store, peerNode, peerId, message as NetworkedAction);
    } else {
        await receiveMessageFromPeer(store, peerNode, peerId, message as MessageType);
    }
}
