import {Action} from 'redux';

import {ScenarioType} from '../util/scenarioUtils';
import {ScenarioReducerActionType} from './scenarioReducerTypes';

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

export interface SetLastCommonScenarioActionType extends Action {
    type: TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION;
    scenario: ScenarioType;
    action: ScenarioReducerActionType;
}

export type TabletopValidationReducerActionType = SetLastSavedHeadActionIdAction | SetLastCommonScenarioActionType;

export interface TabletopValidationType {
    lastCommonScenario: null | ScenarioType;
}