import * as THREE from 'three';
import {Action, AnyAction, combineReducers, Reducer} from 'redux';
import {Omit} from 'react-redux';
import {v4} from 'uuid';
import {GroupByFunction} from 'redux-undo';
import {pick} from 'lodash';

import {objectMapReducer} from './genericReducers';
import {
    getAbsoluteMiniPosition,
    getMapCentreOffsets,
    getRootAttachedMiniId,
    isMapFoggedAtPosition,
    mapMetadataHasNoGrid,
    MapPaintOperation,
    MapType,
    MiniType,
    MovementPathPoint,
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterValue,
    replaceMapMetadata,
    scenarioToJson,
    ScenarioType,
    snapMap
} from '../util/scenarioUtils';
import {
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getUndoableHistoryFromStore,
    ReduxStoreType
} from './mainReducer';
import {buildEuler, buildVector3, eulerToObject, vector3ToObject} from '../util/threeUtils';
import {
    FileMetadata,
    MapProperties,
    MiniProperties,
    PieceVisibilityEnum,
    TemplateProperties
} from '../util/storage/storageContract';
import { castMapProperties, castMiniProperties } from '../util/storage/storageUtils';
import {ConnectedUserActionTypes} from './connectedUserReducer';
import {GToveThunk, isScenarioAction, ScenarioAction} from '../util/types';
import {TabletopReducerActionTypes} from './tabletopReducer';

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
    UPDATE_HEAD_ACTION_ID = 'update-head-action-id',
    CLEAR_UPDATE_SIDE_EFFECT = 'clear-update-side-effect'
}

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

function populateScenarioAction<T extends ScenarioAction>(action: PartialBy<T, 'actionId'|'gmOnly'|'isScenarioAction'>): T {
    const gmOnly = action.gmOnly || false;
    return Object.assign({}, action, {
        actionId: v4(),
        gmOnly,
        isScenarioAction: true
    }) as T;
}

interface SetScenarioAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.SET_SCENARIO_ACTION;
    scenario: Partial<ScenarioType>
}

export function setScenarioAction(scenario: ScenarioType, peerKey: string, gmOnly = false, playersOnly?: boolean): SetScenarioAction {
    return populateScenarioAction({type: ScenarioReducerActionTypes.SET_SCENARIO_ACTION, scenario, peerKey, gmOnly, playersOnly});
}

interface AppendScenarioAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.APPEND_SCENARIO_ACTION;
    scenario: Partial<ScenarioType>
}

export function appendScenarioAction(scenario: ScenarioType, peerKey: string, gmOnly = false): AppendScenarioAction {
    return populateScenarioAction({type: ScenarioReducerActionTypes.APPEND_SCENARIO_ACTION, scenario, peerKey, gmOnly});
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

export function updateSnapToGridAction(snapToGrid: boolean): UpdateSnapToGridActionType {
    return populateScenarioAction({type: ScenarioReducerActionTypes.UPDATE_SNAP_TO_GRID_ACTION, snapToGrid, peerKey: 'snapToGrid'});
}

interface UpdateConfirmMovesActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION;
    confirmMoves: boolean;
}

export function updateConfirmMovesAction(confirmMoves: boolean): UpdateConfirmMovesActionType {
    return populateScenarioAction({type: ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION, confirmMoves, peerKey: 'confirmMoves'});
}

// ======================== Map Actions =========================

interface RemoveMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION;
    mapId: string;
}

export function removeMapAction(mapId: string): GToveThunk<RemoveMapActionType> {
    return undoGroupThunk((dispatch: (action: RemoveMapActionType) => void, getState) => {
        const gmOnly = getGmOnly({getState, mapId});
        // Removing a map should reveal any hidden fogged pieces
        const scenario = getScenarioFromStore(getState());
        for (let miniId of Object.keys(scenario.minis)) {
            const mini = scenario.minis[miniId];
            if (mini.onMapId === mapId && mini.visibility === PieceVisibilityEnum.FOGGED && mini.gmOnly) {
                dispatch(updateMiniGMOnlyAction(miniId, false) as any);
            }
        }
        dispatch(populateScenarioAction({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, mapId, peerKey: mapId, gmOnly}));
    });
}

interface UpdateMapActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION;
    mapId: string;
    map: Partial<MapType>;
}

export function addMapAction(mapParameter: Partial<MapType>, mapId = v4()): UpdateMapActionType {
    const map = {
        ...initialMapState,
        fogOfWar: mapMetadataHasNoGrid(mapParameter.metadata) ? undefined : [],
        ...mapParameter
    };
    return populateScenarioAction({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map, peerKey: mapId, gmOnly: map.gmOnly})
}

function updateMapAction(mapId: string, map: Partial<MapType>, selectedBy: string | null, extra: string = ''): GToveThunk<UpdateMapActionType> {
    return (dispatch: (action: UpdateMapActionType) => void, getState) => {
        let undoGroupId: string | null = null;
        const scenario = getScenarioFromStore(getState());
        const oldMap = scenario.maps[mapId];
        if (extra === fogOfWarExtra) {
            // Updating fog of war needs special handling, to potentially reveal fogged minis
            undoGroupId = v4();
            for (let miniId of Object.keys(scenario.minis)) {
                const mini = scenario.minis[miniId];
                if (mini.onMapId === mapId && mini.visibility === PieceVisibilityEnum.FOGGED) {
                    let rootMiniId = getRootAttachedMiniId(miniId, scenario.minis);
                    const onFog = isMapFoggedAtPosition(oldMap, scenario.minis[rootMiniId].position, map.fogOfWar || null);
                    if (mini.gmOnly !== onFog) {
                        dispatch(undoGroupThunk(updateMiniGMOnlyAction(miniId, onFog), undoGroupId) as any);
                    }
                }
            }
        }
        // Set peerKey to blank (=> don't share over the network) if we're simply rehydrating the metadata.
        const peerKey = (Object.keys(map).length === 1 && map.metadata && map.metadata.id === oldMap.metadata.id)
            ? '' : mapId + extra;
        dispatch(undoGroupAction(populateScenarioAction({
            type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION,
            mapId,
            map: {...map, selectedBy},
            peerKey,
            gmOnly: getGmOnly({getState, mapId})
        }), undoGroupId));
    };
}

export function updateMapMetadataAction(mapId: string, metadata: FileMetadata<void, MapProperties>): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {metadata}, null, 'metadata');
}

export function updateMapPositionAction(mapId: string, position: THREE.Vector3 | ObjectVector3, selectedBy: string | null): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {position: vector3ToObject(position)}, selectedBy, 'position');
}

export function updateMapRotationAction(mapId: string, rotation: THREE.Euler | ObjectEuler, selectedBy: string | null): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {rotation: eulerToObject(rotation)}, selectedBy, 'rotation');
}

const fogOfWarExtra = 'fogOfWar';

export function updateMapFogOfWarAction(mapId: string, fogOfWar?: number[]): GToveThunk<UpdateMapActionType> {
    return updateMapAction(mapId, {fogOfWar}, null, fogOfWarExtra);
}

export function updateMapCameraFocusPoint(mapId: string, cameraFocusPoint?: ObjectVector3 | THREE.Vector3): GToveThunk<UpdateMapActionType> {
    const map = {cameraFocusPoint: cameraFocusPoint ? vector3ToObject(cameraFocusPoint) : undefined};
    return updateMapAction(mapId, map, null, 'cameraFocus');
}

export function updateMapGMOnlyAction(mapId: string, gmOnly: boolean): GToveThunk<UpdateMapActionType | RemoveMapActionType> {
    return (dispatch, getState) => {
        const scenario = getScenarioFromStore(getState());
        const map = {...scenario.maps[mapId], gmOnly};
        if (gmOnly) {
            // If we've turned on gmOnly, then we need to remove the map from peers, then put it back for GMs
            dispatch(populateScenarioAction<RemoveMapActionType>({type: ScenarioReducerActionTypes.REMOVE_MAP_ACTION, mapId, peerKey: mapId, gmOnly: false}));
            dispatch(populateScenarioAction<UpdateMapActionType>({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, peerKey: mapId, map, gmOnly: true}));
        } else {
            // If we've turned off gmOnly, then peers need a complete copy of the map
            dispatch(populateScenarioAction<UpdateMapActionType>({type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION, mapId, map, peerKey: mapId, gmOnly: false}));
        }
    };
}

export function updateMapPaintLayerAction(mapId: string, layerIndex: number, operationIndex: number, operation: MapPaintOperation): GToveThunk<UpdateMapActionType> {
    return (dispatch, getState) => {
        const scenario = getScenarioFromStore(getState());
        const prevMap = scenario.maps[mapId];
        const paintLayers = [...prevMap.paintLayers];
        paintLayers[layerIndex] = prevMap.paintLayers[layerIndex]
            ? {operations: [...prevMap.paintLayers[layerIndex].operations]}
            : {operations: []};
        paintLayers[layerIndex].operations[operationIndex] = operation;
        dispatch(populateScenarioAction({
            type: ScenarioReducerActionTypes.UPDATE_MAP_ACTION,
            mapId,
            map: {paintLayers},
            peerKey: operation.operationId + 'paint',
            gmOnly: getGmOnly({getState, mapId})
        }));
    };
}

export function clearMapPaintLayerAction(mapId: string) {
    return updateMapAction(mapId, {paintLayers: []}, null, 'paintClear');
}

export function updateMapTransparencyAction(mapId: string, transparent: boolean) {
    return updateMapAction(mapId, {transparent}, null, 'transparent');
}

// ======================== Mini Actions =========================

interface RemoveMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION;
    miniId: string;
    positionObj?: ObjectVector3;
    rotationObj?: ObjectEuler;
    elevation?: number;
}

export function removeMiniAction(miniId: string, playersOnly?: boolean): GToveThunk<RemoveMiniActionType> {
    return (dispatch, getState) => {
        const scenario = getScenarioFromStore(getState());
        const absoluteMiniPosition = getAbsoluteMiniPosition(miniId, scenario.minis);
        if (!absoluteMiniPosition) {
            dispatch(populateScenarioAction({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, miniId, playersOnly, peerKey: 'remove' + miniId, gmOnly: getGmOnly({getState, miniId})}));
        } else {
            const {positionObj, rotationObj, elevation} = absoluteMiniPosition;
            dispatch(populateScenarioAction({type: ScenarioReducerActionTypes.REMOVE_MINI_ACTION, miniId, positionObj, rotationObj, elevation, playersOnly, peerKey: 'remove' + miniId, gmOnly: getGmOnly({getState, miniId})}));
        }
    };
}

interface UpdateMiniActionType extends ScenarioAction {
    type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION;
    miniId: string;
    mini: Partial<MiniType>;
}

export function addMiniAction(miniParameter: Partial<MiniType>): UpdateMiniActionType {
    const miniId: string = v4();
    const mini = {position: ORIGIN, rotation: ROTATION_NONE, scale: 1.0, elevation: 0.0, gmOnly: true, prone: false, flat: false, piecesRosterValues: {}, piecesRosterGMValues: {}, ...miniParameter};
    return populateScenarioAction({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, mini, peerKey: miniId, gmOnly: mini.gmOnly});
}

function updateMiniAction(miniId: string, mini: Partial<MiniType> | ((state: ReduxStoreType) => Partial<MiniType>), selectedBy: string | null, extra: string = ''): GToveThunk<UpdateMiniActionType> {
    return (dispatch, getState) => {
        const prevState = getState();
        const prevScenario = getScenarioFromStore(prevState);
        const prevMini: undefined | MiniType = prevScenario.minis[miniId];
        if (typeof(mini) === 'function') {
            mini = mini(prevState);
        }
        // Changing visibility, position or attachment can affect gmOnly
        if (mini.visibility || mini.position || extra === attachExtra) {
            const visibility = mini.visibility || (prevMini && prevMini.visibility);
            let gmOnly = (visibility === PieceVisibilityEnum.HIDDEN);
            if (visibility === PieceVisibilityEnum.FOGGED) {
                const onMapId = mini.onMapId || (prevMini && prevMini.onMapId);
                let rootMiniId = getRootAttachedMiniId(miniId, prevScenario.minis);
                const position = rootMiniId === miniId ? (mini.position || (prevMini && prevMini.position)) : prevScenario.minis[rootMiniId].position;
                gmOnly = onMapId ? isMapFoggedAtPosition(prevScenario.maps[onMapId], position) : false;
            }
            if (prevMini && prevMini.gmOnly !== gmOnly) {
                mini.gmOnly = gmOnly;
                // also update anything attached to this mini
                for (let otherMiniId of Object.keys(prevScenario.minis)) {
                    if (otherMiniId !== miniId && prevScenario.minis[otherMiniId].visibility === PieceVisibilityEnum.FOGGED
                            && getRootAttachedMiniId(otherMiniId, prevScenario.minis) === miniId) {
                        dispatch(updateMiniGMOnlyAction(otherMiniId, gmOnly) as any);
                    }
                }
            }
        }
        // Changing attachMiniId also affects movementPath
        const updated = {...prevMini, ...mini};
        if (prevMini && updated.attachMiniId !== prevMini.attachMiniId) {
            mini = {...mini, movementPath: !prevScenario.confirmMoves ? undefined : [getCurrentPositionWaypoint(prevMini, mini)]};
        }
        // Changing gmOnly requires special handling
        if (prevMini) {
            if (!prevMini.gmOnly && mini.gmOnly === true) {
                // If we've turned on gmOnly, then we need to remove the mini from players
                dispatch(removeMiniAction(miniId, true) as any);
            } else if (prevMini.gmOnly && mini.gmOnly === false) {
                // If we've turned off gmOnly, then players need a complete copy of the mini
                dispatch(populateScenarioAction<UpdateMiniActionType>({type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION, miniId, peerKey: 'add' + miniId, mini: {...prevMini, gmOnly: false}, playersOnly: true}));
            }
        }
        // Set peerKey to blank (=> don't share over the network) if we're simply rehydrating the metadata.
        const peerKey = (Object.keys(mini).length === 1 && mini.metadata && mini.metadata.id === prevMini.metadata.id)
            ? '' : miniId + extra;
        // Players can't dispatch gmOnly updates, but they can e.g. drag a "fog" visibility mini into fog, which sets
        // gmOnly. So, we need to know if this was a player-initiated action, and set gmOnly false on this update even
        // if it sets the mini's gmOnly flag.
        const loggedInUser = getLoggedInUserFromStore(prevState);
        const tabletop = getTabletopFromStore(prevState);
        const isPlayer = loggedInUser?.emailAddress !== tabletop.gm;
        // Also, if the mini was selected by this player and they're losing visibility of it, we should clear selectedBy.
        const myPeerId = getMyPeerIdFromStore(prevState);
        const isNoLongerSelectedBy = isPlayer && mini.gmOnly && selectedBy === myPeerId;
        // Dispatch the update!
        dispatch(populateScenarioAction({
            type: ScenarioReducerActionTypes.UPDATE_MINI_ACTION,
            miniId,
            mini: {...mini, selectedBy: isNoLongerSelectedBy ? null : selectedBy},
            peerKey,
            gmOnly: isPlayer ? false : (mini.gmOnly !== undefined ? mini.gmOnly : prevMini.gmOnly)
                || (mini.piecesRosterGMValues !== undefined || mini.gmNoteMarkdown !== undefined)
        }));
    };
}

export function updateMiniMetadataAction(miniId: string, metadata: FileMetadata<void, MiniProperties>) {
    return updateMiniAction(miniId, {metadata}, null, 'metadata');
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

const attachExtra = 'attach';

export function updateAttachMinisAction(miniId: string, attachMiniId: string | undefined, position: ObjectVector3, rotation: ObjectEuler, elevation: number): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {attachMiniId, position, rotation, elevation, locked: false}, null, attachExtra);
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

export function updateMiniVisibilityAction(miniId: string, visibility: PieceVisibilityEnum): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {visibility}, null, 'visibility');
}

export function updateMiniGMOnlyAction(miniId: string, gmOnly: boolean): GToveThunk<UpdateMiniActionType> {
    return updateMiniAction(miniId, {gmOnly}, null, 'gmOnly');
}

export function updateMiniRosterValueAction(miniId: string, column: PiecesRosterColumn, value?: PiecesRosterValue) {
    return updateMiniAction(miniId, (state) => {
        const mini = getScenarioFromStore(state).minis[miniId];
        return column.gmOnly
            ? {piecesRosterGMValues: {...mini.piecesRosterGMValues, [column.id]: value}}
            : {piecesRosterValues: {...mini.piecesRosterValues, [column.id]: value}};
    }, null, 'rosterValue')
}

export function updateMiniRosterSimpleAction(miniId: string, piecesRosterSimple: boolean) {
    return updateMiniAction(miniId, {piecesRosterSimple}, null, 'piecesRosterSimple');
}

export function updateMiniNoteMarkdownAction(miniId: string, gmNoteMarkdown?: string) {
    return updateMiniAction(miniId, {gmNoteMarkdown}, null, 'gmNoteMarkdown');
}

interface UpdateMinisOnMapActionType {
    type: ScenarioReducerActionTypes.ADJUST_MINIS_ON_MAP_ACTION;
    mapId: string;
    gmOnly: boolean;
    oldCentre: ObjectVector3;
    newCentre: ObjectVector3;
    deltaPosition?: THREE.Vector3;
    deltaRotation?: number;
}

function updateMinisOnMapAction(mapId: string, gmOnly: boolean, oldCentre: ObjectVector3, newCentre: ObjectVector3, deltaPosition?: THREE.Vector3, deltaRotation?: number): UpdateMinisOnMapActionType {
    return {type: ScenarioReducerActionTypes.ADJUST_MINIS_ON_MAP_ACTION, mapId, gmOnly, oldCentre, newCentre, deltaPosition, deltaRotation};
}

interface ReplaceMetadataAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.REPLACE_METADATA_ACTION;
    oldMetadataId: string;
    newMetadata: FileMetadata<void, MiniProperties | MapProperties>;
}

export function replaceMetadataAction(oldMetadataId: string, newMetadata: FileMetadata<void, MiniProperties | MapProperties>, gmOnly: boolean): ReplaceMetadataAction {
    return populateScenarioAction({type: ScenarioReducerActionTypes.REPLACE_METADATA_ACTION, oldMetadataId, newMetadata, peerKey: 'replaceMetadata' + oldMetadataId, gmOnly});
}

interface ReplaceMapImageAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.REPLACE_MAP_IMAGE_ACTION;
    mapId: string;
    newMetadata: FileMetadata<void, MapProperties>;
}

export function replaceMapImageAction(mapId: string, newMetadata: FileMetadata<void, MapProperties>, gmOnly: boolean): ReplaceMapImageAction {
    return populateScenarioAction({type: ScenarioReducerActionTypes.REPLACE_MAP_IMAGE_ACTION, mapId, newMetadata, peerKey: 'replaceMap' + mapId, gmOnly});
}

interface UpdateHeadActionIdAction extends Action {
    type: ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_ID;
    actionId: string;
    gmOnly: boolean;
}

export function updateHeadActionIdAction(action: ScenarioAction): UpdateHeadActionIdAction {
    return {
        type: ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_ID,
        actionId: action.actionId,
        gmOnly: action.gmOnly
    };
}

interface ClearUpdateSideEffectAction extends ScenarioAction {
    type: ScenarioReducerActionTypes.CLEAR_UPDATE_SIDE_EFFECT;
}

export function clearUpdateSideEffectAction(): ClearUpdateSideEffectAction {
    return populateScenarioAction({type: ScenarioReducerActionTypes.CLEAR_UPDATE_SIDE_EFFECT, peerKey: 'clear-update-side-effect'});
}

export type ScenarioReducerActionType = UpdateSnapToGridActionType | UpdateConfirmMovesActionType | RemoveMapActionType
    | UpdateMapActionType | RemoveMiniActionType | UpdateMiniActionType | ClearUpdateSideEffectAction;

// =========================== Utility functions

function getCurrentPositionWaypoint(state: MiniType, updated?: Partial<MiniType>): MovementPathPoint {
    const position = (updated && updated.position) || state.position;
    const elevation = (updated && updated.elevation) || state.elevation;
    const onMapId = (updated && updated.onMapId) || state.onMapId;
    return {...position, onMapId, elevation};
}

// =========================== Reducers

const ORIGIN = {x: 0, y: 0, z: 0};
const ROTATION_NONE = {x: 0, y: 0, z: 0, order: 'XYZ'};

const initialMapState: MapType = {
    position: ORIGIN,
    rotation: ROTATION_NONE,
    gmOnly: true,
    name: 'New Map',
    selectedBy: null,
    paintLayers: [],
    transparent: false,
    metadata: undefined as any
};

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

function validateMapState(fromAction: Partial<MapType>, state?: MapType): boolean {
    // Verify that the combined state has everything we need to render the map
    return Boolean(
        ((state && state.position) || fromAction.position)
        && ((state && state.rotation) || fromAction.rotation)
        && ((state && state.metadata) || fromAction.metadata)
    );
}

function singleMapReducer(state: MapType, action: UpdateMapActionType) {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_MAP_ACTION:
            if (validateMapState(action.map, state)) {
                // Avoid race condition where maps can be partially created
                return {...state, ...action.map};
            } else {
                return state;
            }
        default:
            return state;
    }
}

const allMapsReducer = objectMapReducer<MapType>('mapId', singleMapReducer as Reducer<MapType>, {deleteActionType: ScenarioReducerActionTypes.REMOVE_MAP_ACTION});

function updateMapMetadata(state: {[key: string]: MapType}, metadataId: string,
                           metadata: FileMetadata<void, MapProperties>, merge: boolean, snap: boolean): {[key: string]: MapType} {
    // Have to search for matching metadata in all objects in state.
    return Object.keys(state).reduce((result: {[key: string]: MapType} | undefined, id) => {
        if (state[id].metadata && state[id].metadata.id === metadataId) {
            result = result || {...state};
            const newMetadata = {...(merge && result[id].metadata), ...metadata, properties: castMapProperties(metadata.properties)};
            result[id] = replaceMapMetadata(result[id], newMetadata);
            // Also re-snap the map, if grid snap is on.
            if (snap) {
                const {positionObj} = snapMap(true, newMetadata.properties, state[id].position, state[id].rotation);
                state[id].position = positionObj
            }
        }
        return result;
    }, undefined) || state;
}

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
        case ScenarioReducerActionTypes.REPLACE_METADATA_ACTION:
            const replaceMetadata = action as ReplaceMetadataAction;
            return updateMapMetadata(state, replaceMetadata.oldMetadataId,
                replaceMetadata.newMetadata as FileMetadata<void, MapProperties>, false, action.snapToGrid);
        case ScenarioReducerActionTypes.REPLACE_MAP_IMAGE_ACTION:
            const replaceMapImage = action as ReplaceMapImageAction;
            return {
                ...state,
                [replaceMapImage.mapId]: replaceMapMetadata(state[replaceMapImage.mapId], replaceMapImage.newMetadata)
            };
        default:
            return allMapsReducer(state, action);
    }
}

function validateMiniState(fromAction: Partial<MiniType>, state?: MiniType): boolean {
    // Verify that the combined state has everything we need to render the mini
    return (
        ((state && state.position) || fromAction.position)
        && ((state && state.rotation) || fromAction.rotation)
        && ((state && state.metadata) || fromAction.metadata)
        && ((state && !isNaN(state.elevation)) || fromAction.elevation !== undefined)
    ) || false;
}

const singleMiniReducer: Reducer<MiniType> = (state, action) => {
    switch (action.type) {
        case ScenarioReducerActionTypes.UPDATE_MINI_ACTION:
            if (validateMiniState(action.mini, state)) {
                // Avoid race condition where minis can be partially created
                return {...state, ...action.mini};
            } else {
                return state;
            }
        case ScenarioReducerActionTypes.REMOVE_MINI_ACTION:
            if (state && state.attachMiniId === action.miniId) {
                const remove = action as RemoveMiniActionType;
                // Since mini is being detached, calculate its new absolute position based on the position of the one being removed, if available.
                const position = (remove.positionObj && remove.rotationObj) ? vector3ToObject(buildVector3(state.position).applyEuler(buildEuler(remove.rotationObj)).add(remove.positionObj as THREE.Vector3)) : state.position;
                const rotation = remove.rotationObj ? {x: state.rotation.x + remove.rotationObj.x, y: state.rotation.y + remove.rotationObj.y, z: state.rotation.z + remove.rotationObj.z, order: state.rotation.order} : state.rotation;
                const elevation = state.elevation + (remove.elevation || 0);
                return {
                    ...state,
                    attachMiniId: undefined,
                    locked: false,
                    position, rotation, elevation
                };
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

function updateMiniMetadata(state: {[key: string]: MiniType}, metadataId: string, metadata: FileMetadata<void, MiniProperties | TemplateProperties>, merge: boolean): {[key: string]: MiniType} {
    // Have to search for matching metadata in all objects in state.
    return Object.keys(state).reduce((result: {[key: string]: MiniType} | undefined, id) => {
        if (state[id].metadata && state[id].metadata.id === metadataId) {
            result = result || {...state};
            result[id] = Object.assign({}, result[id], {metadata: {...(merge && result[id].metadata), ...metadata, properties: castMiniProperties(metadata.properties)}});
        }
        return result;
    }, undefined) || state;
}

const allMinisBatchUpdateReducer: Reducer<{[key: string]: MiniType}> = (state = {}, action) => {
    switch (action.type) {
        case ConnectedUserActionTypes.REMOVE_CONNECTED_USER:
            // Unselect any minis selected by removed peerId
            return updateAllKeys(state, action, (mini, action) => (
                (mini.selectedBy === action.peerId) ? {...mini, selectedBy: null} : undefined
            ));
        case ScenarioReducerActionTypes.REPLACE_METADATA_ACTION:
            const replaceMetadata = action as ReplaceMetadataAction;
            return updateMiniMetadata(state, replaceMetadata.oldMetadataId,
                replaceMetadata.newMetadata as FileMetadata<void, MiniProperties>, false);
        case ScenarioReducerActionTypes.UPDATE_CONFIRM_MOVES_ACTION:
            return Object.keys(state).reduce((nextState, miniId) => {
                const miniState = state[miniId];
                (nextState as any)[miniId] = {...miniState, movementPath: action.confirmMoves ? [getCurrentPositionWaypoint(miniState)] : undefined};
                return nextState;
            }, {});
        case ScenarioReducerActionTypes.ADJUST_MINIS_ON_MAP_ACTION:
            return Object.keys(state).reduce<undefined | {[key: string]: MiniType}>((nextState, miniId) => {
                const miniState = state[miniId];
                if (miniState.onMapId === action.mapId && (miniState.gmOnly || !action.gmOnly) && !miniState.attachMiniId) {
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
        case TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION:
            // If the pieces roster columns are updated, clean up piecesRosterValues and piecesRosterGMValues to contain
            // only values for columns that still exist.  Also, data may need to move from player to GM or vice versa.
            const piecesRosterColumns: PiecesRosterColumn[] = action.tabletop.piecesRosterColumns;
            if (piecesRosterColumns) {
                const playerColumnIds = piecesRosterColumns.filter((column) => (!column.gmOnly)).map((column) => (column.id));
                const gmColumnIds = piecesRosterColumns.filter((column) => (column.gmOnly)).map((column) => (column.id));
                return Object.keys(state).reduce((all, miniId) => {
                    const combinedValues = {...state[miniId].piecesRosterValues, ...state[miniId].piecesRosterGMValues};
                    (all as any)[miniId] = {
                        ...state[miniId],
                        piecesRosterValues: pick(combinedValues, playerColumnIds),
                        piecesRosterGMValues: pick(combinedValues, gmColumnIds)
                    };
                    return all;
                }, {});
            }
            return state;
        default:
            return allMinisReducer(state, action);
    }
};

const headActionIdReducer: Reducer<string | null> = (state = null, action) => {
    if (action.type === ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_ID) {
        return action.actionId;
    } else {
        return state;
    }
};

const playerHeadActionIdReducer: Reducer<string | null> = (state = null, action) => {
    if (action.type === ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_ID && !action.gmOnly) {
        return action.actionId;
    } else {
        return state;
    }
};

function updateSideEffectReducer(state: boolean = false, action: AnyAction) {
    switch (action.type) {
        case ScenarioReducerActionTypes.CLEAR_UPDATE_SIDE_EFFECT:
            return false;
        default:
            return state;
    }
}

const scenarioReducer = combineReducers<ScenarioType>({
    updateSideEffect: updateSideEffectReducer,
    snapToGrid: snapToGridReducer,
    confirmMoves: confirmMovesReducer,
    startCameraAtOrigin: (state = false) => (state),
    maps: allMapsFileUpdateReducer,
    minis: allMinisBatchUpdateReducer,
    headActionId: headActionIdReducer,
    playerHeadActionId: playerHeadActionIdReducer
});

export const settableScenarioReducer: Reducer<ScenarioType> = (state, action) => {
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
                const {positionObj: oldPosition, rotationObj: oldRotation} = snapMap(state.snapToGrid, oldMap.metadata.properties!, oldMap.position, oldMap.rotation);
                const newState = scenarioReducer(state, action);
                const newMap = newState.maps[action.mapId];
                const {positionObj: newPosition, rotationObj: newRotation} = snapMap(newState.snapToGrid, newMap.metadata.properties!, newMap.position, newMap.rotation);
                const deltaPosition = action.map.position ? buildVector3(newPosition).sub(oldPosition as THREE.Vector3) : undefined;
                const deltaRotation = action.map.rotation ? newRotation.y - oldRotation.y : undefined;
                const {mapDX, mapDZ} = getMapCentreOffsets(state.snapToGrid, oldMap.metadata.properties!);
                const oldCos = Math.cos(+oldRotation.y);
                const oldSin = Math.sin(+oldRotation.y);
                const oldCentre = {...oldPosition, x: oldPosition.x - oldCos * mapDX - oldSin * mapDZ, z: oldPosition.z - oldCos * mapDZ + oldSin * mapDX};
                const newCos = Math.cos(+newRotation.y);
                const newSin = Math.sin(+newRotation.y);
                const newCentre = {...newPosition, x: newPosition.x - newCos * mapDX - newSin * mapDZ, z: newPosition.z - newCos * mapDZ + newSin * mapDX};
                const fakeAction = updateMinisOnMapAction(action.mapId, oldMap.gmOnly, oldCentre, newCentre, deltaPosition, deltaRotation);
                return scenarioReducer(scenarioReducer(state, fakeAction), action);
            }
            return scenarioReducer(state, action);
        case ScenarioReducerActionTypes.CLEAR_UPDATE_SIDE_EFFECT: // We don't want to treat clearing the update side effect flag as a side-effect!
            return scenarioReducer(state, action);
        default:
            // Make snapToGrid available on actions inside scenarioReducer
            const nextState = scenarioReducer(state, {snapToGrid: state?.snapToGrid, ...action});
            // Detect if an action which is not a scenario action has changed the scenario as a side-effect.
            // Non-scenario actions don't cause the tabletop to save, so these side-effect changes can be lost if
            // they're the last thing dispatched before the tabletop is closed.  Setting the `updateSideEffect` flag
            // can be used to trigger a clearUpdateSideEffect scenario action, saving everything.
            if (!isScenarioAction(action) && state && nextState !== state && action.type !== ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_ID) {
                return {
                    ...nextState,
                    updateSideEffect: true,
                };
            }
            return nextState;
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

// ================== Utility functions to assist with undo/redo functionality ==================

export const UNDO_ACTION_TYPE = 'gtove-undo';
export const REDO_ACTION_TYPE = 'gtove-redo';
export const SEPARATE_UNDO_GROUP_ACTION_TYPE = 'separate-undo-group-action-type';

export interface UndoRedoAction extends ScenarioAction {
}

export function undoAction(): GToveThunk<UndoRedoAction> {
    return (dispatch, getState) => {
        const history = getUndoableHistoryFromStore(getState());
        if (history.past.length > 0) {
            const toScenario = history.past[history.past.length - 1].scenario;
            if (toScenario) {
                dispatch(populateScenarioAction<UndoRedoAction>({type: UNDO_ACTION_TYPE, peerKey: v4()}));
                const [, playerScenario] = scenarioToJson(toScenario);
                dispatch(setScenarioAction(playerScenario, 'undo', false, true) as any);
            }
        }
    };
}

export function redoAction(): GToveThunk<UndoRedoAction> {
    return (dispatch, getState) => {
        const history = getUndoableHistoryFromStore(getState());
        if (history.future.length > 0) {
            const toScenario = history.future[0].scenario;
            if (toScenario) {
                dispatch(populateScenarioAction<UndoRedoAction>({type: REDO_ACTION_TYPE, peerKey: v4()}));
                const [, playerScenario] = scenarioToJson(toScenario);
                dispatch(setScenarioAction(playerScenario, 'redo', false, true) as any);
            }
        }
    };
}

interface SeparateUndoGroupActionType extends Action {
}

export function separateUndoGroupAction(): SeparateUndoGroupActionType {
    return {type: SEPARATE_UNDO_GROUP_ACTION_TYPE};
}

export function undoGroupAction<A extends Action>(action: A, undoGroupId: string | null): A {
    return {...action, undoGroupId};
}

export function undoGroupThunk<A extends Action>(thunk: GToveThunk<A>, undoGroupId = v4()): GToveThunk<A> {
    return (baseDispatch: (action: A) => A, getState: () => ReduxStoreType) => {
        const wrappedDispatch = (action: A) => {
            if (typeof(action) === 'function') {
                return undoGroupThunk(action, undoGroupId)(baseDispatch as any, getState);
            } else {
                baseDispatch({...action, undoGroupId});
                return action;
            }
        };
        return thunk(wrappedDispatch as any, getState);
    };
}

export function undoGroupActionList<T = Action<string> | GToveThunk<Action<string>>>(actions: T[], undoGroupId?: string) {
    return !undoGroupId ? actions :
        actions.map((action: any) => (
            typeof(action) === 'function' ? undoGroupThunk(action, undoGroupId) : undoGroupAction(action, undoGroupId)
        ));
}

export const scenarioUndoGroupBy: GroupByFunction = (action) => (
    action.undoGroupId ? action.undoGroupId : action.peerKey
);

export const scenarioUndoFilter = (action: AnyAction) => {
    switch (action.type) {
        case TabletopReducerActionTypes.UPDATE_TABLETOP_ACTION:
            // Tabletop update actions are "scenario actions", but tabletop is not in undoableState
            return false;
        case ScenarioReducerActionTypes.SET_SCENARIO_LOCAL_ACTION:
            return true;
        default:
            return isScenarioAction(action) && action.peerKey !== undefined;
    }
};
