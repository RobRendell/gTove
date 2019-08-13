import {Action, combineReducers} from 'redux';

import {objectMapReducer, ObjectMapReducerType} from './genericReducers';
import {ConnectedUserActionTypes, RemoveConnectedUserActionType} from './connectedUserReducer';
import {ObjectVector3} from '../util/scenarioUtils';

// =========================== Types

interface DeviceLayoutType {
    peerId: string;
    deviceGroupId: string;
    x: number;
    y: number;
}

interface GroupCameraType {
    cameraPosition?: ObjectVector3;
    cameraLookAt?: ObjectVector3;
}

export interface DeviceLayoutReducerType {
    layout: ObjectMapReducerType<DeviceLayoutType>;
    groupCamera: ObjectMapReducerType<GroupCameraType>;
}

enum DeviceLayoutReducerActionTypes {
    ADD_DEVICE_TO_GROUP = 'add-device-to-group',
    REMOVE_DEVICE_FROM_GROUP = 'remove-device-from-group',
    UPDATE_DEVICE_POSITION = 'update-device-position',
    UPDATE_GROUP_CAMERA = 'update-group-camera'
}

interface AddDeviceToGroupActionType extends Action {
    type: DeviceLayoutReducerActionTypes.ADD_DEVICE_TO_GROUP;
    peerId: string;
    peerKey: string;
    deviceGroupId: string;
    x: number;
    y: number;
}

interface RemoveDeviceFromGroupActionType extends Action {
    type: DeviceLayoutReducerActionTypes.REMOVE_DEVICE_FROM_GROUP;
    peerId: string;
    peerKey: string;
}

interface UpdateDevicePositionActionType extends Action {
    type: DeviceLayoutReducerActionTypes.UPDATE_DEVICE_POSITION;
    peerId: string;
    peerKey: string;
    x: number;
    y: number;
}

interface UpdateGroupCameraActionType extends Action {
    type: DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA;
    peerKey: string;
    deviceGroupId: string;
    camera: Partial<GroupCameraType>;
}

type UpdateDeviceReducerAction = AddDeviceToGroupActionType | RemoveDeviceFromGroupActionType | UpdateDevicePositionActionType
    | UpdateGroupCameraActionType | RemoveConnectedUserActionType;

// =========================== Action generators

export function addDeviceToGroupAction(peerId: string, deviceGroupId: string, x: number, y: number): AddDeviceToGroupActionType {
    return {type: DeviceLayoutReducerActionTypes.ADD_DEVICE_TO_GROUP, peerId, peerKey: 'device' + peerId, deviceGroupId, x, y};
}

export function removeDeviceFromGroupAction(peerId: string): RemoveDeviceFromGroupActionType {
    return {type: DeviceLayoutReducerActionTypes.REMOVE_DEVICE_FROM_GROUP, peerId, peerKey: 'device' + peerId};
}

export function updateDevicePositionAction(peerId: string, x: number, y: number): UpdateDevicePositionActionType {
    return {type: DeviceLayoutReducerActionTypes.UPDATE_DEVICE_POSITION, peerId, peerKey: 'device' + peerId, x, y};
}

export function updateGroupCameraAction(deviceGroupId: string, camera: Partial<GroupCameraType>): UpdateGroupCameraActionType {
    return {type: DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA, peerKey: 'camera' + deviceGroupId, deviceGroupId, camera};
}

// =========================== Reducers

function singleDeviceLayoutReducer(state: DeviceLayoutType, action: UpdateDeviceReducerAction) {
    switch (action.type) {
        case DeviceLayoutReducerActionTypes.ADD_DEVICE_TO_GROUP:
            return {...state, peerId: action.peerId, deviceGroupId: action.deviceGroupId, x: action.x, y: action.y};
        case DeviceLayoutReducerActionTypes.UPDATE_DEVICE_POSITION:
            return {...state, x: action.x, y: action.y};
        default:
            return state;
    }
}

function singleCameraReducer(state: GroupCameraType = {}, action: UpdateDeviceReducerAction) {
    if (action.type === DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA) {
        return {...state, ...action.camera};
    } else {
        return state;
    }
}

const layoutAndGroupCameraReducer = combineReducers<DeviceLayoutReducerType>({
    layout: objectMapReducer<DeviceLayoutType>('peerId', singleDeviceLayoutReducer),
    groupCamera: objectMapReducer<GroupCameraType>('deviceGroupId', singleCameraReducer)
});

export default function deviceLayoutReducer(state: DeviceLayoutReducerType = {layout: {}, groupCamera: {}}, action: UpdateDeviceReducerAction) {
    let nextState = layoutAndGroupCameraReducer(state, action);
    switch (action.type) {
        case DeviceLayoutReducerActionTypes.ADD_DEVICE_TO_GROUP:
            if (action.peerId < action.deviceGroupId) {
                return rebaseDeviceGroup(nextState, action.deviceGroupId, action.peerId);
            } else {
                return nextState;
            }
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            if (!state[action.peerId]) {
                return state;
            }
            // Else fall through and remove the device from the group.
        case DeviceLayoutReducerActionTypes.REMOVE_DEVICE_FROM_GROUP:
            nextState = {...nextState, layout: {...nextState.layout}};
            delete(nextState.layout[action.peerId]);
            const oldGroupId = state.layout[action.peerId].deviceGroupId;
            let newGroupId = oldGroupId;
            if (oldGroupId === action.peerId) {
                // If we remove the device which defines the group Id, change to the next lowest peerId.
                newGroupId = Object.keys(nextState.layout).reduce((groupId, peerId) => {
                    return (!groupId || peerId < groupId) ? peerId : groupId;
                }, '');
            }
            return rebaseDeviceGroup(nextState, oldGroupId, newGroupId, true);
        default:
            return nextState;
    }
}

function rebaseDeviceGroup(state: DeviceLayoutReducerType, oldGroupId: string, newGroupId: string, cleanUpSingletonGroups = false): DeviceLayoutReducerType {
    let singleton: string | undefined = '';
    const layout = Object.keys(state.layout).reduce((all, peerId) => {
        if (all[peerId].deviceGroupId === oldGroupId) {
            if (singleton === '') {
                singleton = peerId;
            } else {
                singleton = undefined;
            }
            all[peerId] = {...all[peerId], deviceGroupId: newGroupId};
        }
        return all;
    }, {...state.layout});
    const groupCamera = {...state.groupCamera, [newGroupId]: state.groupCamera[oldGroupId]};
    if (oldGroupId !== newGroupId) {
        delete(groupCamera[oldGroupId]);
    }
    if (cleanUpSingletonGroups && singleton) {
        delete(layout[singleton]);
        delete(groupCamera[singleton]);
    }
    return {layout, groupCamera};
}
