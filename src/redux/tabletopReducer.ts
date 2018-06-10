import {Action, AnyAction, Reducer} from 'redux';

import {TabletopType} from '../@types/scenario';

// =========================== Action types and generators

enum TabletopReducerActionTypes {
    SET_TABLETOP_ACTION = 'set-tabletop-action'
}

interface SetTabletopActionType extends Action {
    type: TabletopReducerActionTypes.SET_TABLETOP_ACTION;
    tabletop: TabletopType;
}

export function setTabletopAction(tabletop: TabletopType): SetTabletopActionType {
    return {type: TabletopReducerActionTypes.SET_TABLETOP_ACTION, tabletop};
}

// =========================== Reducers

const tabletopReducer: Reducer<TabletopType> = (state = {gm: '', gmSecret: ''}, action: AnyAction) => {
    switch (action.type) {
        case TabletopReducerActionTypes.SET_TABLETOP_ACTION:
            return action.tabletop;
        default:
            return state;
    }
};

export default tabletopReducer;