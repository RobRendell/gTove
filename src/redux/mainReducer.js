import {applyMiddleware, combineReducers, createStore} from 'redux';
import {connectRoutes} from 'redux-first-router';
import createHistory from 'history/createBrowserHistory';
import {composeWithDevTools} from 'redux-devtools-extension';

import {getTabletopIdFromStore, routesMap} from './locationReducer';
import fileIndexReducer from './fileIndexReducer';
import scenarioReducer from './scenarioReducer';
import textureReducer from './textureReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import loggedInUserReducer from './loggedInUserReducer';

const DISCARD_STORE = 'discard_store';

export default function buildStore() {

    const {
        reducer: locationReducer,
        middleware: reduxFirstMiddleware,
        enhancer: reduxFirstEnhancer
    } = connectRoutes(createHistory(), routesMap);

    const combinedReducers = combineReducers({
        location: locationReducer,
        fileIndex: fileIndexReducer,
        scenario: scenarioReducer,
        texture: textureReducer,
        loggedInUser: loggedInUserReducer
    });

    const mainReducer = (state = {}, action) => {
        switch (action.type) {
            case DISCARD_STORE:
                return combinedReducers({location: state.location}, action);
            default:
                return combinedReducers(state, action);
        }
    };

    const virtualGamingTabletopPeerToPeerMiddleware = peerToPeerMiddleware({
        getSignalChannelId: getTabletopIdFromStore,
        getThrottleKey: (action) => (action.peerKey && `${action.type}.${action.peerKey}`)
    });

    return createStore(mainReducer,
        composeWithDevTools(
            applyMiddleware(
                reduxFirstMiddleware,
                virtualGamingTabletopPeerToPeerMiddleware
            ),
            reduxFirstEnhancer
        )
    );

}

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}