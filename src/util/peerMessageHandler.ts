import {AnyAction, Store} from 'redux';

import {CommsNode} from './commsNode';
import {
    isScenarioAction,
    ScenarioReducerActionType,
    updateHeadActionIdsAction
} from '../redux/scenarioReducer';
import {promiseSleep} from './promiseSleep';
import {
    addPendingActionAction,
    setLastCommonScenarioAction, TabletopValidationType
} from '../redux/tabletopValidationReducer';
import {handleChallengeActions} from '../redux/connectedUserReducer';
import {getScenarioFromStore, getTabletopValidationFromStore, ReduxStoreType} from '../redux/mainReducer';

export enum MessageTypeEnum {
    MISSING_ACTION_MESSAGE = 'missing-action',
    RESEND_ACTIONS_MESSAGE = 'resend-actions'
}

export enum MissingActionRequestStageEnum {
    REQUEST_SOURCE_PEER,
    REQUEST_EVERYONE_ELSE
}

interface MissingActionMessageType {
    message: MessageTypeEnum.MISSING_ACTION_MESSAGE;
    missingActionIds: string[];
    knownActionIds: string[];
    requestStage: MissingActionRequestStageEnum;
}

export function missingActionMessage(missingActionIds: string[], knownActionIds: string[], requestStage: MissingActionRequestStageEnum): MissingActionMessageType {
    return {message: MessageTypeEnum.MISSING_ACTION_MESSAGE, missingActionIds, knownActionIds, requestStage};
}

type AncestorActions = {[actionId: string]: AnyAction} | null;

interface ResendActionsMessage {
    message: MessageTypeEnum.RESEND_ACTIONS_MESSAGE;
    missingActionIds: string[];
    actions: AncestorActions;
    requestStage: MissingActionRequestStageEnum;
}

export function resendActionsMessage(missingActionIds: string[], actions: AncestorActions, requestStage: MissingActionRequestStageEnum): ResendActionsMessage {
    return {message: MessageTypeEnum.RESEND_ACTIONS_MESSAGE, missingActionIds, actions, requestStage};
}

type MessageType = MissingActionMessageType | ResendActionsMessage;

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

async function receiveMessageFromPeer(store: Store<ReduxStoreType>, peerNode: CommsNode, peerId: string, message: MessageType) {
    let validation = getTabletopValidationFromStore(store.getState());
    switch (message.message) {
        case MessageTypeEnum.MISSING_ACTION_MESSAGE:
            // Use map of knownActionIds to speed up test
            const knownActionIds = message.knownActionIds.reduce((all, actionId) => {
                all[actionId] = true;
                return all;
            }, {});
            // Accumulate the missing actions required to fill in the peer's gaps.
            const resendActions = findAncestorActions(validation, knownActionIds, message.missingActionIds);
            await peerNode.sendTo(resendActionsMessage(message.missingActionIds, resendActions, message.requestStage), {only: [peerId]});
            break;
        case MessageTypeEnum.RESEND_ACTIONS_MESSAGE:
            const actions = message.actions;
            if (actions === null) {
                if (message.requestStage === MissingActionRequestStageEnum.REQUEST_SOURCE_PEER) {
                    // The peer who sent the problematic action says they can't help - ask everyone else.
                    await peerNode.sendTo(
                        missingActionMessage(message.missingActionIds,
                            Object.keys(validation.actionHistory).concat(Object.keys(validation.initialActionIds)),
                            MissingActionRequestStageEnum.REQUEST_EVERYONE_ELSE),
                        {except: [peerId]});
                }
                // Otherwise, we just return... the UI shows that there are sync problems, the user can reload if they choose to.
                return;
            }
            // Use the received ancestor actions and current known actions to build an ordered list of actions to dispatch.
            const allActions = validation.pendingActions.reduce((all, action) => {
                all[action.actionId] = action;
                return all;
            }, {...actions});
            for (let pendingActionId of message.missingActionIds) {
                const orderedActions = postOrderActions(allActions[pendingActionId], allActions);
                for (let action of orderedActions) {
                    // Verify that we know the headActionIds of action.
                    if (isScenarioAction(action)) {
                        validation = getTabletopValidationFromStore(store.getState());
                        const missingActionIds = findMissingActionIds(validation, action.headActionIds);
                        if (missingActionIds.length > 0) {
                            throw new Error('Still have unknown action IDs - this should not happen');
                        }
                    }
                    await dispatchGoodAction(store, peerNode, peerId, action);
                }
            }
            break;
    }
}

function findMissingActionIds(validation: TabletopValidationType, headActionIds: string[]) {
    return headActionIds.filter((actionId) => (!validation.actionHistory[actionId] && !validation.initialActionIds[actionId]));
}

async function receiveActionFromPeer(store: Store<ReduxStoreType>, peerNode: CommsNode, peerId: string, action: AnyAction) {
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
                await peerNode.sendTo(missingActionMessage(missingActionIds, knownActionIds, MissingActionRequestStageEnum.REQUEST_SOURCE_PEER), {only: [peerId]});
                return;
            }
        }
    }
    // All good - dispatch action
    await dispatchGoodAction(store, peerNode, peerId, action);
}

async function dispatchGoodAction(store: Store<ReduxStoreType>, peerNode: CommsNode, peerId: string, action: AnyAction) {
    store.dispatch(action);
    if (isScenarioAction(action)) {
        store.dispatch(updateHeadActionIdsAction(action));
        store.dispatch(setLastCommonScenarioAction(getScenarioFromStore(store.getState()), action as ScenarioReducerActionType));
    }
    // Handle challenge/response actions for other users claiming to be GMs.
    const challengeAction = handleChallengeActions(action, store.getState());
    if (challengeAction) {
        store.dispatch(challengeAction);
        await peerNode.sendTo(challengeAction, {only: [peerId]});
    }
}

export default async function peerMessageHandler(store: Store<ReduxStoreType>, peerNode: CommsNode, peerId: string, data: string): Promise<void> {
    const message = JSON.parse(data);
    if (message.type) {
        await receiveActionFromPeer(store, peerNode, peerId, message as AnyAction);
    } else {
        await receiveMessageFromPeer(store, peerNode, peerId, message as MessageType);
    }
}
