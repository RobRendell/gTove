import {ScenarioAction} from '../util/types';
import {TabletopType, TabletopUserPreferencesType} from '../util/scenarioUtils';
import {Action} from 'redux';

export enum TabletopReducerActionTypes {
    SET_TABLETOP_ACTION = 'set-tabletop-action',
    UPDATE_TABLETOP_ACTION = 'update-tabletop-action',
    UPDATE_TABLETOP_USER_PREFERENCES_ACTION = 'update-tabletop-user-preferences-action'
}

export interface SetTabletopActionType extends Action {
    type: TabletopReducerActionTypes.SET_TABLETOP_ACTION;
    tabletop: TabletopType;
}

export interface UpdateTabletopAction extends ScenarioAction {
    type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION;
    tabletop: Partial<TabletopType>;
}

export interface UpdateTabletopUserPreferencesActionType extends ScenarioAction {
    type: TabletopReducerActionTypes.UPDATE_TABLETOP_USER_PREFERENCES_ACTION;
    email: string;
    update: Partial<TabletopUserPreferencesType>;
}