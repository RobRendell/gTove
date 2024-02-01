import {Action} from 'redux';

import {ScenarioType} from '../util/scenarioUtils';
import {ScenarioReducerActionType, ScenarioReducerActionTypes, SetScenarioLocalAction} from './scenarioReducer';

// =========================== Action types and generators

export enum TabletopValidationActionTypes {
    SET_LAST_SAVED_HEAD_ACTION_ID_ACTION = 'set-last-saved-head-action-id-action',
    SET_LAST_SAVED_PLAYER_HEAD_ACTION_ID_ACTION = 'set-last-saved-player-head-action-id-action',
    SET_LAST_COMMON_SCENARIO_ACTION = 'set-last-common-scenario-action'
}

export interface SetLastSavedHeadActionIdAction {
    type: TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_ID_ACTION | TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_ID_ACTION;
    headActionId: string | null;
    peerKey: string;
    gmOnly: boolean;
}

export function setLastSavedHeadActionIdAction(scenario: ScenarioType): SetLastSavedHeadActionIdAction {
    return {
        type: TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_ID_ACTION,
        headActionId: scenario.headActionId,
        peerKey: 'headActionIds',
        gmOnly: true
    };
}

export function setLastSavedPlayerHeadActionIdAction(scenario: ScenarioType): SetLastSavedHeadActionIdAction {
    return {
        type: TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_ID_ACTION,
        headActionId: scenario.playerHeadActionId,
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

type TabletopValidationReducerActionType = SetLastSavedHeadActionIdAction | SetLastCommonScenarioActionType;

// =========================== Reducers

export interface TabletopValidationType {
    lastCommonScenario: null | ScenarioType;
}

export const initialTabletopValidationType: TabletopValidationType = {
    lastCommonScenario: null,
};

function tabletopValidationReducer(state: TabletopValidationType = initialTabletopValidationType, action: TabletopValidationReducerActionType | SetScenarioLocalAction): TabletopValidationType {
    switch (action.type) {
        case ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION:
            return {
                ...initialTabletopValidationType,
                lastCommonScenario: action.scenario
            };
        case TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION:
            return {
                ...state,
                lastCommonScenario: action.scenario,
            };
        default:
            return state;
    }
}

export default tabletopValidationReducer;
