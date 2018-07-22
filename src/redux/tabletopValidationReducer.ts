import {Action, AnyAction, Reducer} from 'redux';

import {ScenarioType} from '../util/scenarioUtils';
import {ScenarioReducerActionType} from './scenarioReducer';

// =========================== Action types and generators

enum TabletopValidationActionTypes {
    SET_LAST_COMMON_SCENARIO_ACTION = 'set-last-common-scenario-action',
    CONFIRM_TABLETOP_VALID_ACTION = 'confirm-tabletop-valid-action'
}

interface SetLastCommonScenarioActionType extends Action {
    type: TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION;
    scenario: ScenarioType;
    action: ScenarioReducerActionType;
}

export function setLastCommonScenarioAction(scenario: ScenarioType, action: ScenarioReducerActionType): SetLastCommonScenarioActionType {
    return {type: TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION, scenario, action};
}

interface ConfirmTabletopValidActionType extends Action {
    type: TabletopValidationActionTypes.CONFIRM_TABLETOP_VALID_ACTION;
}

export function confirmTabletopValidAction(): ConfirmTabletopValidActionType {
    return {type: TabletopValidationActionTypes.CONFIRM_TABLETOP_VALID_ACTION};
}

type TabletopValidationReducerActionType = SetLastCommonScenarioActionType | ConfirmTabletopValidActionType;

// =========================== Reducers

export interface TabletopValidationType {
    lastCommonScenario: null | ScenarioType;
    lastPublicActionId?: string;
    scenarioHistory: null | ScenarioType[];
    scenarioActions: null | AnyAction[];
    scenarioIndexes: null | {[actionId: string]: number};
}

const DEFAULT_STATE: TabletopValidationType = {
    lastCommonScenario: null,
    lastPublicActionId: undefined,
    scenarioHistory: [],
    scenarioActions: [],
    scenarioIndexes: {}
};

const tabletopValidationReducer: Reducer<TabletopValidationType> = (state = DEFAULT_STATE, action: TabletopValidationReducerActionType) => {
    switch (action.type) {
        case TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION:
            if (action.scenario && action.action.actionId && (!state.lastCommonScenario || state.lastCommonScenario.lastActionId !== action.scenario.lastActionId)) {
                return {
                    ...state,
                    lastCommonScenario: action.scenario,
                    lastPublicActionId: action.action.gmOnly ? state.lastPublicActionId : action.action.actionId,
                    scenarioHistory: state.scenarioHistory ? [...state.scenarioHistory, action.scenario] : null,
                    scenarioActions: state.scenarioActions ? [...state.scenarioActions, action.action] : null,
                    scenarioIndexes: state.scenarioHistory ? {...state.scenarioIndexes, [action.action.actionId]: state.scenarioHistory.length} : null
                };
            } else {
                return state;
            }
        case TabletopValidationActionTypes.CONFIRM_TABLETOP_VALID_ACTION:
            return {...state, scenarioHistory: null, scenarioActions: null, scenarioIndexes: null};
        default:
            return state;
    }
};

export default tabletopValidationReducer;
