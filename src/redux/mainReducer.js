import {applyMiddleware, combineReducers, createStore} from 'redux';
import {connectRoutes} from 'redux-first-router';
import createHistory from 'history/createBrowserHistory';
import {composeWithDevTools} from 'redux-devtools-extension';
import thunk from 'redux-thunk';

import {getTabletopIdFromStore, routesMap} from './locationReducer';
import fileIndexReducer from './fileIndexReducer';
import scenarioReducer from './scenarioReducer';
import textureReducer from './textureReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import loggedInUserReducer, {getLoggedInUserFromStore} from './loggedInUserReducer';
import connectedUserReducer, {addConnectedUserAction, removeConnectedUserAction} from './connectedUserReducer';

const DISCARD_STORE = 'discard_store';

export default function buildStore() {

    const {
        reducer: locationReducer,
        middleware: reduxFirstMiddleware,
        enhancer: reduxFirstEnhancer
    } = connectRoutes(createHistory({basename: '/vgt'}), routesMap);

    const combinedReducers = combineReducers({
        location: locationReducer,
        fileIndex: fileIndexReducer,
        scenario: scenarioReducer,
        texture: textureReducer,
        loggedInUser: loggedInUserReducer,
        connectedUsers: connectedUserReducer
    });

    const mainReducer = (state = {}, action) => {
        switch (action.type) {
            case DISCARD_STORE:
                return combinedReducers({location: state.location}, action);
            default:
                return combinedReducers(state, action);
        }
    };

    let store;

    const virtualGamingTabletopPeerToPeerMiddleware = peerToPeerMiddleware({
        getSignalChannelId: (store) => (getLoggedInUserFromStore(store) && getTabletopIdFromStore(store)),
        shouldDisconnect: (store) => (!getLoggedInUserFromStore(store) || !getTabletopIdFromStore(store)),
        getThrottleKey: (action) => (action.peerKey && `${action.type}.${action.peerKey}`),
        peerNodeOptions: {
            onEvents: [
                {event: 'connect', callback: (peerNode, peerId) => {
                    const loggedInUser = getLoggedInUserFromStore(store.getState());
                    peerNode.sendTo(addConnectedUserAction(peerNode.peerId, loggedInUser), {only: [peerId]});
                }},
                {event: 'close', callback: (peerNode, peerId) => {
                    store.dispatch(removeConnectedUserAction(peerId));
                }}
            ]
        }
    });

    store = createStore(mainReducer,
        composeWithDevTools(
            applyMiddleware(
                thunk,
                reduxFirstMiddleware,
                virtualGamingTabletopPeerToPeerMiddleware
            ),
            reduxFirstEnhancer
        )
    );

    return store;

}

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}