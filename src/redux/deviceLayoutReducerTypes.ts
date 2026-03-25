import {Action} from 'redux';

import {ObjectVector3} from '../util/scenarioUtils';
import {AddConnectedUserActionType, RemoveConnectedUserActionType} from './connectedUserReducerTypes';
import {ObjectMapReducerType} from './genericReducersTypes';

export interface DeviceLayoutType {
    peerId: string;
    deviceGroupId: string;
    x: number;
    y: number;
}

export interface GroupCameraType {
    peerId?: string;
    cameraPosition?: ObjectVector3;
    cameraLookAt?: ObjectVector3;
    animate: number;
    focusMapId?: string;
}

export interface DeviceLayoutReducerType {
    layout: ObjectMapReducerType<DeviceLayoutType>;
    groupCamera: ObjectMapReducerType<GroupCameraType>;
}

export enum DeviceLayoutReducerActionTypes {
    ADD_DEVICE_TO_GROUP = 'add-device-to-group',
    REMOVE_DEVICE_FROM_GROUP = 'remove-device-from-group',
    UPDATE_DEVICE_POSITION = 'update-device-position',
    UPDATE_GROUP_CAMERA = 'update-group-camera',
    UPDATE_GROUP_CAMERA_FOCUS_MAP_ID = 'update-group-camera-focus-map-id'
}

export interface AddDeviceToGroupActionType extends Action {
    type: DeviceLayoutReducerActionTypes.ADD_DEVICE_TO_GROUP;
    peerId: string;
    peerKey: string;
    deviceGroupId: string;
    x: number;
    y: number;
}

export interface RemoveDeviceFromGroupActionType extends Action {
    type: DeviceLayoutReducerActionTypes.REMOVE_DEVICE_FROM_GROUP;
    peerId: string;
    peerKey: string;
}

export interface UpdateDevicePositionActionType extends Action {
    type: DeviceLayoutReducerActionTypes.UPDATE_DEVICE_POSITION;
    peerId: string;
    peerKey: string;
    x: number;
    y: number;
}

export interface UpdateGroupCameraActionType extends Action {
    type: DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA;
    peerKey: string;
    peerId: string;
    deviceGroupId: string;
    camera: Partial<GroupCameraType>;
    animate: number;
    focusMapId?: string;
}

export interface UpdateGroupCameraFocusMapIdActionType extends Action {
    type: DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA_FOCUS_MAP_ID;
    peerKey: string;
    deviceGroupId: string;
    focusMapId: string | null;
}

export type UpdateDeviceReducerAction =
    AddDeviceToGroupActionType
    | RemoveDeviceFromGroupActionType
    | UpdateDevicePositionActionType
    | UpdateGroupCameraActionType
    | UpdateGroupCameraFocusMapIdActionType
    | AddConnectedUserActionType
    | RemoveConnectedUserActionType;