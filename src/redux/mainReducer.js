import {applyMiddleware, combineReducers, createStore} from 'redux';
import {connectRoutes} from 'redux-first-router';
import createHistory from 'history/createBrowserHistory';
import {composeWithDevTools} from 'redux-devtools-extension';

import {getWorkspaceIdFromStore, routesMap} from './locationReducer';
import fileIndexReducer from './fileIndexReducer';
import scenarioReducer from './scenarioReducer';
import textureReducer from './textureReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import autoSaveScenariosMiddleware from './autoSaveScenariosMiddleware';

const DISCARD_STORE = 'discard_store';

const {
    reducer: locationReducer,
    middleware: reduxFirstMiddleware,
    enhancer: reduxFirstEnhancer
} = connectRoutes(createHistory(), routesMap);

const combinedReducers = combineReducers({
    location: locationReducer,
    fileIndex: fileIndexReducer,
    scenario: scenarioReducer,
    texture: textureReducer
});

const mainReducer = (state = {}, action) => {
    switch (action.type) {
        case DISCARD_STORE:
            return combinedReducers(undefined, action);
        default:
            return combinedReducers(state, action);
    }
};

const store = createStore(mainReducer, composeWithDevTools(
    applyMiddleware(
        reduxFirstMiddleware,
        peerToPeerMiddleware(getWorkspaceIdFromStore, () => true),
        autoSaveScenariosMiddleware
    ),
    reduxFirstEnhancer)
);

export default store;

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}