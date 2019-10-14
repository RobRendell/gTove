import {AnyAction, applyMiddleware, combineReducers, createStore, Middleware, Reducer, Store} from 'redux';
import {connectRoutes, Location} from 'redux-first-router';
import createHistory from 'history/createBrowserHistory';
import {composeWithDevTools} from 'redux-devtools-extension';
import thunk from 'redux-thunk';

import {LocationState, routesMap} from './locationReducer';
import fileIndexReducer, {FileIndexReducerType} from './fileIndexReducer';
import scenarioReducer, {
    ScenarioReducerActionType,
    updateHeadActionIdsAction
} from './scenarioReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import loggedInUserReducer, {LoggedInUserReducerType} from './loggedInUserReducer';
import connectedUserReducer, {
    addConnectedUserAction,
    ConnectedUserReducerType,
    removeConnectedUserAction
} from './connectedUserReducer';
import {ScenarioType, TabletopType} from '../util/scenarioUtils';
import tabletopValidationReducer, {
    setLastCommonScenarioAction,
    TabletopValidationType
} from './tabletopValidationReducer';
import myPeerIdReducer, {MyPeerIdReducerType} from './myPeerIdReducer';
import tabletopReducer from './tabletopReducer';
import bundleReducer, {BundleReducerType} from './bundleReducer';
import createInitialStructureReducer, {CreateInitialStructureReducerType} from './createInitialStructureReducer';
import deviceLayoutReducer, {DeviceLayoutReducerType} from './deviceLayoutReducer';
import peerMessageHandler from '../util/peerMessageHandler';
import {isScenarioAction} from '../util/types';

const DISCARD_STORE = 'discard_store';

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}

export interface ReduxStoreType {
    location: Location;
    fileIndex: FileIndexReducerType;
    scenario: ScenarioType;
    tabletop: TabletopType;
    tabletopValidation: TabletopValidationType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    myPeerId: MyPeerIdReducerType;
    bundleId: BundleReducerType;
    createInitialStructure: CreateInitialStructureReducerType;
    deviceLayout: DeviceLayoutReducerType;
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
        tabletop: tabletopReducer,
        tabletopValidation: tabletopValidationReducer,
        loggedInUser: loggedInUserReducer,
        connectedUsers: connectedUserReducer,
        myPeerId: myPeerIdReducer,
        bundleId: bundleReducer,
        createInitialStructure: createInitialStructureReducer,
        deviceLayout: deviceLayoutReducer
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

    const onSentMessage = (recipients: string[], action: any) => {
        if (isScenarioAction(action)) {
            store.dispatch(updateHeadActionIdsAction(action));
            store.dispatch(setLastCommonScenarioAction(getScenarioFromStore(store.getState()), action as ScenarioReducerActionType))
        }
    };

    const gTovePeerToPeerMiddleware = peerToPeerMiddleware<ReduxStoreType>({
        getCommsChannel: (state) => ({
            commsChannelId: getLoggedInUserFromStore(state) && getTabletopFromStore(state).gm && getTabletopIdFromStore(state),
            commsStyle: getTabletopFromStore(state).commsStyle
        }),
        peerNodeOptions: {
            onEvents: [
                {event: 'connect', callback: async (peerNode, peerId) => {
                    const state = store.getState();
                    const loggedInUser = getLoggedInUserFromStore(state);
                    const deviceLayout = getDeviceLayoutFromStore(state);
                    if (loggedInUser) {
                        await peerNode.sendTo(addConnectedUserAction(peerNode.peerId, loggedInUser,
                            window.innerWidth, window.innerHeight, deviceLayout), {only: [peerId]});
                    }
                }},
                {event: 'data', callback: (peerNode, peerId, data) => peerMessageHandler(store, peerNode, peerId, data)},
                {event: 'close', callback: (peerNode, peerId) => {
                    store.dispatch(removeConnectedUserAction(peerId));
                }}
            ]
        },
        getSendToOptions: (action: AnyAction) => {
            if (action.peerKey) {
                const throttleKey = `${action.type}.${action.peerKey}`;
                if (action.gmOnly) {
                    const connectedUsers = getConnectedUsersFromStore(store.getState());
                    const gmClientPeerIds = Object.keys(connectedUsers)
                        .filter((peerId) => (connectedUsers[peerId].verifiedGM));
                    return {throttleKey, onSentMessage, only: gmClientPeerIds};
                } else {
                    return {throttleKey, onSentMessage};
                }
            } else {
                return undefined;
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

export function getTabletopFromStore(store: ReduxStoreType): TabletopType {
    return store.tabletop;
}

export function getTabletopValidationFromStore(store: ReduxStoreType): TabletopValidationType {
    return store.tabletopValidation;
}

export function getBundleIdFromStore(store: ReduxStoreType): BundleReducerType {
    return store.bundleId;
}

export function getCreateInitialStructureFromStore(store: ReduxStoreType): CreateInitialStructureReducerType {
    return store.createInitialStructure;
}

export function getDeviceLayoutFromStore(store: ReduxStoreType): DeviceLayoutReducerType {
    return store.deviceLayout;
}