import {ScenarioType} from '../util/scenarioUtils';
import {TabletopValidationType} from './tabletopValidationTypes';
import {StateWithHistory} from 'redux-undo';

interface UndoableState {
    scenario: ScenarioType;
    tabletopValidation: TabletopValidationType;
}

export type UndoableReducerType = StateWithHistory<UndoableState>;