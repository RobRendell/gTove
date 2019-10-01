import {Action, Reducer} from 'redux';
import {v4} from 'uuid';

import {DistanceMode, DistanceRound, TabletopType} from '../util/scenarioUtils';
import {CommsStyle} from '../util/commsNode';

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

interface UpdateTabletopAction extends Action {
    type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION;
    tabletop: Partial<TabletopType>;
    actionId: string;
    peerKey: string;
}

export function updateTabletopAction(tabletop: Partial<TabletopType>): UpdateTabletopAction {
    return {type: TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION, tabletop: {...tabletop, gmSecret: undefined}, actionId: v4(), peerKey: 'tabletop'};
}

type TabletopReducerAction = SetTabletopActionType | UpdateTabletopAction;

// =========================== Reducers

const initialTabletopReducerState: TabletopType = {
    gm: '',
    gmSecret: '',
    distanceMode: DistanceMode.STRAIGHT,
    distanceRound: DistanceRound.ROUND_OFF,
    commsStyle: CommsStyle.PeerToPeer
};

const tabletopReducer: Reducer<TabletopType> = (state = initialTabletopReducerState, action: TabletopReducerAction) => {
    switch (action.type) {
        case TabletopReducerActionTypes.SET_TABLETOP_ACTION:
            return action.tabletop;
        case TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION:
            return {
                gm: state.gm,
                gmSecret: state.gmSecret,
                distanceMode: action.tabletop.distanceMode || state.distanceMode,
                distanceRound: action.tabletop.distanceRound || state.distanceRound,
                gridScale: action.tabletop.gridScale || state.gridScale,
                gridUnit: action.tabletop.gridUnit || state.gridUnit,
                commsStyle: action.tabletop.commsStyle || state.commsStyle
            };
        default:
            return state;
    }
};

export default tabletopReducer;