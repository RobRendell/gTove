import {AnyAction, combineReducers, Reducer} from 'redux';
import {connectRoutes, Location} from 'redux-first-router';
import {ThunkDispatch} from 'redux-thunk';

import {LocationState, routesMap} from './locationReducer';
import fileIndexReducer, {FileIndexReducerType} from './fileIndexReducer';
import scenarioReducer from './scenarioReducer';
import loggedInUserReducer, {LoggedInUserReducerType} from './loggedInUserReducer';
import connectedUserReducer, {ConnectedUserReducerType} from './connectedUserReducer';
import {ScenarioType, TabletopType} from '../util/scenarioUtils';
import tabletopValidationReducer, {TabletopValidationType} from './tabletopValidationReducer';
import myPeerIdReducer, {MyPeerIdReducerType} from './myPeerIdReducer';
import tabletopReducer from './tabletopReducer';
import bundleReducer, {BundleReducerType} from './bundleReducer';
import createInitialStructureReducer, {CreateInitialStructureReducerType} from './createInitialStructureReducer';
import deviceLayoutReducer, {DeviceLayoutReducerType} from './deviceLayoutReducer';
import {debugLogReducer, DebugLogReducerType} from './debugLogReducer';
import windowTitleReducer, {WindowTitleReducerType} from './windowTitleReducer';

const DISCARD_STORE = 'discard_store';

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}

export interface ReduxStoreType {
    location: Location;
    windowTitle: WindowTitleReducerType;
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
    debugLog: DebugLogReducerType;
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
    scenario: scenarioReducer,
    tabletop: tabletopReducer,
    tabletopValidation: tabletopValidationReducer,
    loggedInUser: loggedInUserReducer,
    connectedUsers: connectedUserReducer,
    myPeerId: myPeerIdReducer,
    bundleId: bundleReducer,
    createInitialStructure: createInitialStructureReducer,
    deviceLayout: deviceLayoutReducer,
    debugLog: debugLogReducer
});

const mainReducer: Reducer<ReduxStoreType> = (state, action) => {
    switch (action.type) {
        case DISCARD_STORE:
            return combinedReducers({location: state ? state.location : ''} as ReduxStoreType, action);
        default:
            return combinedReducers(state, action);
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

export function getDebugLogFromStore(store: ReduxStoreType): DebugLogReducerType {
    return store.debugLog;
}