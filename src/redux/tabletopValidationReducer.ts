import {ScenarioType} from '../util/scenarioUtils';
import {ScenarioReducerActionType, ScenarioReducerActionTypes, SetScenarioLocalAction} from './scenarioReducerTypes';
import {
    SetLastCommonScenarioActionType,
    SetLastSavedHeadActionIdAction,
    TabletopValidationActionTypes,
    TabletopValidationReducerActionType,
    TabletopValidationType
} from './tabletopValidationTypes';

// =========================== Action generators

export function setLastSavedHeadActionIdAction(scenario: ScenarioType): SetLastSavedHeadActionIdAction {
    return {
        type: TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_ID_ACTION,
        headActionId: scenario.headActionId ?? 'empty',
        peerKey: 'headActionIds',
        gmOnly: true
    };
}

export function setLastSavedPlayerHeadActionIdAction(scenario: ScenarioType): SetLastSavedHeadActionIdAction {
    return {
        type: TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_ID_ACTION,
        headActionId: scenario.playerHeadActionId ?? 'empty',
        peerKey: 'playerHeadActionIds',
        gmOnly: false
    };
}

export function setLastCommonScenarioAction(scenario: ScenarioType, action: ScenarioReducerActionType): SetLastCommonScenarioActionType {
    return {type: TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION, scenario, action};
}

// =========================== Reducers

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
