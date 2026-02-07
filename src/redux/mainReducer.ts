import {combineReducers, Reducer} from 'redux';
import {connectRoutes} from 'redux-first-router';

import {ScenarioType, TabletopType} from '../util/scenarioUtils';
import appUpdateReducer from './appUpdateReducer';
import {AppUpdateReducerType} from './appUpdateReducerTypes';
import bundleReducer from './bundleReducer';
import {BundleReducerType} from './bundleReducerTypes';
import connectedUserReducer from './connectedUserReducer';
import {ConnectedUserReducerType} from './connectedUserReducerTypes';
import createInitialStructureReducer from './createInitialStructureReducer';
import {CreateInitialStructureReducerType} from './createInitialStructureReducerTypes';
import deviceLayoutReducer from './deviceLayoutReducer';
import {DeviceLayoutReducerType} from './deviceLayoutReducerTypes';
import {DiceBagReducerType} from './diceBagReducerTypes';
import diceReducer from './diceReducer';
import {DiceReducerType} from './diceReducerTypes';
import fileIndexReducer from './fileIndexReducer';
import {FileIndexReducerType} from './fileIndexReducerTypes';
import folderStacksReducer from './folderStacksReducer';
import {FolderStacksReducerType} from './folderStacksReducerTypes';
import {routesMap} from './locationReducer';
import {LocationState} from './locationReducerTypes';
import loggedInUserReducer from './loggedInUserReducer';
import {LoggedInUserReducerType} from './loggedInUserReducerTypes';
import {ReduxStoreType} from './mainReducerTypes';
import {movableWindowReducer} from './movableWindowReducer';
import {MovableWindowReducerType} from './movableWindowReducerTypes';
import myPeerIdReducer from './myPeerIdReducer';
import {MyPeerIdReducerType} from './myPeerIdReducerTypes';
import pingReducer from './pingReducer';
import {PingReducerType} from './pingReducerTypes';
import tabletopReducer from './tabletopReducer';
import {TabletopValidationType} from './tabletopValidationTypes';
import undoableReducers from './undoableReducer';
import {UndoableReducerType} from './undoableReducerTypes';
import uploadPlaceholderReducer from './uploadPlaceholderReducer';
import {UploadPlaceholderReducerType} from './uploadPlaceholderReducerTypes';
import windowTitleReducer from './windowTitleReducer';

const DISCARD_STORE = 'discard_store';

export function discardStoreAction() {
    return {type: DISCARD_STORE};
}

const {
    reducer: locationReducer,
    middleware,
    enhancer
} = connectRoutes<{}, LocationState>(routesMap, {basename: '/gtove', title: 'windowTitle'});

export const reduxFirstMiddleware = middleware;
export const reduxFirstEnhancer = enhancer;

const topLevelReducers = combineReducers<ReduxStoreType>({
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
    dice: diceReducer,
    pings: pingReducer,
    appUpdate: appUpdateReducer,
    movableWindows: movableWindowReducer,
    folderStacks: folderStacksReducer,
    uploadPlaceholders: uploadPlaceholderReducer
});

const mainReducer: Reducer<ReduxStoreType> = (state, action) => {
    switch (action.type) {
        case DISCARD_STORE:
            return topLevelReducers({location: state ? state.location : ''} as ReduxStoreType, action);
        default:
            if (state) {
                // GM clients reduce undo/redo actions differently than player clients, so the undoableState reducer needs
                // to know whether this store is for a GM or a player, but that information is spread out between tabletop
                // and loggedInUser, and different for each client (so can't go in the original action which is broadcast).
                const loggedInUser = getLoggedInUserFromStore(state);
                const tabletop = getTabletopFromStore(state);
                const isGMReduxStore = loggedInUser ? tabletop.gm === loggedInUser.emailAddress : false;
                const connectedUsers = getConnectedUsersFromStore(state);
                const isGMAction = state && action.fromPeerId && connectedUsers.users[action.fromPeerId]
                    ? tabletop.gm === connectedUsers.users[action.fromPeerId].user.emailAddress : isGMReduxStore;
                return topLevelReducers(state, {...action, isGMReduxStore, isGMAction});
            } else {
                return topLevelReducers(state, {...action, isGMReduxStore: false, isGMAction: false});
            }
    }
};

export default mainReducer;

export function getTabletopIdFromStore(store: ReduxStoreType): string {
    return store.location.payload['tabletopId'];
}

export function getTabletopResourceKeyFromStore(store: ReduxStoreType): string | undefined {
    return store.location.payload['resourceKey'];
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

export function getDiceFromStore(store: ReduxStoreType): DiceReducerType {
    return store.dice;
}

export function getPingsFromStore(store: ReduxStoreType): PingReducerType {
    return store.pings;
}

export function getAppUpdateFromStore(store: ReduxStoreType): AppUpdateReducerType {
    return store.appUpdate;
}

export function getMovableWindowsFromStore(store: ReduxStoreType): MovableWindowReducerType {
    return store.movableWindows;
}

export function getFolderStacksFromStore(store: ReduxStoreType): FolderStacksReducerType {
    return store.folderStacks;
}

export function getDiceBagFromStore(store: ReduxStoreType): DiceBagReducerType {
    return store.dice.diceBag;
}

export function getUploadPlaceholdersFromStore(store: ReduxStoreType): UploadPlaceholderReducerType {
    return store.uploadPlaceholders;
}