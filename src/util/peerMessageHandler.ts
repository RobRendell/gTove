import {AnyAction, Store} from 'redux';

import {CommsNode} from './commsNode';
import {
    ScenarioReducerActionType,
    setScenarioLocalAction,
    updateHeadActionIdsAction
} from '../redux/scenarioReducer';
import {promiseSleep} from './promiseSleep';
import {
    addPendingActionAction,
    discardPendingActionAction,
    setLastCommonScenarioAction,
    TabletopValidationType
} from '../redux/tabletopValidationReducer';
import {addConnectedUserAction, ConnectedUserActionTypes, handleConnectionActions} from '../redux/connectedUserReducer';
import {
    getConnectedUsersFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopValidationFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import {isScenarioAction} from './types';
import {getNetworkHubId, scenarioToJson} from './scenarioUtils';

export enum MessageTypeEnum {
    CHECK_ACTIONS_MESSAGE = 'check-actions',
    MISSING_ACTION_MESSAGE = 'missing-action',
    RESEND_ACTIONS_MESSAGE = 'resend-actions'
}

export enum MissingActionRequestStageEnum {
    REQUEST_SOURCE_PEER,
    REQUEST_EVERYONE_ELSE
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
    requestStage: MissingActionRequestStageEnum;
}

export function missingActionMessage(missingActionIds: string[], knownActionIds: string[], requestStage: MissingActionRequestStageEnum, actionId?: string): MissingActionMessageType {
    return {message: MessageTypeEnum.MISSING_ACTION_MESSAGE, actionId, missingActionIds, knownActionIds, requestStage};
}

type AncestorActions = {[actionId: string]: AnyAction} | null;

interface ResendActionsMessage {
    message: MessageTypeEnum.RESEND_ACTIONS_MESSAGE;
    actionId?: string;
    missingActionIds: string[];
    actions: AncestorActions;
    requestStage: MissingActionRequestStageEnum;
}

export function resendActionsMessage(missingActionIds: string[], actions: AncestorActions, requestStage: MissingActionRequestStageEnum, actionId?: string): ResendActionsMessage {
    return {message: MessageTypeEnum.RESEND_ACTIONS_MESSAGE, actionId, missingActionIds, actions, requestStage};
}

type MessageType = CheckActionsMessageType | MissingActionMessageType | ResendActionsMessage;

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
                await commsNode.sendTo(missingActionMessage(missingActionIds, knownActionIds, MissingActionRequestStageEnum.REQUEST_SOURCE_PEER), {only: [peerId]});
            }
            break;
        case MessageTypeEnum.MISSING_ACTION_MESSAGE:
            // Use map of knownActionIds to speed up test
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
                await commsNode.sendTo(resendActionsMessage(message.missingActionIds, resendActions, message.requestStage, message.actionId), {only: [peerId]});
            }
            break;
        case MessageTypeEnum.RESEND_ACTIONS_MESSAGE:
            if (message.actions === null) {
                // They're a player who can't explain the missing action - assert out state.
                await sendScenarioState(state, commsNode, peerId);
                if (message.actionId) {
                    // Discard the pending action.
                    store.dispatch(discardPendingActionAction(message.actionId));
                }
                return;
            }
            // Use the received ancestor actions and current known actions to build an ordered list of actions to dispatch.
            const allActions = validation.pendingActions.reduce((all, action) => {
                all[action.actionId] = action;
                return all;
            }, {...message.actions});
            const actionIds = message.actionId ? [...message.missingActionIds, message.actionId] : message.missingActionIds;
            // For some reason, getting tabletop validation from store sometimes doesn't pick up the actions we've
            // just dispatched.  Track them manually
            const dispatched = {};
            for (let pendingActionId of actionIds) {
                const orderedActions = postOrderActions(allActions[pendingActionId], allActions);
                for (let action of orderedActions) {
                    // Verify that we know the headActionIds of action.
                    if (isScenarioAction(action)) {
                        validation = getTabletopValidationFromStore(state);
                        const missingActionIds = findMissingActionIds(validation, action.headActionIds)
                            .filter((actionId) => (!dispatched[actionId]));
                        if (missingActionIds.length > 0) {
                            console.error('Still have unknown action IDs - this should not happen');
                            return;
                        }
                    }
                    dispatched[action.actionId] = true;
                    // Dispatch the action, but remove peerKey and mark private so it isn't automatically sent on.
                    await dispatchGoodAction(store, commsNode, peerId, {...action, peerKey: undefined, private: true});
                }
            }
            break;
    }
}

function findMissingActionIds(validation: TabletopValidationType, headActionIds: string[]) {
    return headActionIds.filter((actionId) => (!validation.actionHistory[actionId] && !validation.initialActionIds[actionId]));
}

async function receiveActionFromPeer(store: Store<ReduxStoreType>, commsNode: CommsNode, peerId: string, action: AnyAction) {
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
                await commsNode.sendTo(missingActionMessage(missingActionIds, knownActionIds, MissingActionRequestStageEnum.REQUEST_SOURCE_PEER, action.actionId), {only: [peerId]});
                return;
            }
        }
    }
    // All good - dispatch action
    await dispatchGoodAction(store, commsNode, peerId, action);
}

async function dispatchGoodAction(store: Store<ReduxStoreType>, commsNode: CommsNode, peerId: string, action: AnyAction) {
    store.dispatch(action);
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

export default async function peerMessageHandler(store: Store<ReduxStoreType>, peerNode: CommsNode, peerId: string, data: string): Promise<void> {
    const message = {...JSON.parse(data), fromPeerId: peerId};
    if (message.type) {
        await receiveActionFromPeer(store, peerNode, peerId, message as AnyAction);
    } else {
        await receiveMessageFromPeer(store, peerNode, peerId, message as MessageType);
    }
}
