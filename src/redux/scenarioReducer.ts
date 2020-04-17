import * as THREE from 'three';
import {Action, AnyAction, combineReducers, Reducer} from 'redux';
import {Omit} from 'react-redux';
import {v4} from 'uuid';

import {objectMapReducer} from './genericReducers';
import {FileIndexActionTypes, RemoveFilesActionType, UpdateFileActionType} from './fileIndexReducer';
import {
    getMapCentreOffsets,
    MapType,
    MiniType,
    MovementPathPoint,
    ObjectEuler,
    ObjectVector3,
    ScenarioType,
    snapMap
} from '../util/scenarioUtils';
import {getScenarioFromStore, ReduxStoreType} from './mainReducer';
import {buildVector3, eulerToObject, vector3ToObject} from '../util/threeUtils';
import {
    castMapProperties,
    castMiniProperties,
    DriveMetadata,
    GridType,
    MapProperties,
    MiniProperties, ScenarioObjectProperties,
    TemplateProperties
} from '../util/googleDriveUtils';
import {ConnectedUserActionTypes} from './connectedUserReducer';
import {GToveThunk, ScenarioAction} from '../util/types';

// =========================== Action types and generators

export enum ScenarioReducerActionTypes {
    SET_SCENARIO_ACTION = 'set-scenario-action',
    APPEND_SCENARIO_ACTION = 'append-scenario-action',
    SET_SCENARIO_LOCAL_ACTION = 'set-scenario-local-action',
    UPDATE_MAP_ACTION = 'update-map-action',
    UPDATE_MINI_ACTION = 'update-mini-action',
    ADJUST_MINIS_ON_MAP_ACTION = 'adjust-minis-on-map-action',
    REMOVE_MAP_ACTION = 'remove-map-action',
    REMOVE_MINI_ACTION = 'remove-mini-action',
    UPDATE_SNAP_TO_GRID_ACTION = 'update-snap-to-grid-action',
    REPLACE_METADATA_ACTION = 'replace-metadata-action',
    REPLACE_MAP_IMAGE_ACTION = 'replace-map-image-action',
    UPDATE_CONFIRM_MOVES_ACTION = 'update-confirm-moves-action',
    UPDATE_HEAD_ACTION_IDS = 'update-head-action-ids'
}

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

function populateScenarioAction<T extends ScenarioAction>(action: PartialBy<T, 'actionId'|'headActionIds'|'gmOnly'>, getState: () => ReduxStoreType): T {
    const scenario = getScenarioFromStore(getState());
    const gmOnly = action.gmOnly || false;
    return Object.assign({}, action, {
        actionId: v4(),
        headActionIds: gmOnly ? scenario.headActionIds : scenario.playerHeadActionIds,
        gmOnly
    }) as T;
}

function populateScenarioActionThunk<T extends ScenarioAction>(action: PartialBy<T, 'actionId'|'headActionIds'|'gmOnly'>): GToveThunk<T & ScenarioAction> {
    return (dispatch, getState) => {
        const fullAction = populateScenarioAction(action, getState);
        return dispatch(fullAction);
    };
}

interface SetScenarioAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.SET_SCENARIO_ACTION;
    scenario: Partial<ScenarioType>
}

export function setScenarioAction(scenario: ScenarioType, peerKey: string, gmOnly = false): GToveThunk<SetScenarioAction> {
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.SET_SCENARIO_ACTION, scenario, peerKey, gmOnly});
}

interface AppendScenarioAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.APPEND_SCENARIO_ACTION;
    scenario: Partial<ScenarioType>
}

export function appendScenarioAction(scenario: ScenarioType, peerKey: string, gmOnly = false): GToveThunk<AppendScenarioAction> {
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.APPEND_SCENARIO_ACTION, scenario, peerKey, gmOnly});
}

export interface SetScenarioLocalAction {
    type: ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION;
    scenario: ScenarioType
}

export function setScenarioLocalAction(scenario: ScenarioType): SetScenarioLocalAction {
    return {type: ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION, scenario};
}

interface UpdateSnapToGridActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION;
    snapToGrid: boolean;
}

export function updateSnapToGridAction(snapToGrid: boolean): GToveThunk<UpdateSnapToGridActionType> {
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION, snapToGrid, peerKey: 'snapToGrid'});
}

interface UpdateConfirmMovesActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION;
    confirmMoves: boolean;
}

export function updateConfirmMovesAction(confirmMoves: boolean): GToveThunk<UpdateConfirmMovesActionType> {
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION, confirmMoves, peerKey: 'confirmMoves'});
}

interface RemoveMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION;
    mapId: string;
}

export function removeMapAction(mapId: string): GToveThunk<RemoveMapActionType> {
    return (dispatch: (action: RemoveMapActionType) => void, getState) => {
        const gmOnly = getGmOnly({getState, mapId});
        dispatch(populateScenarioAction({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, mapId, peerKey: mapId, gmOnly}, getState));
    };
}

interface UpdateMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION;
    mapId: string;
    map: Partial<MapType>;
}

export function addMapAction(mapParameter: Partial<MapType>, mapId = v4()): GToveThunk<UpdateMapActionType> {
    const map = {position: ORIGIN, rotation: ROTATION_NONE, gmOnly: true,
        fogOfWar: (mapParameter.metadata && mapParameter.metadata.properties.gridType === GridType.SQUARE) ? [] : undefined, ...mapParameter};
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map, peerKey: mapId, gmOnly: map.gmOnly})
}

function updateMapAction(mapId: string, map: Partial<MapType>, selectedBy: string | null, extra: string = ''): GToveThunk<UpdateMapActionType> {
    return (dispatch: (action: UpdateMapActionType) => void, getState) => {
        const gmOnly = getGmOnly({getState, mapId});
        dispatch(populateScenarioAction({
            type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION,
            mapId,
            map: {...map, selectedBy},
            peerKey: mapId + extra,
            gmOnly
        }, getState));
    };
}

export function updateMapPositionAction(mapId: string, position: THREE.Vector3 | ObjectVector3, selectedBy: string | null): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {position: vector3ToObject(position)}, selectedBy, 'position');
}

export function updateMapRotationAction(mapId: string, rotation: THREE.Euler | ObjectEuler, selectedBy: string | null): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {rotation: eulerToObject(rotation)}, selectedBy, 'rotation');
}

export function finaliseMapSelectedByAction(mapId: string, position: ObjectVector3, rotation: ObjectEuler): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {position, rotation}, null, 'selectedBy');
}

export function updateMapFogOfWarAction(mapId: string, fogOfWar?: number[]): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {fogOfWar}, null, 'fogOfWar');
}

export function updateMapGMOnlyAction(mapId: string, gmOnly: boolean): GToveThunk<UpdateMapActionType | RemoveMapActionType> {
    return (dispatch, getState) => {
        const scenario = getScenarioFromStore(getState());
        const map = {...scenario.maps[mapId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the map from peers, then put it back for GMs
            dispatch(populateScenarioAction<RemoveMapActionType>({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, mapId, peerKey: mapId, gmOnly: false}, getState));
            dispatch(populateScenarioAction<UpdateMapActionType>({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, peerKey: mapId, map, gmOnly: true}, getState));
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the map
            dispatch(populateScenarioAction<UpdateMapActionType>({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map, peerKey: mapId, gmOnly: false}, getState));
        }
    };
}

interface UpdateMapMetadataLocalActionType {
    type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION;
    mapId: string;
    map: {metadata: DriveMetadata<void, MapProperties>}
}

export function updateMapMetadataLocalAction(mapId: string, metadata: DriveMetadata<void, MapProperties>): UpdateMapMetadataLocalActionType {
    return {type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map: {metadata: {...metadata, properties: castMapProperties(metadata.properties)}}};
}

interface RemoveMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION;
    miniId: string;
}

export function removeMiniAction(miniId: string): GToveThunk<RemoveMiniActionType> {
    return (dispatch, getState) => {
        dispatch(populateScenarioAction({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, miniId, peerKey: miniId, gmOnly: getGmOnly({getState, miniId})}, getState));
    };
}

interface UpdateMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION;
    miniId: string;
    mini: Partial<MiniType>;
}

export function addMiniAction(miniParameter: Partial<MiniType>): GToveThunk<UpdateMiniActionType> {
    const miniId: string = v4();
    const mini = {position: ORIGIN, rotation: ROTATION_NONE, scale: 1.0, elevation: 0.0, gmOnly: true, prone: false, flat: false, ...miniParameter};
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini, peerKey: miniId, gmOnly: mini.gmOnly});
}

function updateMiniAction(miniId: string, mini: Partial<MiniType> | ((state: ReduxStoreType) => Partial<MiniType>), selectedBy: string | null, extra: string = ''): GToveThunk<UpdateMiniActionType> {
    return (dispatch, getState) => {
        const prevState = getState();
        if (typeof(mini) === 'function') {
            mini = mini(prevState);
        }
        // Changing attachMiniId also affects movementPath
        const prevScenario = getScenarioFromStore(prevState);
        const prevMini = prevScenario.minis[miniId];
        const updated = {...prevMini, ...mini};
        if (prevMini && updated.attachMiniId !== prevMini.attachMiniId) {
            mini = {...mini, movementPath: !prevScenario.confirmMoves ? undefined : [getCurrentPositionWaypoint(prevMini, mini)]};
        }
        dispatch(populateScenarioAction({
            type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION,
            miniId,
            mini: {...mini, selectedBy},
            peerKey: miniId + extra,
            gmOnly: getGmOnly({getState, miniId})
        }, getState));
    };
}

export function updateMiniNameAction(miniId: string, name: string): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {name}, null, 'name');
}

export function updateMiniPositionAction(miniId: string, position: THREE.Vector3 | ObjectVector3, selectedBy: string | null, onMapId: string | undefined): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {position: vector3ToObject(position), onMapId}, selectedBy, 'position');
}

export function updateMiniRotationAction(miniId: string, rotation: THREE.Euler | ObjectEuler, selectedBy: string | null): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {rotation: eulerToObject(rotation)}, selectedBy, 'rotation');
}

export function updateMiniScaleAction(miniId: string, scale: number, selectedBy: string | null): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {scale}, selectedBy, 'scale');
}

export function updateMiniElevationAction(miniId: string, elevation: number, selectedBy: string | null): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {elevation}, selectedBy, 'elevation');
}

export function finaliseMiniSelectedByAction(miniId: string, position: ObjectVector3, rotation: ObjectEuler, scale: number, elevation: number): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {position, rotation, scale, elevation}, null, 'selectedBy');
}

export function updateMiniLockedAction(miniId: string, locked: boolean): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {locked}, null, 'locked');
}

export function updateMiniProneAction(miniId: string, prone: boolean): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {prone}, null, 'prone');
}

export function updateMiniFlatAction(miniId: string, flat: boolean): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {flat}, null, 'flat');
}

export function updateMiniHideBaseAction(miniId: string, hideBase: boolean): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {hideBase}, null, 'hideBase');
}

export function updateMiniBaseColourAction(miniId: string, baseColour: number): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {baseColour}, null, 'baseColour');
}

export function updateAttachMinisAction(miniId: string, attachMiniId: string | undefined, position: ObjectVector3, rotation: ObjectEuler, elevation: number): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {attachMiniId, position, rotation, elevation}, null, 'attach');
}

export function confirmMiniMoveAction(miniId: string): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, (state) => ({movementPath: [getCurrentPositionWaypoint(getScenarioFromStore(state).minis[miniId])]}), null, 'movementPath');
}

export function addMiniWaypointAction(miniId: string): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, (state) => {
        const mini = getScenarioFromStore(state).minis[miniId];
        return (mini.movementPath) ? {movementPath: [...mini.movementPath, getCurrentPositionWaypoint(mini)]} : {}
    }, null, 'movementPath');
}

export function removeMiniWaypointAction(miniId: string): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, (state) => {
        const mini = getScenarioFromStore(state).minis[miniId];
        return (mini.movementPath) ? {movementPath: mini.movementPath.slice(0, mini.movementPath.length - 1)} : {}
    }, null, 'movementPath');
}

export function cancelMiniMoveAction(miniId: string): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, (state) => {
        const mini = getScenarioFromStore(state).minis[miniId];
        return (mini.movementPath) ? {position: mini.movementPath[0], elevation: mini.movementPath[0].elevation || 0, movementPath: [mini.movementPath[0]]} : {}
    }, null, 'position+movementPath');
}

export function updateMiniGMOnlyAction(miniId: string, gmOnly: boolean): GToveThunk<UpdateMiniActionType | RemoveMiniActionType> {
    return (dispatch, getState) => {
        const scenario = getScenarioFromStore(getState());
        const mini = {...scenario.minis[miniId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the mini from peers, then put it back for GMs
            dispatch(populateScenarioAction<RemoveMiniActionType>({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, miniId, peerKey: miniId, gmOnly: false}, getState));
            dispatch(populateScenarioAction<UpdateMiniActionType>({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, peerKey: miniId, mini, gmOnly: true}, getState));
            // Removing the mini also modified any minis that were attached to it - restore them too.
            for (let otherMiniId of Object.keys(scenario.minis)) {
                if (scenario.minis[otherMiniId].attachMiniId === miniId) {
                    dispatch(populateScenarioAction<UpdateMiniActionType>({
                        type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION,
                        miniId: otherMiniId,
                        peerKey: otherMiniId,
                        mini: {attachMiniId: miniId},
                        gmOnly: true
                    }, getState));
                }
            }
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the mini
            dispatch(populateScenarioAction<UpdateMiniActionType>({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini, peerKey: miniId, gmOnly: false}, getState));
        }
    };
}

interface UpdateMinisOnMapActionType {
    type: ScenarioReducerActionTypes.ADJUST_MINIS_ON_MAP_ACTION;
    mapId: string;
    oldCentre: ObjectVector3;
    newCentre: ObjectVector3;
    deltaPosition?: THREE.Vector3;
    deltaRotation?: number;
}

function updateMinisOnMapAction(mapId: string, oldCentre: ObjectVector3, newCentre: ObjectVector3, deltaPosition?: THREE.Vector3, deltaRotation?: number): UpdateMinisOnMapActionType {
    return {type: ScenarioReducerActionTypes.ADJUST_MINIS_ON_MAP_ACTION, mapId, oldCentre, newCentre, deltaPosition, deltaRotation};
}

interface UpdateMiniMetadataLocalActionType {
    type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION;
    miniId: string;
    mini: {metadata: DriveMetadata<void, MiniProperties>}
}

export function updateMiniMetadataLocalAction(miniId: string, metadata: DriveMetadata<void, MiniProperties>): UpdateMiniMetadataLocalActionType {
    return {type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini: {metadata: {...metadata, properties: castMiniProperties(metadata.properties)}}};
}

interface ReplaceMetadataAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.REPLACE_METADATA_ACTION;
    oldMetadataId: string;
    newMetadataId: string;
}

export function replaceMetadataAction(oldMetadataId: string, newMetadataId: string, gmOnly: boolean): GToveThunk<ReplaceMetadataAction> {
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.REPLACE_METADATA_ACTION, oldMetadataId, newMetadataId, peerKey: 'replaceMetadata' + oldMetadataId, gmOnly});
}

interface ReplaceMapImageAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.REPLACE_MAP_IMAGE_ACTION;
    mapId: string;
    newMetadataId: string;
    gmOnly: boolean;
}

export function replaceMapImageAction(mapId: string, newMetadataId: string, gmOnly: boolean): GToveThunk<ReplaceMapImageAction> {
    return populateScenarioActionThunk({type: ScenarioReducerActionTypes.REPLACE_MAP_IMAGE_ACTION, mapId, newMetadataId, peerKey: 'replaceMap' + mapId, gmOnly});
}

interface UpdateHeadActionIdsAction extends Action {
    type: ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS;
    subtractActionIds: string[];
    addActionId: string;
    gmOnly: boolean;
}

export function updateHeadActionIdsAction(action: ScenarioAction): UpdateHeadActionIdsAction {
    return {
        type: ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS,
        subtractActionIds: action.headActionIds,
        addActionId: action.actionId,
        gmOnly: action.gmOnly
    };
}

export type ScenarioReducerActionType = UpdateSnapToGridActionType | UpdateConfirmMovesActionType | RemoveMapActionType
    | UpdateMapActionType | RemoveMiniActionType | UpdateMiniActionType;

// =========================== Utility functions

function getCurrentPositionWaypoint(state: MiniType, updated?: Partial<MiniType>): MovementPathPoint {
    const position = (updated && updated.position) || state.position;
    const elevation = (updated && updated.elevation) || state.elevation;
    const onMapId = (updated && updated.onMapId) || state.onMapId;
    return {...position, onMapId, elevation};
}

function buildUpdatedHeadActionIds(headActionIds: string[], subtractActions: string[], addAction: string) {
    const subtracted = headActionIds
        .filter((actionId) => (subtractActions.indexOf(actionId) < 0));
    return subtracted.concat(addAction).sort();
}

// =========================== Reducers

const ORIGIN = {x: 0, y: 0, z: 0};
const ROTATION_NONE = {x: 0, y: 0, z: 0, order: 'XYZ'};

function snapToGridReducer(state: boolean = false, action: ScenarioReducerActionType) {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION:
            return action.snapToGrid;
        default:
            return state;
    }
}

function confirmMovesReducer(state: boolean = false, action: UpdateConfirmMovesActionType) {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION:
            return action.confirmMoves;
        default:
            return state;
    }
}

function singleMapReducer(state: MapType, action: UpdateMapActionType) {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_MAP_ACTION:
            return {...state, ...action.map};
        default:
            return state;
    }
}

const allMapsReducer = objectMapReducer<MapType>('mapId', singleMapReducer as Reducer<MapType>, {deleteActionType: ScenarioReducerActionTypes.REMOVE_MAP_ACTION});

function allMapsFileUpdateReducer(state: {[key: string]: MapType} = {}, action: AnyAction) {
    switch (action.type) {
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            // Unselect any maps selected by removed peerId
            return Object.keys(state).reduce<{[key: string]: MapType} | undefined>((all, id) => {
                if (state[id].selectedBy === action.peerId) {
                    all = all || {...state};
                    all[id] = {...state[id], selectedBy: null};
                }
                return all;
            }, undefined) || state;
        case FileIndexActionTypes.UPDATE_FILE_ACTION:
            const updateFile = action as UpdateFileActionType<void, MapProperties>;
            return updateMetadata(state, updateFile.metadata.id, updateFile.metadata, true, castMapProperties);
        case ScenarioReducerActionTypes.REPLACE_METADATA_ACTION:
            const replaceMetadata = action as ReplaceMetadataAction;
            return updateMetadata(state, replaceMetadata.oldMetadataId, {id: replaceMetadata.newMetadataId}, false, castMapProperties);
        case ScenarioReducerActionTypes.REPLACE_MAP_IMAGE_ACTION:
            const replaceMapImage = action as ReplaceMapImageAction;
            return {
                ...state,
                [replaceMapImage.mapId]: {
                    ...state[replaceMapImage.mapId],
                    metadata: {id: replaceMapImage.newMetadataId} as any
                }
            };
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            return removeObjectsReferringToMetadata(state, action as RemoveFilesActionType);
        default:
            return allMapsReducer(state, action);
    }
}

const singleMiniReducer: Reducer<MiniType> = (state, action) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_MINI_ACTION:
            return {...state, ...action.mini};
        case ScenarioReducerActionTypes.REMOVE_MINI_ACTION:
            if (state && state.attachMiniId === action.miniId) {
                return {...state, attachMiniId: undefined};
            } else {
                return state;
            }
        default:
            return state;
    }
};

const allMinisReducer = objectMapReducer<MiniType>('miniId', singleMiniReducer, {deleteActionType: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, reduceDeleteActionOnAll: true});

function updateAllKeys<T>(state: {[key: string]: T}, action: AnyAction, update: (item: T, action: AnyAction) => T | undefined): {[key: string]: T} {
    return Object.keys(state).reduce<{[key: string]: T} | undefined>((all, id) => {
        const updatedItem = update(state[id], action);
        if (updatedItem) {
            all = all || {...state};
            all[id] = updatedItem;
        }
        return all;
    }, undefined) || state;
}

const allMinisBatchUpdateReducer: Reducer<{[key: string]: MiniType}> = (state = {}, action) => {
    switch (action.type) {
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            // Unselect any minis selected by removed peerId
            return updateAllKeys(state, action, (mini, action) => (
                (mini.selectedBy === action.peerId) ? {...mini, selectedBy: null} : undefined
            ));
        case ScenarioReducerActionTypes.REMOVE_MAP_ACTION:
            // Clear the removed mapId from onMapId and movementPath.
            return updateAllKeys(state, action, (mini, action) => {
                const updatedMini = (mini.onMapId === action.mapId) ? {...mini, onMapId: undefined} : undefined;
                if (mini.movementPath && mini.movementPath.reduce((match, point) => (match || point.onMapId === action.mapId), false)) {
                    return {
                        ...(updatedMini || mini),
                        movementPath: mini.movementPath.map((point) => (point.onMapId === action.mapId ? {...point, onMapId: undefined} : point))
                    };
                } else {
                    return updatedMini;
                }
            });
        case FileIndexActionTypes.UPDATE_FILE_ACTION:
            const updateFile = action as UpdateFileActionType<void, MiniProperties>;
            return updateMetadata(state, updateFile.metadata.id, updateFile.metadata, true, castMiniProperties);
        case ScenarioReducerActionTypes.REPLACE_METADATA_ACTION:
            const replaceMetadata = action as ReplaceMetadataAction;
            return updateMetadata(state, replaceMetadata.oldMetadataId, {id: replaceMetadata.newMetadataId}, false, castMiniProperties);
        case FileIndexActionTypes.REMOVE_FILE_ACTION:
            return removeObjectsReferringToMetadata(state, action as RemoveFilesActionType);
        case ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION:
            return Object.keys(state).reduce((nextState, miniId) => {
                const miniState = state[miniId];
                nextState[miniId] = {...miniState, movementPath: action.confirmMoves ? [getCurrentPositionWaypoint(miniState)] : undefined};
                return nextState;
            }, {});
        case ScenarioReducerActionTypes.ADJUST_MINIS_ON_MAP_ACTION:
            return Object.keys(state).reduce<undefined | {[key: string]: MiniType}>((nextState, miniId) => {
                const miniState = state[miniId];
                if (miniState.onMapId === action.mapId) {
                    nextState = nextState || {...state};
                    const position = buildVector3(miniState.position);
                    if (action.deltaRotation) {
                        position.sub(action.oldCentre).applyEuler(new THREE.Euler(0, action.deltaRotation, 0)).add(action.newCentre);
                    }
                    if (action.deltaPosition) {
                        position.add(action.deltaPosition);
                    }
                    nextState[miniId] = {
                        ...miniState,
                        position: vector3ToObject(position),
                        rotation: action.deltaRotation ? {...miniState.rotation, y: miniState.rotation.y + action.deltaRotation} : miniState.rotation
                    };
                }
                return nextState;
            }, undefined) || state;
        default:
            return allMinisReducer(state, action);
    }
};

const headActionIdReducer: Reducer<string[]> = (state = [], action) => {
    if (action.type === ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS) {
        return buildUpdatedHeadActionIds(state, action.subtractActionIds, action.addActionId);
    } else {
        return state;
    }
};

const playerHeadActionIdReducer: Reducer<string[]> = (state = [], action) => {
    if (action.type === ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS && !action.gmOnly) {
        return buildUpdatedHeadActionIds(state, action.subtractActionIds, action.addActionId);
    } else {
        return state;
    }
};

const scenarioReducer = combineReducers<ScenarioType>({
    snapToGrid: snapToGridReducer,
    confirmMoves: confirmMovesReducer,
    startCameraAtOrigin: (state = false) => (state),
    maps: allMapsFileUpdateReducer,
    minis: allMinisBatchUpdateReducer,
    headActionIds: headActionIdReducer,
    playerHeadActionIds: playerHeadActionIdReducer
});

const settableScenarioReducer: Reducer<ScenarioType> = (state, action) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.SET_SCENARIO_ACTION:
        case ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION:
            return scenarioReducer(action.scenario, action);
        case ScenarioReducerActionTypes.APPEND_SCENARIO_ACTION:
            return scenarioReducer({
                ...state,
                maps: {...(state && state.maps), ...action.scenario.maps},
                minis: {...(state && state.minis), ...action.scenario.minis}
            } as any, action);
        case ScenarioReducerActionTypes.UPDATE_MAP_ACTION:
            // This is a hack - reduce a fake action which will adjust the positions/rotations of minis on a map whose
            // position/rotation changes.  The allMinisBatchUpdateReducer function can't just use the UPDATE_MAP_ACTION
            // directly, since adjusting the minis on the map requires information that isn't available down in the
            // minis state.
            if ((action.map.position || action.map.rotation) && state && state.maps[action.mapId]) {
                const oldMap = state.maps[action.mapId];
                const {positionObj: oldPosition, rotationObj: oldRotation} = snapMap(state.snapToGrid, oldMap.metadata.properties, oldMap.position, oldMap.rotation);
                const newState = scenarioReducer(state, action);
                const newMap = newState.maps[action.mapId];
                const {positionObj: newPosition, rotationObj: newRotation} = snapMap(newState.snapToGrid, newMap.metadata.properties, newMap.position, newMap.rotation);
                const deltaPosition = action.map.position ? buildVector3(newPosition).sub(oldPosition as THREE.Vector3) : undefined;
                const deltaRotation = action.map.rotation ? newRotation.y - oldRotation.y : undefined;
                const {mapDX, mapDZ} = getMapCentreOffsets(state.snapToGrid, oldMap.metadata.properties);
                const oldCos = Math.cos(+oldRotation.y);
                const oldSin = Math.sin(+oldRotation.y);
                const oldCentre = {...oldPosition, x: oldPosition.x - oldCos * mapDX - oldSin * mapDZ, z: oldPosition.z - oldCos * mapDZ + oldSin * mapDX};
                const newCos = Math.cos(+newRotation.y);
                const newSin = Math.sin(+newRotation.y);
                const newCentre = {...newPosition, x: newPosition.x - newCos * mapDX - newSin * mapDZ, z: newPosition.z - newCos * mapDZ + newSin * mapDX};
                const fakeAction = updateMinisOnMapAction(action.mapId, oldCentre, newCentre, deltaPosition, deltaRotation);
                return scenarioReducer(scenarioReducer(state, fakeAction), action);
            }
            return scenarioReducer(state, action);
        default:
            return scenarioReducer(state, action);
    }
};

export default settableScenarioReducer;

// =========================== Utility

interface GetGmOnlyParams {
    getState: () => ReduxStoreType;
    mapId?: string | null;
    miniId?: string | null;
}

function getGmOnly({getState, mapId = null, miniId = null}: GetGmOnlyParams): boolean {
    const scenario = getScenarioFromStore(getState());
    if (mapId) {
        return scenario.maps[mapId].gmOnly;
    } else if (miniId) {
        return scenario.minis[miniId].gmOnly;
    } else {
        return false;
    }
}

function updateMetadata(state: {[key: string]: MapType}, metadataId: string, metadata: Partial<DriveMetadata<void, MapProperties>>, merge: boolean, convert: (properties: MapProperties) => MapProperties): {[key: string]: MapType};
function updateMetadata(state: {[key: string]: MiniType}, metadataId: string, metadata: Partial<DriveMetadata<void, MiniProperties | TemplateProperties>>, merge: boolean, convert: (properties: MiniProperties | TemplateProperties) => MiniProperties | TemplateProperties): {[key: string]: MiniType};
function updateMetadata<T extends MapType | MiniType>(state: {[key: string]: T}, metadataId: string, metadata: Partial<DriveMetadata<void, ScenarioObjectProperties>>, merge: boolean, convert: (properties: any) => any): {[key: string]: T} {
    // Have to search for matching metadata in all objects in state.
    return Object.keys(state).reduce((result: {[key: string]: T} | undefined, id) => {
        if (state[id].metadata && state[id].metadata.id === metadataId) {
            result = result || {...state};
            result[id] = Object.assign({}, result[id], {metadata: {...(merge && result[id].metadata), ...metadata, properties: convert(metadata.properties)}});
        }
        return result;
    }, undefined) || state;
}

const removeObjectsReferringToMetadata = <T extends MapType | MiniType>(state: {[key: string]: T}, action: RemoveFilesActionType): {[key: string]: T} => {
    // Remove any objects that reference the metadata
    return Object.keys(state).reduce((result: {[key: string]: T} | undefined, id) => {
        if (state[id].metadata && state[id].metadata.id === action.file.id) {
            result = result || {...state};
            delete(result[id]);
        }
        return result;
    }, undefined) || state;
};
