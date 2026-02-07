import {AnyAction} from 'redux';
import {Location} from 'redux-first-router';
import {ThunkDispatch} from 'redux-thunk';

import {TabletopType} from '../util/scenarioUtils';
import {AppUpdateReducerType} from './appUpdateReducerTypes';
import {BundleReducerType} from './bundleReducerTypes';
import {ConnectedUserReducerType} from './connectedUserReducerTypes';
import {CreateInitialStructureReducerType} from './createInitialStructureReducerTypes';
import {DeviceLayoutReducerType} from './deviceLayoutReducerTypes';
import {DiceReducerType} from './diceReducerTypes';
import {FileIndexReducerType} from './fileIndexReducerTypes';
import {FolderStacksReducerType} from './folderStacksReducerTypes';
import {LoggedInUserReducerType} from './loggedInUserReducerTypes';
import {MovableWindowReducerType} from './movableWindowReducerTypes';
import {MyPeerIdReducerType} from './myPeerIdReducerTypes';
import {PingReducerType} from './pingReducerTypes';
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
    appUpdate: AppUpdateReducerType;
    movableWindows: MovableWindowReducerType;
    folderStacks: FolderStacksReducerType;
    uploadPlaceholders: UploadPlaceholderReducerType;
}

export interface GtoveDispatchProp {
    dispatch: ThunkDispatch<ReduxStoreType, {}, AnyAction>;
}