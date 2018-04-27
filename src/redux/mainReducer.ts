import {applyMiddleware, combineReducers, createStore, Middleware, Reducer, Store} from 'redux';
import {connectRoutes, Location} from 'redux-first-router';
import createHistory from 'history/createBrowserHistory';
import {composeWithDevTools} from 'redux-devtools-extension';
import thunk from 'redux-thunk';

import {LocationState, routesMap} from './locationReducer';
import fileIndexReducer, {FileIndexReducerType} from './fileIndexReducer';
import scenarioReducer from './scenarioReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import loggedInUserReducer, {LoggedInUserReducerType} from './loggedInUserReducer';
import connectedUserReducer, {
    addConnectedUserAction,
    ConnectedUserReducerType,
    removeConnectedUserAction
} from './connectedUserReducer';
import {ScenarioType} from '../@types/scenario';

const DISCARD_STORE = 'discard_store';

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}

export interface ReduxStoreType {
    location: Location;
    fileIndex: FileIndexReducerType;
    scenario: ScenarioType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
}

export default function buildStore() {

    const {
        reducer: locationReducer,
        middleware: reduxFirstMiddleware,
        enhancer: reduxFirstEnhancer
    } = connectRoutes<{}, LocationState>(createHistory({basename: '/gtove'}), routesMap);

    const combinedReducers = combineReducers<ReduxStoreType>({
        location: locationReducer,
        fileIndex: fileIndexReducer,
        scenario: scenarioReducer,
        loggedInUser: loggedInUserReducer,
        connectedUsers: connectedUserReducer
    });

    const mainReducer: Reducer<ReduxStoreType> = (state, action) => {
        switch (action.type) {
            case DISCARD_STORE:
                return combinedReducers({location: state.location} as ReduxStoreType, action);
            default:
                return combinedReducers(state, action);
        }
    };

    let store: Store<ReduxStoreType>;

    const virtualGamingTabletopPeerToPeerMiddleware = peerToPeerMiddleware<ReduxStoreType>({
        getSignalChannelId: (store) => (getLoggedInUserFromStore(store) && getTabletopIdFromStore(store)),
        shouldDisconnect: (store) => (!getLoggedInUserFromStore(store) || !getTabletopIdFromStore(store)),
        getThrottleKey: (action) => (action.peerKey && `${action.type}.${action.peerKey}`),
        peerNodeOptions: {
            onEvents: [
                {event: 'connect', callback: (peerNode, peerId) => {
                    const loggedInUser = getLoggedInUserFromStore(store.getState());
                    if (loggedInUser) {
                        peerNode.sendTo(addConnectedUserAction(peerNode.peerId, loggedInUser), {only: [peerId]});
                    }
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
                virtualGamingTabletopPeerToPeerMiddleware as Middleware
            ),
            reduxFirstEnhancer
        )
    );

    return store;

}

export function getTabletopIdFromStore(store: ReduxStoreType): string {
    return store.location.payload['tabletopId'];
}

export function getLoggedInUserFromStore(store: ReduxStoreType): LoggedInUserReducerType {
    return store.loggedInUser;
}

export function getAllFilesFromStore(store: ReduxStoreType): FileIndexReducerType {
    return store.fileIndex;
}

export function getConnectedUsersFromStore(store: ReduxStoreType): ConnectedUserReducerType {
    return store.connectedUsers;
}

export function getScenarioFromStore(store: ReduxStoreType): ScenarioType {
    return store.scenario;
}
