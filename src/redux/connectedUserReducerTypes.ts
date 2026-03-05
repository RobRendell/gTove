import {Action} from 'redux';

import {AppVersion} from '../util/appVersion';
import {MovementPathPoint, ObjectVector3} from '../util/scenarioUtils';
import {DriveUser} from '../util/storage/providers/google/googleDriveUtils';
import {NetworkedAction} from '../util/types';
import {DeviceLayoutReducerType} from './deviceLayoutReducerTypes';

export enum ConnectedUserActionTypes {
    ADD_CONNECTED_USER = 'add-connected-user',
    UPDATE_CONNECTED_USER = 'update-connected-user',
    REMOVE_CONNECTED_USER = 'remove-connected-user',
    REMOVE_ALL_CONNECTED_USERS = 'remove-all-connected-users',
    VERIFY_CONNECTION_ACTION = 'verify-connection-action',
    SET_USER_ALLOWED = 'set-user-allowed',
    UPDATE_USER_RULER = 'update-user-ruler',
    UPDATE_USER_RULER_DISTANCE = 'update-user-ruler-distance'
}

export interface AddConnectedUserActionType extends Action {
    type: ConnectedUserActionTypes.ADD_CONNECTED_USER;
    peerId: string;
    user: DriveUser;
    version: AppVersion;
    deviceWidth: number;
    deviceHeight: number;
    deviceLayout: DeviceLayoutReducerType;
}

export interface UpdateConnectedUserDeviceActionType extends Action {
    type: ConnectedUserActionTypes.UPDATE_CONNECTED_USER;
    peerId: string;
    peerKey: string;
    deviceWidth: number;
    deviceHeight: number;
}

export interface RemoveConnectedUserActionType extends Action {
    type: ConnectedUserActionTypes.REMOVE_CONNECTED_USER;
    peerId: string;
}

export interface RemoveAllConnectedUsersActionType extends Action {
    type: ConnectedUserActionTypes.REMOVE_ALL_CONNECTED_USERS;
}

export interface VerifyConnectionActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.VERIFY_CONNECTION_ACTION;
    peerId: string;
    verifiedConnection: boolean;
    private: true;
}

export interface SetUserAllowedActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.SET_USER_ALLOWED;
    peerId: string;
    allowed: boolean;
    private: true;
}

export interface UpdateUserRulerActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.UPDATE_USER_RULER;
    peerId: string;
    ruler?: ConnectedUserRuler;
    peerKey: string;
}

export interface UpdateUserRulerDistanceActionType extends NetworkedAction {
    type: ConnectedUserActionTypes.UPDATE_USER_RULER_DISTANCE;
    peerId: string;
    distance: string;
    peerKey: string;
}

export type LocalOnlyAction = VerifyConnectionActionType | SetUserAllowedActionType;
export type ConnectedUserReducerAction = AddConnectedUserActionType | UpdateConnectedUserDeviceActionType |
    RemoveConnectedUserActionType | RemoveAllConnectedUsersActionType | LocalOnlyAction | UpdateUserRulerActionType |
    UpdateUserRulerDistanceActionType;

export interface ConnectedUserRuler {
    start: MovementPathPoint;
    end: ObjectVector3;
    distance: string;
    mapId?: string;
}

export interface SingleConnectedUser {
    user: DriveUser;
    version?: AppVersion;
    challenge: string;
    verifiedConnection: null | boolean;
    verifiedGM: null | boolean;
    checkedForTabletop: boolean;
    deviceWidth: number;
    deviceHeight: number;
    ruler?: ConnectedUserRuler;
}

export type ConnectedUserUsersType = {[key: string]: SingleConnectedUser};

export interface ConnectedUserReducerType {
    users: ConnectedUserUsersType;
}