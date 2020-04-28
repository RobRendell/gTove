import {AnyAction, combineReducers, Reducer} from 'redux';
import {connectRoutes, Location} from 'redux-first-router';
import {ThunkDispatch} from 'redux-thunk';

import {LocationState, routesMap} from './locationReducer';
import fileIndexReducer, {FileIndexReducerType} from './fileIndexReducer';
import undoableReducers, {UndoableReducerType} from './undoableReducer';
import loggedInUserReducer, {LoggedInUserReducerType} from './loggedInUserReducer';
import connectedUserReducer, {ConnectedUserReducerType} from './connectedUserReducer';
import {ScenarioType, TabletopType} from '../util/scenarioUtils';
import {TabletopValidationType} from './tabletopValidationReducer';
import myPeerIdReducer, {MyPeerIdReducerType} from './myPeerIdReducer';
import tabletopReducer from './tabletopReducer';
import bundleReducer, {BundleReducerType} from './bundleReducer';
import createInitialStructureReducer, {CreateInitialStructureReducerType} from './createInitialStructureReducer';
import deviceLayoutReducer, {DeviceLayoutReducerType} from './deviceLayoutReducer';
import {debugLogReducer, DebugLogReducerType} from './debugLogReducer';
import windowTitleReducer, {WindowTitleReducerType} from './windowTitleReducer';
import diceReducer, {DiceReducerType} from './diceReducer';
import pingReducer, {PingReducerType} from './pingReducer';

const DISCARD_STORE = 'discard_store';

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}

export interface ReduxStoreType {
    location: Location;
    windowTitle: WindowTitleReducerType;
    fileIndex: FileIndexReducerType;
    undoableState: UndoableReducerType;
    tabletop: TabletopType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    myPeerId: MyPeerIdReducerType;
    bundleId: BundleReducerType;
    createInitialStructure: CreateInitialStructureReducerType;
    deviceLayout: DeviceLayoutReducerType;
    debugLog: DebugLogReducerType;
    dice: DiceReducerType;
    pings: PingReducerType;
}

export interface GtoveDispatchProp {
    dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>;
}

const {
    reducer: locationReducer,
    middleware,
    enhancer
} = connectRoutes<{}, LocationState>(routesMap, {basename: '/gtove', title: 'windowTitle'});

export const reduxFirstMiddleware = middleware;
export const reduxFirstEnhancer = enhancer;

const combinedReducers = combineReducers<ReduxStoreType>({
    location: locationReducer as any,
    windowTitle: windowTitleReducer,
    fileIndex: fileIndexReducer,
    undoableState: undoableReducers,
    tabletop: tabletopReducer,
    loggedInUser: loggedInUserReducer,
    connectedUsers: connectedUserReducer,
    myPeerId: myPeerIdReducer,
    bundleId: bundleReducer,
    createInitialStructure: createInitialStructureReducer,
    deviceLayout: deviceLayoutReducer,
    debugLog: debugLogReducer,
    dice: diceReducer,
    pings: pingReducer
});

const mainReducer: Reducer<ReduxStoreType> = (state, action) => {
    switch (action.type) {
        case DISCARD_STORE:
            return combinedReducers({location: state ? state.location : ''} as ReduxStoreType, action);
        default:
            // GM clients reduce undo/redo actions differently than player clients, so the undoableState reducer needs
            // to know whether this store is for a GM or a player, but that information is spread out between tabletop
            // and loggedInUser, and different for each client (so can't go in the original action which is broadcast).
            const isGMReduxStore = (state && state.loggedInUser) ? state.tabletop.gm === state.loggedInUser.emailAddress : false;
            return combinedReducers(state, {...action, isGMReduxStore});
    }
};

export default mainReducer;

export function getTabletopIdFromStore(store: ReduxStoreType): string {
    return store.location.payload['tabletopId'];
}

export function getWindowTitleFromStore(store: ReduxStoreType): string {
    return store.windowTitle;
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

export function getUndoableHistoryFromStore(store: ReduxStoreType): UndoableReducerType {
    return store.undoableState;
}

export function getScenarioFromStore(store: ReduxStoreType): ScenarioType {
    return store.undoableState.present.scenario;
}

export function getTabletopValidationFromStore(store: ReduxStoreType): TabletopValidationType {
    return store.undoableState.present.tabletopValidation;
}

export function getTabletopFromStore(store: ReduxStoreType): TabletopType {
    return store.tabletop;
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

export function getDebugLogFromStore(store: ReduxStoreType): DebugLogReducerType {
    return store.debugLog;
}

export function getDiceFromStore(store: ReduxStoreType): DiceReducerType {
    return store.dice;
}

export function getPingsFromStore(store: ReduxStoreType): PingReducerType {
    return store.pings;
}