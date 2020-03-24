import {Action} from 'redux';
import {v4} from 'uuid';

import {DistanceMode, DistanceRound, TabletopType} from '../util/scenarioUtils';
import {CommsStyle} from '../util/commsNode';
import {GToveThunk, ScenarioAction} from '../util/types';
import {getScenarioFromStore} from './mainReducer';
import {GridType} from '../util/googleDriveUtils';

// =========================== Action types and generators

enum TabletopReducerActionTypes {
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

interface UpdateTabletopAction extends ScenarioAction {
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

type TabletopReducerAction = SetTabletopActionType | UpdateTabletopAction;

// =========================== Reducers

const initialTabletopReducerState: TabletopType = {
    gm: '',
    gmSecret: null,
    defaultGrid: GridType.SQUARE,
    distanceMode: DistanceMode.STRAIGHT,
    distanceRound: DistanceRound.ROUND_OFF,
    commsStyle: CommsStyle.PeerToPeer
};

function tabletopReducer(state: TabletopType = initialTabletopReducerState, action: TabletopReducerAction) {
    switch (action.type) {
        case TabletopReducerActionTypes.SET_TABLETOP_ACTION:
        case TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION:
            return {
                ...state,
                ...action.tabletop,
                gm: state.gm || action.tabletop.gm || '',
                gmSecret: state.gmSecret || action.tabletop.gmSecret || null
            };
        default:
            return state;
    }
}

export default tabletopReducer;