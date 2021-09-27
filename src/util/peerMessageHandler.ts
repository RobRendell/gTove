import {AnyAction, Store} from 'redux';
import {toast} from 'react-toastify';

import {CommsNode} from './commsNode';
import {ScenarioReducerActionType, setScenarioLocalAction, updateHeadActionIdsAction} from '../redux/scenarioReducer';
import {promiseSleep} from './promiseSleep';
import {
    addPendingActionAction,
    discardPendingActionAction,
    setLastCommonScenarioAction,
    TabletopValidationType
} from '../redux/tabletopValidationReducer';
import {
    addConnectedUserAction,
    challengeResponseAction,
    challengeUserAction,
    ConnectedUserActionTypes, ConnectedUserReducerAction, verifyConnectionAction,
    verifyGMAction
} from '../redux/connectedUserReducer';
import {
    getConnectedUsersFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopValidationFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import {isScenarioAction, NetworkedAction, NetworkedMeta} from './types';
import {getNetworkHubId, isUserAllowedOnTabletop, scenarioToJson} from './scenarioUtils';
import {enc, HmacSHA256} from 'crypto-js';
import {setTabletopIdAction} from '../redux/locationReducer';

export enum MessageTypeEnum {
    CHECK_ACTIONS_MESSAGE = 'check-actions',
    MISSING_ACTION_MESSAGE = 'missing-action',
    RESEND_ACTIONS_MESSAGE = 'resend-actions',
    CLOSE_MESSAGE = 'close'
}

interface CheckActionsMessageType {
    message: MessageTypeEnum.CHECK_ACTIONS_MESSAGE;
    headActionIds: string[];
}

export function checkActionsMessage(headActionIds: string[]): CheckActionsMessageType {
    return {message: MessageTypeEnum.CHECK_ACTIONS_MESSAGE, headActionIds};
}

interface MissingActionMessageType {
    message: MessageTypeEnum.MISSING_ACTION_MESSAGE;
    actionId?: string;
    missingActionIds: string[];
    knownActionIds: string[];
}

export function missingActionMessage(missingActionIds: string[], knownActionIds: string[], actionId?: string): MissingActionMessageType {
    return {message: MessageTypeEnum.MISSING_ACTION_MESSAGE, missingActionIds, knownActionIds, actionId};
}

type AncestorActions = {[actionId: string]: AnyAction} | null;

interface ResendActionsMessage {
    message: MessageTypeEnum.RESEND_ACTIONS_MESSAGE;
    pendingActionId?: string;
    missingActionIds: string[];
    actions: AncestorActions;
}

export function resendActionsMessage(missingActionIds: string[], actions: AncestorActions, pendingActionId?: string): ResendActionsMessage {
    return {message: MessageTypeEnum.RESEND_ACTIONS_MESSAGE, missingActionIds, actions, pendingActionId};
}

interface CloseMessage {
    message: MessageTypeEnum.CLOSE_MESSAGE;
    reason: string;
}

export function closeMessage(reason: string): CloseMessage {
    return {message: MessageTypeEnum.CLOSE_MESSAGE, reason};
}

type MessageType = CheckActionsMessageType | MissingActionMessageType | ResendActionsMessage | CloseMessage;

function findAncestorActions(validation: TabletopValidationType, knownActionIds: {[actionId: string]: boolean}, actionIds: string[], result: AncestorActions = {}): AncestorActions {
    return actionIds.reduce((all, actionId) => {
        if (all && !knownActionIds[actionId] && !all[actionId]) {
            const action = validation.actionHistory[actionId];
            if (!action) {
                return null;
            }
            all[actionId] = action;
            if (isScenarioAction(action)) {
                return findAncestorActions(validation, knownActionIds, action.headActionIds, result);
            }
        }
        return all;
    }, result);
}

function postOrderActions(root: AnyAction, actions: {[actionId: string]: AnyAction}): AnyAction[] {
    if (root.headActionIds) {
        return [...root.headActionIds.reduce((all: AnyAction[], actionId: string) => {
            const action = actions[actionId];
            if (action) {
                delete(actions[actionId]);
                all.push(...postOrderActions(action, actions));
            }
            return all;
        }, []), root];
    } else {
        return [root];
    }
}

async function sendScenarioState(state: ReduxStoreType, commsNode: CommsNode, peerId: string) {
    const [fullScenario, playerScenario] = scenarioToJson(getScenarioFromStore(state));
    const peerUser = getConnectedUsersFromStore(state).users[peerId];
    const scenario = peerUser.verifiedGM ? fullScenario : playerScenario;
    await commsNode.sendTo({...setScenarioLocalAction(scenario), gmOnly: peerUser.verifiedGM}, {only: [peerId]});
}

async function receiveMessageFromPeer(store: Store<ReduxStoreType>, commsNode: CommsNode, peerId: string, message: MessageType) {
    const state = store.getState();
    let validation = getTabletopValidationFromStore(state);
    const loggedInUser = getLoggedInUserFromStore(state)!;
    switch (message.message) {
        case MessageTypeEnum.CHECK_ACTIONS_MESSAGE:
            const missingActionIds = findMissingActionIds(validation, message.headActionIds);
            if (missingActionIds.length > 0) {
                const knownActionIds = Object.keys(validation.actionHistory).concat(Object.keys(validation.initialActionIds));
                await commsNode.sendTo(missingActionMessage(missingActionIds, knownActionIds), {only: [peerId]});
            }
            break;
        case MessageTypeEnum.MISSING_ACTION_MESSAGE:
            // Create a map of known actionIds to make checking faster
            const knownActionIds = message.knownActionIds.reduce((all, actionId) => {
                all[actionId] = true;
                return all;
            }, {});
            // Accumulate the missing actions required to fill in the peer's gaps.
            const resendActions = findAncestorActions(validation, knownActionIds, message.missingActionIds);
            if (resendActions === null && loggedInUser.emailAddress === getTabletopFromStore(state).gm) {
                // If we can't resolve their gaps, and we're a GM, simply assert our state.
                await sendScenarioState(state, commsNode, peerId);
            } else {
                // Otherwise, send them back the actions they missed, or null if we can't fill the gaps.
                await commsNode.sendTo(resendActionsMessage(message.missingActionIds, resendActions, message.actionId), {only: [peerId]});
            }
            break;
        case MessageTypeEnum.RESEND_ACTIONS_MESSAGE:
            if (message.actions === null) {
                // They can't explain the missing actions - assert our state.
                await sendScenarioState(state, commsNode, peerId);
                if (message.pendingActionId) {
                    // Discard the pending action.
                    store.dispatch(discardPendingActionAction(message.pendingActionId));
                }
                return;
            }
            // Add the pending action, if any, to the set of actions returned to us, and dispatch them all in order.
            const pendingAction = message.pendingActionId ? validation.pendingActions[message.pendingActionId] : undefined;
            const dispatchActions = pendingAction ? {...message.actions, [pendingAction.actionId]: pendingAction} : message.actions;
            const actionIds = message.pendingActionId ? [message.pendingActionId] : message.missingActionIds;
            for (let pendingActionId of actionIds) {
                if (!dispatchActions[pendingActionId]) {
                    // Undo/redo can cause actions to be lost from tabletopValidation.
                    continue;
                }
                const orderedActions = postOrderActions(dispatchActions[pendingActionId], dispatchActions);
                for (let action of orderedActions) {
                    // Verify that we know the headActionIds of action.
                    if (isScenarioAction(action)) {
                        // NB we need to get tabletopValidation from the latest store state.
                        validation = getTabletopValidationFromStore(store.getState());
                        const missingActionIds = findMissingActionIds(validation, action.headActionIds);
                        if (missingActionIds.length > 0) {
                            console.error('Still have unknown action IDs - this should not happen');
                            // Ok, give up.
                            if (loggedInUser.emailAddress === getTabletopFromStore(state).gm) {
                                // If we're a GM, assert our scenario state.
                                await sendScenarioState(store.getState(), commsNode, peerId);
                                if (message.pendingActionId) {
                                    // Discard the pending action.
                                    store.dispatch(discardPendingActionAction(message.pendingActionId));
                                }
                            } else {
                                // Otherwise ask them to assert their scenario state.
                                await commsNode.sendTo(resendActionsMessage([], null), {only: [peerId]});
                            }
                            return;
                        }
                    }
                    // Dispatch the action, but remove peerKey and mark private so it isn't automatically sent on.
                    await dispatchGoodAction(store, commsNode, peerId, {...action, peerKey: undefined, private: true});
                }
            }
            break;
        case MessageTypeEnum.CLOSE_MESSAGE:
            // The peer has closed the connection deliberately!
            store.dispatch(setTabletopIdAction());
            if (message.reason) {
                toast(message.reason);
            }
            break;
    }
}

function findMissingActionIds(validation: TabletopValidationType, headActionIds: string[]) {
    return headActionIds.filter((actionId) => (!validation.actionHistory[actionId] && !validation.initialActionIds[actionId]));
}

export async function handleConnectionActions(action: ConnectedUserReducerAction, fromPeerId: string, store: Store<ReduxStoreType>, commsNode: CommsNode) {
    const tabletop = getTabletopFromStore(store.getState());
    switch (action.type) {
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            // If I know the gm secret, challenge any user who claims to be the GM.
            if (tabletop.gmSecret && action.user.emailAddress === tabletop.gm
                && !getConnectedUsersFromStore(store.getState()).users[action.peerId].verifiedGM) {
                const challengeAction = challengeUserAction(fromPeerId);
                store.dispatch(challengeAction);
                await commsNode.sendTo(challengeAction, {only: [fromPeerId]});
            } else {
                // TODO need some actual validation mechanism to prove identity before we blithely believe their email address.
                const tabletop = getTabletopFromStore(store.getState());
                const allowed = isUserAllowedOnTabletop(tabletop.gm, action.user.emailAddress, tabletop.tabletopUserControl);
                if (allowed !== null) {
                    store.dispatch(verifyConnectionAction(fromPeerId, allowed));
                }
                // Send a message to trigger the new client to perform a missing action check.
                const playerTabletopValidation = getTabletopValidationFromStore(store.getState());
                if (playerTabletopValidation.lastCommonScenario) {
                    await commsNode.sendTo(checkActionsMessage(playerTabletopValidation.lastCommonScenario.playerHeadActionIds), {only: [fromPeerId]});
                }
            }
            break;
        case ConnectedUserActionTypes.CHALLENGE_USER:
            if (!action.challenge) {
                throw new Error('no challenge in action ' + JSON.stringify(action));
            }
            if (!tabletop.gmSecret) {
                throw new Error('no gmSecret in tabletop ' + JSON.stringify(tabletop));
            }
            // Respond to a challenge to prove we know the gmSecret.
            const challengeHash = HmacSHA256(action.challenge, tabletop.gmSecret);
            const responseAction = challengeResponseAction(fromPeerId, enc.Base64.stringify(challengeHash));
            await commsNode.sendTo(responseAction, {only: [fromPeerId]});
            break;
        case ConnectedUserActionTypes.CHALLENGE_RESPONSE:
            // Verify the response to a challenge.
            const connectedUsers = getConnectedUsersFromStore(store.getState()).users;
            const responseHash = HmacSHA256(connectedUsers[fromPeerId].challenge, tabletop.gmSecret);
            if (action.response === enc.Base64.stringify(responseHash)) {
                store.dispatch(verifyConnectionAction(fromPeerId, true));
                store.dispatch(verifyGMAction(fromPeerId, true));
                // Send a message to trigger the new client to perform a missing action check.
                const tabletopValidation = getTabletopValidationFromStore(store.getState());
                if (tabletopValidation.lastCommonScenario) {
                    await commsNode.sendTo(checkActionsMessage(tabletopValidation.lastCommonScenario.headActionIds), {only: [fromPeerId]});
                }
            }
            break;
    }
}

async function receiveActionFromPeer(store: Store<ReduxStoreType>, commsNode: CommsNode, peerId: string, action: NetworkedAction) {
    if (isScenarioAction(action)) {
        // Check that we know the action's headActionIds.
        let validation = getTabletopValidationFromStore(store.getState());
        let missingActionIds = findMissingActionIds(validation, action.headActionIds);
        if (missingActionIds.length > 0) {
            // Wait a short time in case those actions arrive by themselves.
            await promiseSleep(500);
            validation = getTabletopValidationFromStore(store.getState());
            missingActionIds = findMissingActionIds(validation, action.headActionIds);
            if (missingActionIds.length > 0) {
                // Some actions are still unknown.  We need to ask the peer for them.
                store.dispatch(addPendingActionAction(action));
                const knownActionIds = Object.keys(validation.actionHistory).concat(Object.keys(validation.initialActionIds));
                await commsNode.sendTo(missingActionMessage(missingActionIds, knownActionIds, action.actionId), {only: [peerId]});
                return;
            }
        }
    }
    // All good - dispatch action
    await dispatchGoodAction(store, commsNode, peerId, action);
}

async function dispatchGoodAction(store: Store<ReduxStoreType>, commsNode: CommsNode, peerId: string, action: AnyAction) {
    if (!commsNode.options.shouldDispatchLocally || commsNode.options.shouldDispatchLocally(action, store.getState(), commsNode)) {
        store.dispatch(action);
    }
    if (isScenarioAction(action)) {
        store.dispatch(updateHeadActionIdsAction(action));
        store.dispatch(setLastCommonScenarioAction(getScenarioFromStore(store.getState()), action as ScenarioReducerActionType));
    }
    // Handle actions when a new user connects
    await handleConnectionActions(action, peerId, store, commsNode);
    const state = store.getState();
    if (!action.private && commsNode.peerId === getNetworkHubId(commsNode.userId, commsNode.peerId, getTabletopFromStore(state).gm, getConnectedUsersFromStore(state).users)) {
        // Network hub needs to forward good actions to other clients.
        const connectedUsers = getConnectedUsersFromStore(state).users;
        const only = Object.keys(connectedUsers)
            .filter((peerId) => (peerId !== action.fromPeerId
                && (!action.gmOnly || connectedUsers[peerId].verifiedGM)
                && (action.type !== ConnectedUserActionTypes.ADD_CONNECTED_USER || peerId !== action.peerId)
            ));
        await commsNode.sendTo(action, {only});
        // Hub also needs to send existing connected user details to whoever just connected
        if (action.type === ConnectedUserActionTypes.ADD_CONNECTED_USER) {
            const deviceLayouts = getDeviceLayoutFromStore(state);
            for (let otherPeerId of Object.keys(connectedUsers)) {
                if (otherPeerId !== peerId) {
                    const user = connectedUsers[otherPeerId];
                    await commsNode.sendTo(addConnectedUserAction(otherPeerId, user.user, user.version!,
                        user.deviceWidth, user.deviceHeight, deviceLayouts[otherPeerId]),
                        {only: [peerId]});
                }
            }
        }
    }
}

function buildNetworkMetadata(state: ReduxStoreType, fromPeerId: string, originPeerId?: string): NetworkedMeta {
    const tabletop = getTabletopFromStore(state);
    const connectedUsers = getConnectedUsersFromStore(state);
    const fromGM = (connectedUsers[fromPeerId] && connectedUsers[fromPeerId].verifiedConnection && connectedUsers[fromPeerId].user.emailAddress === tabletop.gm);
    return {fromPeerId, originPeerId: originPeerId || fromPeerId, fromGM};
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
