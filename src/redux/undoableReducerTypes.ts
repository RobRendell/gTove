import {StateWithHistory} from 'redux-undo';

import {ScenarioType} from '../util/scenarioUtils';
import {TabletopValidationType} from './tabletopValidationTypes';

interface UndoableState {
    scenario: ScenarioType;
    tabletopValidation: TabletopValidationType;
}

export type UndoableReducerType = StateWithHistory<UndoableState>;