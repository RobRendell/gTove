import {Location} from 'redux-first-router';
import {FileIndexReducerType} from './fileIndexReducerTypes';
import {TabletopType} from '../util/scenarioUtils';
import {LoggedInUserReducerType} from './loggedInUserReducerTypes';
import {ConnectedUserReducerType} from './connectedUserReducerTypes';
import {BundleReducerType} from './bundleReducerTypes';
import {CreateInitialStructureReducerType} from './createInitialStructureReducerTypes';
import {DeviceLayoutReducerType} from './deviceLayoutReducerTypes';
import {DiceReducerType} from './diceReducerTypes';
import {FolderStacksReducerType} from './folderStacksReducerTypes';
import {ThunkDispatch} from 'redux-thunk';
import {AnyAction} from 'redux';
import {MovableWindowReducerType} from './movableWindowReducerTypes';
import {MyPeerIdReducerType} from './myPeerIdReducerTypes';
import {PingReducerType} from './pingReducerTypes';
import {ServiceWorkerReducerType} from './serviceWorkerReducerTypes';
import {UndoableReducerType} from './undoableReducerTypes';
import {UploadPlaceholderReducerType} from './uploadPlaceholderReducerTypes';
import {WindowTitleReducerType} from './windowTitleReducerTypes';

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
    dice: DiceReducerType;
    pings: PingReducerType;
    serviceWorker: ServiceWorkerReducerType;
    movableWindows: MovableWindowReducerType;
    folderStacks: FolderStacksReducerType;
    uploadPlaceholders: UploadPlaceholderReducerType;
}

export interface GtoveDispatchProp {
    dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>;
}