import {combineReducers, Reducer} from 'redux';

import {ConnectedUserActionTypes} from './connectedUserReducerTypes';
import {
    AddDeviceToGroupActionType,
    DeviceLayoutReducerActionTypes,
    DeviceLayoutReducerType,
    DeviceLayoutType,
    GroupCameraType,
    RemoveDeviceFromGroupActionType,
    UpdateDevicePositionActionType,
    UpdateDeviceReducerAction,
    UpdateGroupCameraActionType,
    UpdateGroupCameraFocusMapIdActionType
} from './deviceLayoutReducerTypes';
import {objectMapReducer} from './genericReducers';

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

export function updateGroupCameraAction(deviceGroupId: string, camera: Partial<GroupCameraType>, animate: number): UpdateGroupCameraActionType {
    return {type: DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA, peerKey: 'camera' + deviceGroupId, deviceGroupId, camera, animate};
}

export function updateGroupCameraFocusMapIdAction(deviceGroupId: string, focusMapId?: string): UpdateGroupCameraFocusMapIdActionType {
    return {type: DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA_FOCUS_MAP_ID, peerKey: 'cameraMapFocus' + deviceGroupId, deviceGroupId, focusMapId};
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

function singleCameraReducer(state: GroupCameraType = {animate: 0}, action: UpdateDeviceReducerAction) {
    switch (action.type) {
        case DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA:
            return {...state, ...action.camera, animate: action.animate};
        case DeviceLayoutReducerActionTypes.UPDATE_GROUP_CAMERA_FOCUS_MAP_ID:
            return {...state, focusMapId: action.focusMapId};
        default:
            return state;
    }
}

const layoutAndGroupCameraReducer = combineReducers<DeviceLayoutReducerType>({
    layout: objectMapReducer<DeviceLayoutType>('peerId', singleDeviceLayoutReducer as Reducer<DeviceLayoutType>),
    groupCamera: objectMapReducer<GroupCameraType>('deviceGroupId', singleCameraReducer as Reducer<GroupCameraType>)
});

const deviceLayoutReducer: Reducer<DeviceLayoutReducerType> = (state = {layout: {}, groupCamera: {}}, action) => {
    let nextState = layoutAndGroupCameraReducer(state, action);
    switch (action.type) {
        case DeviceLayoutReducerActionTypes.ADD_DEVICE_TO_GROUP:
            if (action.peerId < action.deviceGroupId) {
                return rebaseDeviceGroup(nextState, action.deviceGroupId, action.peerId);
            } else {
                return nextState;
            }
        // @ts-expect-error falls through
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            if (!state.layout[action.peerId]) {
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
        case ConnectedUserActionTypes.ADD_CONNECTED_USER:
            return {
                layout: {...(action.deviceLayout && action.deviceLayout.layout), ...state.layout},
                groupCamera: {...(action.deviceLayout && action.deviceLayout.groupCamera), ...state.groupCamera},
            };
        default:
            return nextState;
    }
};

export default deviceLayoutReducer;

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
