import {AnyAction} from 'redux';
import {v4} from 'uuid';

import {
    DistanceMode,
    DistanceRound,
    INITIAL_PIECES_ROSTER_COLUMNS,
    TabletopType,
    TabletopUserPreferencesType
} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {GToveThunk} from '../util/types';
import {getTabletopFromStore} from './mainReducer';
import {ScenarioReducerActionTypes} from './scenarioReducerTypes';
import {
    SetTabletopActionType,
    TabletopReducerActionTypes,
    UpdateTabletopAction,
    UpdateTabletopUserPreferencesActionType
} from './tabletopReducerTypes';
import {TabletopValidationActionTypes} from './tabletopValidationTypes';

// =========================== Action generators

export function setTabletopAction(tabletop: TabletopType): SetTabletopActionType {
    return {type: TabletopReducerActionTypes.SET_TABLETOP_ACTION, tabletop};
}

export function updateTabletopAction(tabletop: Partial<TabletopType>): UpdateTabletopAction {
    return {
        type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION,
        tabletop: {...tabletop, gmSecret: undefined},
        actionId: v4(),
        peerKey: 'tabletop',
        gmOnly: false,
        isScenarioAction: true
    };
}

export function updateTabletopVideoMutedAction(metadataId: string, muted: boolean): GToveThunk<UpdateTabletopAction> {
    return (dispatch, getState) => {
        const {videoMuted} = getTabletopFromStore(getState());
        return dispatch({
            type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION,
            tabletop: {videoMuted: {...videoMuted, [metadataId]: muted}},
            actionId: v4(),
            peerKey: 'tabletopVideoMuted',
            gmOnly: false,
            isScenarioAction: true
        });
    };
}

export function updateTabletopUserPreferencesAction(email: string, update: Partial<TabletopUserPreferencesType>): UpdateTabletopUserPreferencesActionType {
    return {
        type: TabletopReducerActionTypes.UPDATE_TABLETOP_USER_PREFERENCES_ACTION,
        email, update,
        actionId: v4(),
        peerKey: 'preferences_' + email,
        gmOnly: false,
        isScenarioAction: true
    };
}

// =========================== Reducers

export const initialTabletopReducerState: TabletopType = {
    gm: '',
    gmSecret: null,
    gmOnlyPing: false,
    defaultGrid: GridType.SQUARE,
    distanceMode: DistanceMode.STRAIGHT,
    distanceRound: DistanceRound.ROUND_OFF,
    videoMuted: {},
    userPreferences: {},
    piecesRosterColumns: INITIAL_PIECES_ROSTER_COLUMNS
};

function tabletopReducer(state: TabletopType = initialTabletopReducerState, action: AnyAction): TabletopType {
    switch (action.type) {
        case TabletopReducerActionTypes.SET_TABLETOP_ACTION:
            return !action.isGMAction && action.fromPeerId ? state : action.tabletop;
        case TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION:
            // Only the GM is able to update most of the tabletop
            return action.isGMAction || !action.fromPeerId ? {
                ...state,
                ...action.tabletop,
                gm: state.gm || action.tabletop.gm || '',
                gmSecret: state.gmSecret || action.tabletop.gmSecret || null
            } : state;
        case ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION:
            return {
                ...state,
                lastSavedHeadActionId: action.scenario.headActionIds,
                lastSavedPlayerHeadActionId: action.scenario.playerHeadActionIds
            };
        case TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_ID_ACTION:
        case TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_ID_ACTION:
            return {
                ...state,
                lastSavedHeadActionId: action.gmOnly ? action.headActionId : state.lastSavedHeadActionId,
                lastSavedPlayerHeadActionId: action.gmOnly ? state.lastSavedPlayerHeadActionId : action.headActionId,
            };
        case TabletopReducerActionTypes.UPDATE_TABLETOP_USER_PREFERENCES_ACTION:
            return {
                ...state,
                userPreferences: {
                    ...state.userPreferences,
                    [action.email]: {
                        ...state.userPreferences[action.email],
                        ...action.update
                    }
                }
            };
        default:
            return state;
    }
}

export default tabletopReducer;