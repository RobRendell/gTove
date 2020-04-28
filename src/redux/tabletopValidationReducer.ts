import {Action, AnyAction} from 'redux';
import {omit} from 'lodash';

import {ScenarioType} from '../util/scenarioUtils';
import {ScenarioReducerActionType, ScenarioReducerActionTypes, SetScenarioLocalAction} from './scenarioReducer';
import {ScenarioAction} from '../util/types';

// =========================== Action types and generators

export enum TabletopValidationActionTypes {
    SET_LAST_SAVED_HEAD_ACTION_IDS_ACTION = 'set-last-saved-head-action-ids-action',
    SET_LAST_SAVED_PLAYER_HEAD_ACTION_IDS_ACTION = 'set-last-saved-player-head-action-ids-action',
    SET_LAST_COMMON_SCENARIO_ACTION = 'set-last-common-scenario-action',
    ADD_PENDING_ACTION_ACTION = 'add-pending-action-action',
    DISCARD_PENDING_ACTION_ACTION = 'discard-pending-action-action'
}

interface SetLastSavedHeadActionIdsAction {
    type: TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_IDS_ACTION | TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_IDS_ACTION;
    headActionIds: string[];
    expiringActionIds: string[];
    peerKey: string;
    gmOnly: boolean;
}

export function setLastSavedHeadActionIdsAction(scenario: ScenarioType, expiringActionIds: string[]): SetLastSavedHeadActionIdsAction {
    return {
        type: TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_IDS_ACTION,
        headActionIds: scenario.headActionIds,
        expiringActionIds,
        peerKey: 'headActionIds',
        gmOnly: true
    };
}

export function setLastSavedPlayerHeadActionIdsAction(scenario: ScenarioType, expiringActionIds: string[]): SetLastSavedHeadActionIdsAction {
    return {
        type: TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_IDS_ACTION,
        headActionIds: scenario.playerHeadActionIds,
        expiringActionIds,
        peerKey: 'playerHeadActionIds',
        gmOnly: false
    };
}

interface SetLastCommonScenarioActionType extends Action {
    type: TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION;
    scenario: ScenarioType;
    action: ScenarioReducerActionType;
}

export function setLastCommonScenarioAction(scenario: ScenarioType, action: ScenarioReducerActionType): SetLastCommonScenarioActionType {
    return {type: TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION, scenario, action};
}

interface AddPendingActionActionType {
    type: TabletopValidationActionTypes.ADD_PENDING_ACTION_ACTION;
    action: ScenarioAction;
}

export function addPendingActionAction(action: ScenarioAction): AddPendingActionActionType {
    return {type: TabletopValidationActionTypes.ADD_PENDING_ACTION_ACTION, action};
}

interface DiscardPendingActionActionType {
    type: TabletopValidationActionTypes.DISCARD_PENDING_ACTION_ACTION;
    actionId: string;
}

export function discardPendingActionAction(actionId: string): DiscardPendingActionActionType {
    return {type: TabletopValidationActionTypes.DISCARD_PENDING_ACTION_ACTION, actionId};
}

type TabletopValidationReducerActionType = SetLastSavedHeadActionIdsAction | SetLastCommonScenarioActionType
    | AddPendingActionActionType | DiscardPendingActionActionType;

// =========================== Reducers

type ActionHistory = {[actionId: string]: AnyAction};

export interface TabletopValidationType {
    lastCommonScenario: null | ScenarioType;
    actionHistory: ActionHistory;
    playerActionQueue: string[];
    gmActionQueue: string[];
    expiringActionIds: string[];
    initialActionIds: {[actionId: string]: boolean};
    pendingActions: {[actionId: string]: AnyAction};
}

export const initialTabletopValidationType: TabletopValidationType = {
    lastCommonScenario: null,
    actionHistory: {},
    playerActionQueue: [],
    gmActionQueue: [],
    expiringActionIds: [],
    initialActionIds: {},
    pendingActions: {}
};

// Return the index of the oldest action in expiringActionIds, or 0 if none can be found.  Also delete entries in
// actionHistory which are older than the oldest action.
function expireOldActions(actionQueue: string[], expiringActionIds: string[], actionHistory: ActionHistory) {
    const queueIndex = expiringActionIds.reduce<number | undefined>((index, actionId) => {
        const actionIndex = actionQueue.indexOf(actionId);
        return actionIndex < 0 ? index : index !== undefined ? Math.min(index!, actionIndex) : actionIndex;
    }, undefined);
    if (queueIndex) {
        actionQueue.slice(0, queueIndex).forEach((actionId) => {
            delete(actionHistory[actionId]);
        });
    }
    return queueIndex === undefined ? 0 : queueIndex;
}

function tabletopValidationReducer(state: TabletopValidationType = initialTabletopValidationType, action: TabletopValidationReducerActionType | SetScenarioLocalAction): TabletopValidationType {
    switch (action.type) {
        case ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION:
            // Setting the scenario also resets our validation state.
            return {
                ...initialTabletopValidationType,
                lastCommonScenario: action.scenario,
                initialActionIds: action.scenario.headActionIds.reduce((all, actionId) => {
                    all[actionId] = true;
                    return all;
                }, {})
            };
        case TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_IDS_ACTION:
        case TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_IDS_ACTION:
            let actionHistory = {...state.actionHistory};
            const playerIndex = expireOldActions(state.playerActionQueue, state.expiringActionIds, actionHistory);
            const gmIndex = expireOldActions(state.gmActionQueue, state.expiringActionIds, actionHistory);
            return {
                ...state,
                expiringActionIds: action.expiringActionIds,
                actionHistory,
                playerActionQueue: state.playerActionQueue.slice(playerIndex),
                gmActionQueue: state.gmActionQueue.slice(gmIndex)
            };
        case TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION:
            return {
                ...state,
                lastCommonScenario: action.scenario,
                actionHistory: {...state.actionHistory, [action.action.actionId]: action.action},
                playerActionQueue: action.action.gmOnly ? state.playerActionQueue : [...state.playerActionQueue, action.action.actionId],
                gmActionQueue: action.action.gmOnly ? [...state.gmActionQueue, action.action.actionId] : state.gmActionQueue,
                pendingActions: omit(state.pendingActions, action.action.actionId)
            };
        case TabletopValidationActionTypes.ADD_PENDING_ACTION_ACTION:
            return {...state, pendingActions: {...state.pendingActions, [action.action.actionId]: action.action}};
        case TabletopValidationActionTypes.DISCARD_PENDING_ACTION_ACTION:
            return {...state, pendingActions: omit(state.pendingActions, action.actionId)};
        default:
            return state;
    }
}

export default tabletopValidationReducer;
