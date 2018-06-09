import {applyMiddleware, combineReducers, createStore, Middleware, Reducer, Store} from 'redux';
import {connectRoutes, Location} from 'redux-first-router';
import createHistory from 'history/createBrowserHistory';
import {composeWithDevTools} from 'redux-devtools-extension';
import thunk from 'redux-thunk';

import {LocationState, routesMap} from './locationReducer';
import fileIndexReducer, {FileIndexReducerType} from './fileIndexReducer';
import scenarioReducer, {ScenarioReducerActionType} from './scenarioReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import loggedInUserReducer, {LoggedInUserReducerType} from './loggedInUserReducer';
import connectedUserReducer, {
    addConnectedUserAction,
    ConnectedUserReducerType,
    removeConnectedUserAction
} from './connectedUserReducer';
import {ScenarioType} from '../@types/scenario';
import tabletopValidationReducer, {setLastCommonScenarioAction, TabletopValidationType} from './tabletopValidationReducer';
import myPeerIdReducer, {MyPeerIdReducerType} from './myPeerIdReducer';

const DISCARD_STORE = 'discard_store';

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}

export interface ReduxStoreType {
    location: Location;
    fileIndex: FileIndexReducerType;
    scenario: ScenarioType;
    tabletopValidation: TabletopValidationType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    myPeerId: MyPeerIdReducerType;
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
        tabletopValidation: tabletopValidationReducer,
        loggedInUser: loggedInUserReducer,
        connectedUsers: connectedUserReducer,
        myPeerId: myPeerIdReducer
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

    const gTovePeerToPeerMiddleware = peerToPeerMiddleware<ReduxStoreType>({
        getSignalChannelId: (state) => (getLoggedInUserFromStore(state) && getTabletopIdFromStore(state)),
        shouldDisconnect: (state) => (!getLoggedInUserFromStore(state) || !getTabletopIdFromStore(state)),
        getThrottleKey: (action) => (action.peerKey && `${action.type}.${action.peerKey}`),
        peerNodeOptions: {
            onEvents: [
                {event: 'connect', callback: (peerNode, peerId) => {
                    const loggedInUser = getLoggedInUserFromStore(store.getState());
                    if (loggedInUser) {
                        peerNode.sendTo(addConnectedUserAction(peerNode.peerId, loggedInUser), {only: [peerId]});
                    }
                }},
                {event: 'data', callback: (peerNode, peerId, data) => {
                    const action = JSON.parse(data);
                    store.dispatch(action);
                    const scenario = getScenarioFromStore(store.getState());
                    if (scenario) {
                        store.dispatch(setLastCommonScenarioAction(scenario, action as ScenarioReducerActionType))
                    }
                }},
                {event: 'close', callback: (peerNode, peerId) => {
                    store.dispatch(removeConnectedUserAction(peerId));
                }}
            ]
        },
        onSentMessage: (state, recipients, message) => {
            const scenario = getScenarioFromStore(state);
            if (scenario) {
                const action = (typeof(message) === 'string') ? JSON.parse(message) : message;
                store.dispatch(setLastCommonScenarioAction(scenario, action as ScenarioReducerActionType))
            }
        }
    });

    store = createStore(mainReducer,
        composeWithDevTools(
            applyMiddleware(
                thunk,
                reduxFirstMiddleware,
                gTovePeerToPeerMiddleware as Middleware
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

export function getMyPeerIdFromStore(store: ReduxStoreType): MyPeerIdReducerType {
    return store.myPeerId;
}

export function getScenarioFromStore(store: ReduxStoreType): ScenarioType {
    return store.scenario;
}

export function getTabletopValidationFromStore(store: ReduxStoreType): TabletopValidationType {
    return store.tabletopValidation;
}