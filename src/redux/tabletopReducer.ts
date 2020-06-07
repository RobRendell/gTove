import {Action, AnyAction} from 'redux';
import {v4} from 'uuid';

import {DistanceMode, DistanceRound, INITIAL_PIECES_ROSTER_COLUMNS, TabletopType} from '../util/scenarioUtils';
import {CommsStyle} from '../util/commsNode';
import {GToveThunk, ScenarioAction} from '../util/types';
import {getScenarioFromStore, getTabletopFromStore} from './mainReducer';
import {GridType} from '../util/googleDriveUtils';
import {ScenarioReducerActionTypes} from './scenarioReducer';
import {TabletopValidationActionTypes} from './tabletopValidationReducer';

// =========================== Action types and generators

export enum TabletopReducerActionTypes {
    SET_TABLETOP_ACTION = 'set-tabletop-action',
    UPDATE_TABLETOP_ACTION = 'update-tabletop-action'
}

interface SetTabletopActionType extends Action {
    type: TabletopReducerActionTypes.SET_TABLETOP_ACTION;
    tabletop: TabletopType;
}

export function setTabletopAction(tabletop: TabletopType): SetTabletopActionType {
    return {type: TabletopReducerActionTypes.SET_TABLETOP_ACTION, tabletop};
}

export interface UpdateTabletopAction extends ScenarioAction {
    type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION;
    tabletop: Partial<TabletopType>;
}

export function updateTabletopAction(tabletop: Partial<TabletopType>): GToveThunk<UpdateTabletopAction> {
    return (dispatch, getState) => {
        const {headActionIds} = getScenarioFromStore(getState());
        return dispatch({
            type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION,
            tabletop: {...tabletop, gmSecret: undefined},
            actionId: v4(),
            headActionIds,
            peerKey: 'tabletop',
            gmOnly: false
        });
    };
}

export function updateTabletopVideoMutedAction(metadataId: string, muted: boolean): GToveThunk<UpdateTabletopAction> {
    return (dispatch, getState) => {
        const {headActionIds} = getScenarioFromStore(getState());
        const {videoMuted} = getTabletopFromStore(getState());
        return dispatch({
            type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION,
            tabletop: {videoMuted: {...videoMuted, [metadataId]: muted}},
            actionId: v4(),
            headActionIds,
            peerKey: 'tabletopVideoMuted',
            gmOnly: false
        });
    };
}

// =========================== Reducers

const initialTabletopReducerState: TabletopType = {
    gm: '',
    gmSecret: null,
    gmOnlyPing: false,
    defaultGrid: GridType.SQUARE,
    distanceMode: DistanceMode.STRAIGHT,
    distanceRound: DistanceRound.ROUND_OFF,
    commsStyle: CommsStyle.PeerToPeer,
    lastSavedHeadActionIds: null,
    lastSavedPlayerHeadActionIds: null,
    videoMuted: {},
    piecesRosterColumns: INITIAL_PIECES_ROSTER_COLUMNS
};

function tabletopReducer(state: TabletopType = initialTabletopReducerState, action: AnyAction) {
    switch (action.type) {
        case TabletopReducerActionTypes.SET_TABLETOP_ACTION:
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
                lastSavedHeadActionIds: action.scenario.headActionIds,
                lastSavedPlayerHeadActionIds: action.scenario.playerHeadActionIds
            };
        case TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_IDS_ACTION:
        case TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_IDS_ACTION:
            return {
                ...state,
                lastSavedHeadActionIds: action.gmOnly ? action.headActionIds : state.lastSavedHeadActionIds,
                lastSavedPlayerHeadActionIds: action.gmOnly ? state.lastSavedPlayerHeadActionIds : action.headActionIds,
            };
        default:
            return state;
    }
}

export default tabletopReducer;