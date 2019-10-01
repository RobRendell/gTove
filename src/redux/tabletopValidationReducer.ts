import {Action, AnyAction, Reducer} from 'redux';
import {partition} from 'lodash';

import {ScenarioType} from '../util/scenarioUtils';
import {ScenarioReducerActionType, ScenarioReducerActionTypes, SetScenarioLocalAction} from './scenarioReducer';

// =========================== Action types and generators

export enum TabletopValidationActionTypes {
    SET_LAST_SAVED_SCENARIO_ACTION = 'set-last-saved-scenario-action',
    SET_LAST_COMMON_SCENARIO_ACTION = 'set-last-common-scenario-action',
    ADD_PENDING_ACTION_ACTION = 'add-pending-action-action'
}

interface SetLastSavedScenarioAction {
    type: TabletopValidationActionTypes.SET_LAST_SAVED_SCENARIO_ACTION;
    scenario: ScenarioType;
}

export function setLastSavedScenarioAction(scenario: ScenarioType): SetLastSavedScenarioAction {
    return {type: TabletopValidationActionTypes.SET_LAST_SAVED_SCENARIO_ACTION, scenario};
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
    action: Action;
}

export function addPendingActionAction(action: Action): AddPendingActionActionType {
    return {type: TabletopValidationActionTypes.ADD_PENDING_ACTION_ACTION, action};
}

type TabletopValidationReducerActionType = SetLastSavedScenarioAction | SetLastCommonScenarioActionType | AddPendingActionActionType;

// =========================== Reducers

interface AgingQueueType {
    timestamp: number;
    actionId: string;
}

export interface TabletopValidationType {
    lastSavedScenario: null | ScenarioType;
    lastCommonScenario: null | ScenarioType;
    actionHistory: {[actionId: string]: AnyAction};
    agingQueue: AgingQueueType[];
    initialActionIds: {[actionId: string]: boolean};
    pendingActions: AnyAction[];
}

export const initialTabletopValidationType: TabletopValidationType = {
    lastSavedScenario: null,
    lastCommonScenario: null,
    actionHistory: {},
    agingQueue: [],
    initialActionIds: {},
    pendingActions: []
};

const tabletopValidationReducer: Reducer<TabletopValidationType> = (state = initialTabletopValidationType, action: TabletopValidationReducerActionType | SetScenarioLocalAction) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION:
            // Setting the scenario also resets our validation state.
            return {
                lastSavedScenario: action.scenario,
                lastCommonScenario: action.scenario,
                actionHistory: {},
                agingQueue: [],
                initialActionIds: action.scenario.headActionIds.reduce((all, actionId) => {
                    all[actionId] = true;
                    return all;
                }, {}),
                pendingActions: []
            };
        case TabletopValidationActionTypes.SET_LAST_SAVED_SCENARIO_ACTION:
            return {
                ...state,
                lastSavedScenario: action.scenario
            };
        case TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION:
            let actionHistory = {
                ...state.actionHistory,
                [action.action.actionId]: action.action
            };
            const expiryTime = Date.now() - 60*1000;
            let [agingQueue, expired] = partition(state.agingQueue, (item) => (item.timestamp > expiryTime));
            expired.forEach((item) => {delete(actionHistory[item.actionId])});
            return {
                ...state,
                lastCommonScenario: action.scenario,
                actionHistory,
                agingQueue: [...agingQueue, {actionId: action.action.actionId, timestamp: Date.now()}],
                pendingActions: state.pendingActions.filter((pendingAction) => (pendingAction.actionId === action.action.actionId))
            };
        case TabletopValidationActionTypes.ADD_PENDING_ACTION_ACTION:
            return {
                ...state,
                pendingActions: state.pendingActions.concat(action.action)
            };
        default:
            return state;
    }
};

export default tabletopValidationReducer;
