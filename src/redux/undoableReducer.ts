import undoable, {StateWithHistory} from 'redux-undo';
import {combineReducers, Reducer} from 'redux';

import scenarioReducer, {
    REDO_ACTION_TYPE,
    scenarioUndoFilter,
    scenarioUndoGroupBy, SEPARATE_UNDO_GROUP_ACTION_TYPE,
    UNDO_ACTION_TYPE
} from './scenarioReducer';
import tabletopValidationReducer, {TabletopValidationType} from './tabletopValidationReducer';
import {ScenarioType} from '../util/scenarioUtils';

interface UndoableState {
    scenario: ScenarioType;
    tabletopValidation: TabletopValidationType;
}

export type UndoableReducerType = StateWithHistory<UndoableState>;

const combinedUndoableReducers = combineReducers({
    scenario: scenarioReducer,
    tabletopValidation: tabletopValidationReducer
});

const realUndoableReducer = undoable(combinedUndoableReducers, {
        undoType: UNDO_ACTION_TYPE,
        redoType: REDO_ACTION_TYPE,
        limit: 100,
        groupBy: scenarioUndoGroupBy,
        filter: scenarioUndoFilter
    }
);

const undoableReducers: Reducer<UndoableReducerType> = (state, action) => {
    // isGMReduxStore is set in the action by the top-level main reducer before invoking this sub-reducer.
    if (action.isGMReduxStore) {
        // Only GMs can actually undo/redo
        switch (action.type) {
            case SEPARATE_UNDO_GROUP_ACTION_TYPE:
                // This is used to separate strings of actions with the same group ID into distinct groups without
                // inserting a group===null action in between.
                return {
                    ...state,
                    group: null
                } as any;
            default:
                return realUndoableReducer(state, action);
        }
    } else {
        return {
            ...(state || {past: [], future: []}),
            present: combinedUndoableReducers(state ? state.present : undefined, action)
        };
    }
};

export default undoableReducers;

