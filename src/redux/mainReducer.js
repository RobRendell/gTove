import {combineReducers} from 'redux';

import fileIndexReducer from './fileIndexReducer';
import scenarioReducer from './scenarioReducer';
import textureReducer from './textureReducer';

const DISCARD_STORE = 'discard_store';

const combinedReducers = combineReducers({
    fileIndex: fileIndexReducer,
    scenario: scenarioReducer,
    texture: textureReducer
});

const mainReducer = (state = {}, action) => {
    switch (action.type) {
        case DISCARD_STORE:
            return combinedReducers({}, action);
        default:
            return combinedReducers(state, action);
    }
};

export default mainReducer;

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}