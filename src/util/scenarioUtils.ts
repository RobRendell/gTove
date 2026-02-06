import * as THREE from 'three';
import memoizeOne from 'memoize-one';
import {v4} from 'uuid';
import stringHash from 'string-hash';
import {clamp} from 'lodash';
import copyToClipboard from 'copy-to-clipboard';

import * as constants from './constants';
import {MINI_HEIGHT, MINI_WIDTH} from './constants';
import {TabletopPathPoint} from '../presentation/tabletopPathComponent';
import {ConnectedUserUsersType} from '../redux/connectedUserReducer';
import {buildEuler, buildVector3, isColourDark, reverseEuler} from './threeUtils';
import {isCloseTo} from './mathsUtils';
import {PaintToolEnum} from '../presentation/paintTools';
import { AnyProperties,
    defaultMapProperties,
    defaultMiniProperties,
    FileMetadata,
    GridType,
    MapProperties,
    MiniProperties,
    PieceVisibilityEnum,
    TemplateProperties } from './storage/storageContract';
import { castMapProperties, castMiniProperties, castTemplateProperties, isTemplateMetadata, isTemplateProperties } from './storage/storageUtils';

export interface WithMetadataType<T extends AnyProperties> {
    metadata: FileMetadata<void, T>;
}

export interface ObjectVector2 {
    x: number;
    y: number;
}

export interface ObjectVector3 {
    x: number;
    y: number;
    z: number;
}

export interface ObjectEuler {
    x: number;
    y: number;
    z: number;
    order: string;
    // For backwards compatibility - should be able to remove eventually.
    _x?: number;
    _y?: number;
    _z?: number;
    _order?: string;
}

export interface MapPaintOperation {
    operationId: string;
    selected: PaintToolEnum;
    points: ObjectVector2[];
    brushSize: number;
    brushColour: string;
}

export interface MapPaintLayer {
    operations: MapPaintOperation[];
}

export interface MapType extends WithMetadataType<MapProperties> {
    name: string;
    position: ObjectVector3;
    rotation: ObjectEuler;
    gmOnly: boolean;
    selectedBy: string | null;
    fogOfWar?: number[]; // Undefined means the map is uncovered; empty array means the map is covered
    cameraFocusPoint?: ObjectVector3;
    paintLayers: MapPaintLayer[];
    transparent: boolean;
}

export type MovementPathPoint = ObjectVector3 & {elevation?: number, onMapId?: string};

export const MINI_VISIBILITY_OPTIONS = [
    {displayName: 'Hide', value: PieceVisibilityEnum.HIDDEN},
    {displayName: 'Fog', value: PieceVisibilityEnum.FOGGED},
    {displayName: 'Show', value: PieceVisibilityEnum.REVEALED}
];

export type PiecesRosterValue = string | number | PiecesRosterFractionValue | boolean[];

export type PiecesRosterValues = {[columnId: string]: PiecesRosterValue | undefined};

export interface MiniType extends WithMetadataType<MiniProperties | TemplateProperties> {
    name: string;
    position: ObjectVector3;
    movementPath?: MovementPathPoint[];
    rotation: ObjectEuler;
    scale: number;
    elevation: number;
    visibility: PieceVisibilityEnum;
    gmOnly: boolean;
    selectedBy: string | null;
    prone: boolean;
    flat: boolean;
    locked: boolean;
    attachMiniId?: string;
    hideBase: boolean;
    baseColour?: number;
    onMapId?: string;
    piecesRosterValues: PiecesRosterValues;
    piecesRosterGMValues: PiecesRosterValues;
    piecesRosterSimple: boolean;
    gmNoteMarkdown?: string;
}

export interface ScenarioType {
    updateSideEffect: boolean;
    snapToGrid: boolean;
    confirmMoves: boolean;
    maps: {[key: string]: MapType};
    minis: {[key: string]: MiniType};
    startCameraAtOrigin?: boolean;
    headActionId: string | null;
    playerHeadActionId: string | null;
}

export enum DistanceMode {
    STRAIGHT = 'STRAIGHT',
    GRID_DIAGONAL_ONE_ONE = 'GRID_DIAGONAL_ONE_ONE',
    GRID_DIAGONAL_THREE_EVERY_TWO = 'GRID_DIAGONAL_THREE_EVERY_TWO'
}

export const distanceModeStrings = {
    [DistanceMode.STRAIGHT]: 'along a straight line',
    [DistanceMode.GRID_DIAGONAL_ONE_ONE]: 'following the grid, diagonals cost one square',
    [DistanceMode.GRID_DIAGONAL_THREE_EVERY_TWO]: 'following the grid, diagonals cost three squares every two'
};

export enum DistanceRound {
    ONE_DECIMAL = 'ONE_DECIMAL',
    ROUND_OFF = 'ROUND_OFF',
    ROUND_UP = 'ROUND_UP',
    ROUND_DOWN = 'ROUND_DOWN'
}

export const distanceRoundStrings = {
    [DistanceRound.ROUND_OFF]: 'rounded off',
    [DistanceRound.ROUND_UP]: 'rounded up',
    [DistanceRound.ROUND_DOWN]: 'rounded down',
    [DistanceRound.ONE_DECIMAL]: 'shown to one decimal place'
};

export interface TabletopUserPreferencesType {
    dieColour: string;
}

export interface TabletopUserControlType {
    whitelist: string[];
    blacklist: string[];
}

export enum PiecesRosterColumnType {
    INTRINSIC = 'intrinsic',
    STRING = 'string',
    NUMBER = 'number',
    BONUS = 'bonus',
    FRACTION = 'fraction'
}

export interface PiecesRosterBaseColumn {
    id: string;
    name: string;
    gmOnly: boolean;
    showNear?: boolean;
}

export interface PiecesRosterIntrinsicColumn {
    type: PiecesRosterColumnType.INTRINSIC;
}

export interface PiecesRosterStringColumn {
    type: PiecesRosterColumnType.STRING;
}

export interface PiecesRosterNumberColumn {
    type: PiecesRosterColumnType.NUMBER | PiecesRosterColumnType.BONUS;
}

export interface PiecesRosterFractionValue {
    numerator?: number;
    denominator: number;
}

export interface PiecesRosterFractionColumn {
    type: PiecesRosterColumnType.FRACTION;
}

// export interface PiecesRosterStatusColumn {
//     type: PiecesRosterColumnType.STATUS;
//     icons: {
//         icon: string;
//         url: boolean;
//     }[];
// }

export type PiecesRosterColumn = PiecesRosterBaseColumn & (
    PiecesRosterIntrinsicColumn | PiecesRosterStringColumn | PiecesRosterNumberColumn | PiecesRosterFractionColumn // | PiecesRosterStatusColumn
);

export interface TabletopType {
    gm: string;
    gmSecret: string | null;
    gmOnlyPing: boolean;
    dicePoolLimit?: number;
    defaultGrid: GridType;
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    baseColourSwatches?: string[];
    templateColourSwatches?: string[];
    gridColourSwatches?: string[];
    paintToolColourSwatches?: string[];
    tabletopLockedPeerId?: string;
    tabletopUserControl?: TabletopUserControlType;
    lastSavedHeadActionId?: string | null;
    lastSavedPlayerHeadActionId?: string | null;
    videoMuted: {[metadataId: string]: boolean | undefined};
    userPreferences: {[key: string]: TabletopUserPreferencesType};
    piecesRosterColumns: PiecesRosterColumn[];
    defaultLabelSize?: number;
}

function replaceMetadataWithId(all: {[key: string]: any}): {[key: string]: any} {
    return Object.keys(all).reduce((result, guid) => {
        (result as any)[guid] = {
            ...all[guid],
            metadata: {id: all[guid].metadata.id, resourceKey: all[guid].metadata.resourceKey}
        };
        return result;
    }, {});
}

function filterObject<T>(object: {[key: string]: T}, filterFn: (object: T) => (T | undefined)) {
    return Object.keys(object).reduce((result, key) => {
        const filtered = filterFn(object[key]);
        if (filtered) {
            (result as any)[key] = filtered;
        }
        return result;
    }, {});
}

export function scenarioToJson(scenario: ScenarioType): ScenarioType[] {
    // Split the scenario into private (everything) and public information.
    const maps = replaceMetadataWithId(scenario.maps);
    const minis = replaceMetadataWithId(scenario.minis);
    return [
        {
            updateSideEffect: false,
            snapToGrid: scenario.snapToGrid,
            confirmMoves: scenario.confirmMoves,
            startCameraAtOrigin: scenario.startCameraAtOrigin,
            maps,
            minis,
            headActionId: scenario.headActionId,
            playerHeadActionId: scenario.playerHeadActionId
        },
        {
            updateSideEffect: false,
            snapToGrid: scenario.snapToGrid,
            confirmMoves: scenario.confirmMoves,
            startCameraAtOrigin: scenario.startCameraAtOrigin,
            maps: filterObject(maps, (map: MapType) => (map.gmOnly ? undefined : map)),
            minis: filterObject(minis, (mini: MiniType) => (mini.gmOnly ? undefined : {...mini, piecesRosterGMValues: {}, gmNoteMarkdown: undefined})),
            headActionId: scenario.playerHeadActionId,
            playerHeadActionId: scenario.playerHeadActionId
        }
    ]
}

function updateMetadata<T extends AnyProperties>(
        fullDriveMetadata: {[key: string]: FileMetadata},
        object: {[key: string]: WithMetadataType<T>},
        converter: (properties: T) => T) {
    Object.keys(object).forEach((id) => {
        const metadata = fullDriveMetadata[object[id].metadata.id] as FileMetadata<void, T>;
        if (metadata) {
            object[id] = {...object[id], metadata: {...metadata, properties: converter(metadata.properties!)}};
        }
    });
}

export const INITIAL_PIECES_ROSTER_COLUMNS: PiecesRosterColumn[] = [
    {name: 'Name', id: v4(), gmOnly: false, showNear: true, type: PiecesRosterColumnType.INTRINSIC},
    {name: 'Focus', id: v4(), gmOnly: false, type: PiecesRosterColumnType.INTRINSIC},
    {name: 'Visibility', id: v4(), gmOnly: true, type: PiecesRosterColumnType.INTRINSIC},
    {name: 'Locked', id: v4(), gmOnly: true, type: PiecesRosterColumnType.INTRINSIC}
];

export function jsonToScenarioAndTabletop(
    combined: ScenarioType & TabletopType,
    fullDriveMetadata: {[key: string]: FileMetadata})
    : [ScenarioType, TabletopType] 
{
    Object.keys(combined.minis).forEach((miniId) => {
        const mini = combined.minis[miniId];
        // Convert minis with old-style startingPosition point to movementPath array
        if ((mini as any)['startingPosition']) {
            mini.movementPath = [(mini as any)['startingPosition']];
            delete((mini as any)['startingPosition']);
        }
        // If missing, set visibility based on gmOnly
        if (mini.visibility === undefined) {
            mini.visibility = (mini.gmOnly) ? PieceVisibilityEnum.HIDDEN : PieceVisibilityEnum.REVEALED;
        }
    });
    Object.keys(combined.maps).forEach((mapId) => {
        const map = combined.maps[mapId];
        // Add empty paintLayers if missing
        if (!map.paintLayers) {
            map.paintLayers = [];
        }
    });
    // Check for id-only metadata
    updateMetadata(fullDriveMetadata, combined.maps, castMapProperties);
    updateMetadata(fullDriveMetadata, combined.minis, castMiniProperties);
    // Convert old-style lastActionId to headActionIds
    const headActionId = combined.headActionId
        ?? ((combined as any)['headActionIds'] 
            ? (combined as any)['headActionIds'][0] 
            : (combined as any)['lastActionId']);
    const playerHeadActionId = combined.playerHeadActionId
        ?? ((combined as any)['playerHeadActionIds'] 
            ? (combined as any)['playerHeadActionIds'][0] 
            : (combined as any)['lastActionId']);
    // Update/default piecesRosterColumns if necessary.
    const piecesRosterColumns = combined.piecesRosterColumns || INITIAL_PIECES_ROSTER_COLUMNS;
    const nameColumn = piecesRosterColumns.find(isNameColumn);
    if (nameColumn && nameColumn.showNear === undefined) {
        nameColumn.showNear = true;
    }
    // Return scenario and tabletop
    return [
        {
            updateSideEffect: false,
            snapToGrid: combined.snapToGrid,
            confirmMoves: combined.confirmMoves,
            startCameraAtOrigin: combined.startCameraAtOrigin,
            maps: combined.maps,
            minis: combined.minis,
            headActionId,
            playerHeadActionId
        },
        {
            gm: combined.gm,
            gmSecret: combined.gmSecret,
            gmOnlyPing: combined.gmOnlyPing === undefined ? false : combined.gmOnlyPing,
            dicePoolLimit: combined.dicePoolLimit,
            defaultGrid: combined.defaultGrid || GridType.SQUARE,
            distanceMode: combined.distanceMode,
            distanceRound: combined.distanceRound,
            gridScale: combined.gridScale,
            gridUnit: combined.gridUnit,
            baseColourSwatches: combined.baseColourSwatches,
            templateColourSwatches: combined.templateColourSwatches,
            gridColourSwatches: combined.gridColourSwatches,
            paintToolColourSwatches: combined.paintToolColourSwatches,
            lastSavedHeadActionId: headActionId,
            lastSavedPlayerHeadActionId: playerHeadActionId,
            tabletopLockedPeerId: combined.tabletopLockedPeerId,
            tabletopUserControl: combined.tabletopUserControl,
            videoMuted: combined.videoMuted || {},
            userPreferences: combined.userPreferences || {},
            piecesRosterColumns,
            defaultLabelSize: combined.defaultLabelSize
        }
    ];
}

export function getAllScenarioMetadataIds(scenario: ScenarioType): string[] {
    const metadataMap = Object.keys(scenario.maps).reduce((all, mapId) => {
        (all as any)[scenario.maps[mapId].metadata.id] = true;
        return all;
    }, Object.keys(scenario.minis).reduce((all, miniId) => {
        (all as any)[scenario.minis[miniId].metadata.id] = true;
        return all;
    }, {}));
    return Object.keys(metadataMap);
}

function isAboveHexDiagonal(coordStraight: number, coordZigzag: number, hexStraight: number, hexZigzag: number, hexStraightSize: number, hexZigzagSize: number)
{
    if ((hexZigzag%3) !== 0) {
        return false;
    } else if ((hexStraight + hexZigzag)&1) {
        return (coordZigzag < hexZigzagSize / 3 * (coordStraight / hexStraightSize + hexZigzag - hexStraight));
    } else {
        return (coordZigzag < hexZigzagSize / 3 * (1 + hexZigzag + hexStraight - coordStraight / hexStraightSize));
    }
}

export function getGridStride(type: GridType, half: boolean = true) {
    switch (type) {
        case GridType.HEX_VERT:
            return half ? {strideX: constants.SQRT3 / 2, strideY: 0.5} : {strideX: constants.SQRT3, strideY: 1};
        case GridType.HEX_HORZ:
            return half ? {strideX: 0.5, strideY: constants.SQRT3 / 2} : {strideX: 1, strideY: constants.SQRT3};
        default:
            return {strideX: 1, strideY: 1};
    }
}

export function getHexCoordinatesCentreOffset(type: GridType.HEX_HORZ | GridType.HEX_VERT) {
    switch (type) {
        case GridType.HEX_HORZ:
            return {centreX: 1, centreY: 2/3};
        case GridType.HEX_VERT:
            return {centreX: 2/3, centreY: 1};
    }
}

export function cartesianToHexCoords(x: number, y: number, type: GridType.HEX_VERT | GridType.HEX_HORZ) {
    const {strideX, strideY} = getGridStride(type);
    let hexStraight, hexZigzag, above, hexX, hexY;
    if (type === GridType.HEX_VERT) {
        hexZigzag = Math.floor(3 * x / strideX);
        hexStraight = Math.floor(y / strideY);
        above = isAboveHexDiagonal(y, x, hexStraight, hexZigzag, strideY, strideX);
    } else {
        hexStraight = Math.floor(x / strideX);
        hexZigzag = Math.floor(3 * y / strideY);
        above = isAboveHexDiagonal(x, y, hexStraight, hexZigzag, strideX, strideY);
    }
    hexZigzag = Math.floor(hexZigzag / 3);
    if (above) {
        hexZigzag--;
    }
    if (hexZigzag&1) {
        hexStraight -= (hexStraight & 1) ? 0 : 1;
    } else {
        hexStraight &= ~1;
    }
    if (type === GridType.HEX_VERT) {
        hexX = hexZigzag;
        hexY = hexStraight;
    } else {
        hexX = hexStraight;
        hexY = hexZigzag;
    }
    let {centreX, centreY} = getHexCoordinatesCentreOffset(type);
    centreX += hexX;
    centreY += hexY;
    return {strideX, strideY, hexX, hexY, centreX, centreY};
}

const MAP_ROTATION_SNAP = Math.PI / 2;
const MAP_ROTATION_HEX_SNAP = Math.PI / 6;

// A hex map rotated by 30 degrees becomes a grid of the opposite type (horizontal <-> vertical)
export function effectiveHexGridType(mapRotation: number, gridType: GridType.HEX_VERT | GridType.HEX_HORZ): GridType.HEX_VERT | GridType.HEX_HORZ {
    if (Math.round(mapRotation / MAP_ROTATION_HEX_SNAP) % 2 === 0) {
        return gridType;
    } else if (gridType === GridType.HEX_HORZ) {
        return GridType.HEX_VERT;
    } else {
        return GridType.HEX_HORZ;
    }
}

// Returns the coordinates of the map's rotation centre, relative to the map's pixel-based centre (the location that the
// map is anchored in the world space).  Also returns the grid offsets.
export function getMapCentreOffsets(snap: boolean, properties: MapProperties) {
    const {strideX, strideY} = getGridStride(properties.gridType, false);
    const dx = (strideX + properties.gridOffsetX / properties.gridSize) % strideX;
    const dy = (strideY + properties.gridOffsetY / properties.gridSize) % strideY;
    let mapDX = 0, mapDZ = 0;
    if (snap) {
        const mapCentreX = properties.width / 2;
        const mapCentreY = properties.height / 2;
        switch (properties.gridType) {
            case GridType.HEX_HORZ:
            case GridType.HEX_VERT:
                // A hex map should rotate around the centre of the hex closest to the map's centre.
                const {centreX, centreY} = getHexCoordinatesCentreOffset(properties.gridType);
                const {hexX, hexY} = cartesianToHexCoords(mapCentreX + strideX / 2 * centreX - dx, mapCentreY + strideY / 2 * centreY - dy, properties.gridType);
                mapDX = hexX * strideX / 2 + dx - mapCentreX;
                mapDZ = hexY * strideY / 2 + dy - mapCentreY;
                break;
            default:
                // A square map should rotate around the grid intersection closest to the map's centre.
                mapDX = (dx - mapCentreX) % strideX;
                mapDZ = (dy - mapCentreY) % strideY;
                break;
        }
    }
    return {dx, dy, mapDX, mapDZ};
}

export function snapMap(snap: boolean, properties: MapProperties, position: ObjectVector3, rotation: ObjectEuler = {order: 'XYZ', x: 0, y: 0, z: 0}) {
    if (!properties) {
        return {positionObj: position, rotationObj: rotation, dx: 0, dy: 0, width: 10, height: 10};
    }
    const rotationSnap = (properties.gridType === GridType.HEX_HORZ || properties.gridType === GridType.HEX_VERT)
        ? MAP_ROTATION_HEX_SNAP : MAP_ROTATION_SNAP;
    const {dx, dy, mapDX, mapDZ} = getMapCentreOffsets(snap, properties);
    if (snap) {
        const mapRotation = Math.round(rotation.y / rotationSnap) * rotationSnap;
        const cos = Math.cos(mapRotation);
        const sin = Math.sin(mapRotation);
        let x, z;
        switch (properties.gridType) {
            case GridType.HEX_HORZ:
            case GridType.HEX_VERT:
                const snapGridType = effectiveHexGridType(mapRotation, properties.gridType);
                const {strideX, strideY, centreX, centreY} = cartesianToHexCoords(position.x - cos * mapDX - sin * mapDZ, position.z - cos * mapDZ + sin * mapDX, snapGridType);
                x = centreX * strideX - cos * mapDX - sin * mapDZ;
                z = centreY * strideY - cos * mapDZ + sin * mapDX;
                break;
            default:
                x = Math.round(position.x + cos * mapDX + sin * mapDZ) - cos * mapDX - sin * mapDZ;
                z = Math.round(position.z + cos * mapDZ - sin * mapDX) - cos * mapDZ + sin * mapDX;
                break;
        }
        const y = Math.round(+position.y);
        return {
            positionObj: {x, y, z},
            rotationObj: {...rotation, y: mapRotation},
            dx, dy, width: properties.width, height: properties.height
        };
    } else {
        return {positionObj: position, rotationObj: rotation, dx, dy, width: properties.width, height: properties.height};
    }
}

export function getAbsoluteMiniPosition(miniId: string | undefined, minis: {[miniId: string]: MiniType}, snap?: boolean, gridType?: GridType) {
    if (!miniId || !minis[miniId]) {
        return undefined;
    }
    let {position: positionObj, rotation: rotationObj, elevation, attachMiniId, selectedBy, scale} = minis[miniId];
    if (attachMiniId) {
        const baseMiniPosition = getAbsoluteMiniPosition(attachMiniId, minis, snap, gridType);
        if (!baseMiniPosition) {
            return undefined;
        }
        const {positionObj: attachedPosition, rotationObj: attachedRotation, elevation: attachedElevation} = baseMiniPosition;
        positionObj = buildVector3(positionObj).applyEuler(buildEuler(attachedRotation)).add(attachedPosition as THREE.Vector3);
        rotationObj = {x: rotationObj.x + attachedRotation.x, y: rotationObj.y + attachedRotation.y, z: rotationObj.z + attachedRotation.z, order: rotationObj.order};
        elevation += attachedElevation;
    }
    return (snap && gridType) ? snapMini(snap && !!selectedBy, gridType, scale, positionObj, elevation, rotationObj) : {positionObj, rotationObj, elevation};
}

const MINI_SQUARE_ROTATION_SNAP = Math.PI / 4;
const MINI_HEX_ROTATION_SNAP = Math.PI / 6;

export function snapMini(snap: boolean, gridType: GridType, scaleFactor: number, position: ObjectVector3, elevation: number, rotation: ObjectEuler = {order: 'XYZ', x: 0, y: 0, z: 0}) {
    if (snap) {
        const scale = scaleFactor > 1 ? Math.round(scaleFactor) : 1.0 / (Math.round(1.0 / scaleFactor));
        const gridSnap = scale > 1 ? 1 : scale;
        let x, z;
        let rotationSnap;
        switch (gridType) {
            case GridType.HEX_HORZ:
            case GridType.HEX_VERT:
                const {strideX, strideY, centreX, centreY} = cartesianToHexCoords(position.x / gridSnap, position.z / gridSnap, gridType);
                x = centreX * strideX * gridSnap;
                z = centreY * strideY * gridSnap;
                rotationSnap = MINI_HEX_ROTATION_SNAP;
                break;
            default:
                const offset = (scale / 2) % 1;
                x = Math.round((position.x - offset) / gridSnap) * gridSnap + offset;
                z = Math.round((position.z - offset) / gridSnap) * gridSnap + offset;
                rotationSnap = MINI_SQUARE_ROTATION_SNAP;
        }
        const y = Math.round(+position.y);
        return {
            positionObj: {x, y, z},
            rotationObj: {...rotation, y: Math.round(rotation.y / rotationSnap) * rotationSnap},
            scaleFactor: scale,
            elevation: Math.round(elevation)
        };
    } else {
        return {positionObj: position, rotationObj: rotation, scaleFactor, elevation};
    }
}

export function getGridTypeOfMap(map?: MapType, defaultGridType = GridType.NONE) {
    if (!map || !map.metadata.properties) {
        return defaultGridType;
    }
    const gridType = map.metadata.properties.gridType;
    if (gridType === GridType.HEX_VERT || gridType === GridType.HEX_HORZ) {
        return effectiveHexGridType(map.rotation.y, gridType);
    } else {
        return gridType;
    }
}

export function generateMovementPath(movementPath: MovementPathPoint[], maps: {[mapId: string]: MapType}, defaultGridType: GridType): TabletopPathPoint[] {
    return movementPath.map((point) => {
        let gridType = defaultGridType;
        if (point.onMapId) {
            const onMap = maps[point.onMapId];
            gridType = (onMap && onMap.metadata.properties) ? onMap.metadata.properties.gridType : defaultGridType;
            if (onMap && (gridType === GridType.HEX_HORZ || gridType === GridType.HEX_VERT)) {
                gridType = effectiveHexGridType(onMap.rotation.y, gridType);
            }
        }
        return {x: point.x, y: point.y + (point.elevation || 0), z: point.z, gridType};
    });
}

export enum GRID_COLOUR {
    black = 'black', grey = 'grey', white = 'white', brown = 'brown',
    tan = 'tan', red = 'red', yellow = 'yellow', green = 'green',
    cyan = 'cyan', blue = 'blue', magenta = 'magenta',
}
const GRID_COLOUR_TO_HEX: Record<GRID_COLOUR, string> = {
    black: '#000000', grey: '#9b9b9b', white: '#ffffff', brown: '#8b572a',
    tan: '#c77f16', red: '#ff0000', yellow: '#ffff00', green: '#00ff00',
    cyan: '#00ffff', blue: '#0000ff', magenta: '#ff00ff'
};

export function getColourHex(colour: GRID_COLOUR | THREE.Color): number {
    if (colour instanceof THREE.Color) {
        return colour.getHex();
    } else {
        const hex = GRID_COLOUR_TO_HEX[colour] || colour || '#000000';
        return Number.parseInt(hex[0] === '#' ? hex.substr(1) : hex, 16);
    }
}

export function getColourHexString(colour: number | string): string {
    if (typeof(colour) === 'string' && colour[0] === '#') {
        colour = parseInt(colour.slice(1), 16);
    }
    const hexString = Number(colour).toString(16);
    return '#' + ('000000' + hexString).slice(-6);
}

export const getNetworkHubId = memoizeOne((myUserId: string, myPeerId: string | null, gm: string, connectedUsers: ConnectedUserUsersType) => {
    let networkHubId = (myUserId === gm) ? myPeerId : null;
    for (let peerId of Object.keys(connectedUsers)) {
        if (connectedUsers[peerId].user.emailAddress === gm && (!networkHubId || peerId < networkHubId)) {
            networkHubId = peerId;
        }
    }
    return networkHubId;
});

export function *spiralSquareGridGenerator(): IterableIterator<{x: number, y: number}> {
    let horizontal = true, step = 1, delta = 1, x = 0, y = 0;
    while (true) {
        if (horizontal) {
            x += delta;
            if (2 * x * delta >= step) {
                horizontal = false;
            }
        } else {
            y += delta;
            if (2 * y * delta >= step) {
                horizontal = true;
                delta = -delta;
                step++;
            }
        }
        yield {x, y};
    }
}

const hexHorizontalGridPath = [
    {dx: 1, dy: 0},
    {dx: 0.5, dy: 1.5 * constants.INV_SQRT3},
    {dx: -0.5, dy: 1.5 * constants.INV_SQRT3},
    {dx: -1, dy: 0},
    {dx: -0.5, dy: -1.5 * constants.INV_SQRT3},
    {dx: 0.5, dy: -1.5 * constants.INV_SQRT3}
];

const hexVerticalGridPath = [
    {dx: 1.5 * constants.INV_SQRT3, dy: 0.5},
    {dx: 0, dy: 1},
    {dx: -1.5 * constants.INV_SQRT3, dy: 0.5},
    {dx: -1.5 * constants.INV_SQRT3, dy: -0.5},
    {dx: 0, dy: -1},
    {dx: 1.5 * constants.INV_SQRT3, dy: -0.5}
];

export function *spiralHexGridGenerator(gridType: GridType.HEX_HORZ | GridType.HEX_VERT):  IterableIterator<{x: number, y: number}> {
    const path = (gridType === GridType.HEX_HORZ) ? hexHorizontalGridPath : hexVerticalGridPath;
    let x = 0, y = 0, sideLength = 1, direction = 0;
    while (true) {
        // The side length of the 2nd direction in the sequence needs to be one less, to make the circular sequence
        // into a spiral around the centre.
        const {dx, dy} = path[direction];
        for (let step = (direction === 1) ? 1 : 0; step < sideLength; ++step) {
            x += dx;
            y += dy;
            yield {x, y};
        }
        if (++direction >= path.length) {
            direction = 0;
            sideLength++;
        }
    }
}

const ROUND_VECTORS_DELTA = 0.01;

export function roundSquareVectors(start: THREE.Vector3, end: THREE.Vector3) {
    if (start.x <= end.x) {
        start.x = Math.floor(start.x);
        end.x = Math.ceil(end.x + ROUND_VECTORS_DELTA) - ROUND_VECTORS_DELTA;
    } else {
        start.x = Math.ceil(start.x + ROUND_VECTORS_DELTA) - ROUND_VECTORS_DELTA;
        end.x = Math.floor(end.x);
    }
    if (start.z <= end.z) {
        start.z = Math.floor(start.z);
        end.z = Math.ceil(end.z + ROUND_VECTORS_DELTA) - ROUND_VECTORS_DELTA;
    } else {
        start.z = Math.ceil(start.z + ROUND_VECTORS_DELTA) - ROUND_VECTORS_DELTA;
        end.z = Math.floor(end.z);
    }
}

function growHexVectors(startPos: THREE.Vector3, endPos: THREE.Vector3, gridType: GridType.HEX_VERT | GridType.HEX_HORZ, grow = 1) {
    const {centreX, centreY} = getHexCoordinatesCentreOffset(gridType);
    const xStartMore = (startPos.x > endPos.x ? 0.98 : -0.98) * grow;
    startPos.x += centreX * xStartMore;
    endPos.x -= centreX * xStartMore;
    const zStartMore = (startPos.z > endPos.z ? 0.98 : -0.98) * grow;
    startPos.z += centreY * zStartMore;
    endPos.z -= centreY * zStartMore;
}

/**
 * Round vectors in world coordinates so that they snap to the shape of a rectangle around the given map's tiles. Return
 * vectors are relative to the map's world position.
 *
 * @param map The map to whose tiles the vectors should snap.
 * @param rotation The map's current rotation.
 * @param worldStart The world coordinates of the start of the rectangle.
 * @param worldEnd The world coordinates of the end of the rectangle.
 */
export function getMapGridRoundedVectors(map: MapType, rotation: THREE.Euler, worldStart: THREE.Vector3 | ObjectVector3, worldEnd: THREE.Vector3 | ObjectVector3) {
    // Counter-rotate start/end vectors around map position to get their un-rotated equivalent positions
    const mapPosition = buildVector3(map.position);
    const reverseRotation = reverseEuler(rotation);
    const startPos = buildVector3(worldStart).sub(mapPosition).applyEuler(reverseRotation).add(mapPosition);
    const endPos = buildVector3(worldEnd).sub(mapPosition).applyEuler(reverseRotation).add(mapPosition);
    const properties = castMapProperties(map.metadata.properties);
    const {mapDX, mapDZ} = getMapCentreOffsets(true, properties);
    const mapCentre = new THREE.Vector3(mapDX, 0, mapDZ);
    const centreOffset = mapPosition.clone().add(mapCentre);
    startPos.sub(centreOffset);
    endPos.sub(centreOffset);
    if (properties.gridType === GridType.HEX_HORZ || properties.gridType === GridType.HEX_VERT) {
        // At this point startPos/endPos are relative to the centre of the central hex.  Need to align them to the hex grid.
        const {strideX, strideY} = getGridStride(properties.gridType);
        const {centreX, centreY} = getHexCoordinatesCentreOffset(properties.gridType);
        const {hexX: startHexX, hexY: startHexY} = cartesianToHexCoords(startPos.x + strideX * centreX, startPos.z + strideY * centreY, properties.gridType);
        const {hexX: endHexX, hexY: endHexY} = cartesianToHexCoords(endPos.x + strideX * centreX, endPos.z + strideY * centreY, properties.gridType);
        startPos.set(startHexX, startPos.y, startHexY);
        endPos.set(endHexX, endPos.y, endHexY);
        growHexVectors(startPos, endPos, properties.gridType);
        const hexScale = new THREE.Vector3(strideX, 1, strideY);
        startPos.multiply(hexScale);
        endPos.multiply(hexScale);
    } else {
        roundSquareVectors(startPos, endPos);
    }
    // Return the start/end positions as (un-rotated) points relative to the map position
    startPos.add(mapCentre);
    endPos.add(mapCentre);
    return {startPos, endPos};
}

export function getShaderFogOffsets(gridType: GridType, dx: number, dy: number, mapWidth: number, mapHeight: number, fogWidth: number, fogHeight?: number) {
    // Shader textures have their origin at the bottom left corner, so dx/dy need to be transformed to be the offset
    // from the bottom left of the fogOfWar overlay image to the bottom left corner of the map image.
    const {strideX, strideY} = getGridStride(gridType);
    switch (gridType) {
        // Hex grid: (dx, dy) is the offset in world units from the top left of the map mesh to the nearest hex
        // centre on the map texture (+ve direction)
        case GridType.HEX_HORZ:
            return {
                shaderDX: 2 * strideX - dx,
                shaderDY: fogHeight ? (fogHeight * strideY - mapHeight - strideY * 5 / 3 + (dy % strideY)) : dy
            };
        case GridType.HEX_VERT:
            return {
                shaderDX: 4 * strideX / 3 - dx,
                shaderDY: fogHeight ? (fogHeight - mapHeight + dy) % 1 : dy
            };
        default:
            // Square grid: (dx, dy) is the offset in world units from the top left of the map mesh to the nearest grid
            // intersection on the map texture (+ve direction).
            return {
                shaderDX: strideX - dx,
                shaderDY: fogHeight ? (fogHeight - mapHeight - strideY + dy) : dy
            };
    }
}

/**
 * Return a vector with integer x and z (and zero y) giving the coordinates on the fog map that corresponds with the
 * calculated map centre of the map, and also a boolean indicating if the point on the fog map is offset (bumped left on
 * a horizontal hex grid, bumped down on a vertical one).
 */
export function getFogMapCentre(properties: MapProperties): {fogMapCentre: THREE.Vector3, isCentreOffset: boolean} {
    const {dx, dy, mapDX, mapDZ} = getMapCentreOffsets(true, properties);
    const {shaderDX, shaderDY} = getShaderFogOffsets(properties.gridType, dx, dy, properties.width, properties.height, properties.fogWidth, properties.fogHeight);
    let {strideX, strideY} = getGridStride(properties.gridType, false);
    switch (properties.gridType) {
        case GridType.HEX_HORZ:
            strideY /= 2;
            break;
        case GridType.HEX_VERT:
            strideX /= 2;
            break;
    }
    const fogMapCentre = new THREE.Vector3(
        Math.floor((properties.width / 2 + shaderDX + mapDX) / strideX + 0.1),
        0,
        Math.floor(properties.fogHeight - (properties.height / 2 + shaderDY - mapDZ) / strideY + 0.1)
    );
    let isCentreOffset = false;
    switch (properties.gridType) {
        case GridType.HEX_HORZ:
            isCentreOffset = (fogMapCentre.z % 2) === 1;
            break;
        case GridType.HEX_VERT:
            isCentreOffset = (fogMapCentre.x % 2) === 1;
            if (isCentreOffset) {
                fogMapCentre.z--;
            }
            break;
    }
    return {fogMapCentre, isCentreOffset};
}

/**
 * Return vectors indicating the start and end coordinates of the fog rectangle on the map's fog bitmap (i.e.
 * coordinates which are 0,0 at the top left corner of the fog bitmap)
 * @param map The map whose fog bitmap we want to update.
 * @param start A vector in world coordinates indicating the start of the fog rectangle.
 * @param end A vector in world coordinates indicating the end of the fog rectangle.
 */
export function getMapFogRect(map: MapType, start: ObjectVector3, end: ObjectVector3) {
    const rotation = buildEuler(map.rotation);
    const properties = castMapProperties(map.metadata.properties);
    const {startPos, endPos} = getMapGridRoundedVectors(map, rotation, start, end);
    const {mapDX, mapDZ} = getMapCentreOffsets(true, properties);
    const mapCentre = new THREE.Vector3(mapDX, 0, mapDZ);
    startPos.sub(mapCentre);
    endPos.sub(mapCentre);
    const {fogMapCentre, isCentreOffset} = getFogMapCentre(properties);
    if (properties.gridType === GridType.HEX_HORZ || properties.gridType === GridType.HEX_VERT) {
        const {strideX, strideY} = getGridStride(properties.gridType);
        const hexScale = new THREE.Vector3(strideX, 1, strideY);
        startPos.divide(hexScale);
        endPos.divide(hexScale);
        growHexVectors(startPos, endPos, properties.gridType, -1);
        // startPos/endPos are now in hex coordinates, which are doubled in one axis
        if (properties.gridType === GridType.HEX_HORZ) {
            // The pixel shader displaces every second row of the fog bitmap 0.5 left to form the hex pattern.  If the
            // fogCentre hex is on a row that isn't so displaced, hex coordinates with odd x values need to be rounded
            // up as they're halved, rather than down, to correctly align with the fog bitmap.
            const fogOriginBump = isCentreOffset ? 0 : 1;
            startPos.x = Math.floor((Math.round(startPos.x) + fogOriginBump) / 2);
            endPos.x = Math.floor((Math.round(endPos.x) + fogOriginBump) / 2);
        } else {
            // The pixel shader displaces every second column of the fog bitmap 0.5 down to from the hex pattern.  We
            // need to finesse the rounding as we halve the odd y coordinates as above, except that we need to round up
            // when the fogCentre hex *is* on a row that's displaced.
            const fogOriginBump = isCentreOffset ? 1 : 0;
            startPos.z = Math.floor((Math.round(startPos.z) + fogOriginBump) / 2);
            endPos.z = Math.floor((Math.round(endPos.z) + fogOriginBump) / 2);
        }
    }
    startPos.add(fogMapCentre);
    endPos.add(fogMapCentre);
    const startX = clamp(Math.round(Math.min(startPos.x, endPos.x)), 0, properties.fogWidth);
    const startY = clamp(Math.round(Math.min(startPos.z, endPos.z)), 0, properties.fogHeight);
    const endX = Math.max(startX, clamp(Math.floor(Math.max(startPos.x, endPos.x)), 0, properties.fogWidth));
    const endY = Math.max(startY, clamp(Math.floor(Math.max(startPos.z, endPos.z)), 0, properties.fogHeight));
    return {startX, startY, endX, endY, fogWidth: properties.fogWidth, fogHeight: properties.fogHeight};
}

export function getUpdatedMapFogRect(map: MapType, start: ObjectVector3, end: ObjectVector3, reveal: boolean | null) {
    let {startX, startY, endX, endY, fogWidth, fogHeight} = getMapFogRect(map, start, end);
    // Now iterate over FoW bitmap and set or clear bits.
    let fogOfWar = map.fogOfWar ? [...map.fogOfWar] : new Array(Math.ceil(fogWidth * fogHeight / 32.0)).fill(-1);
    const gridType = map.metadata.properties!.gridType;
    // For hex grids, potentially skip every second cell on the edges, to update a rectangle of hexes which
    // doesn't correspond to a strict rectangle of the fog bitmap.
    const singlePoint = (startX === endX && startY === endY);
    const startXOdd = (startX % 2) === 1;
    const endXOdd = (endX % 2) === 1;
    const startYOdd = (startY % 2) === 1;
    const endYOdd = (endY % 2) === 1;
    const pointsSouthEast = (((startX === endX && startYOdd) || start.x < end.x) === ((startY === endY && !startXOdd) || start.z < end.z));
    const combTop = gridType !== GridType.HEX_VERT || singlePoint || (startXOdd ? (!endXOdd && !pointsSouthEast) : (!endXOdd || pointsSouthEast)) ? undefined : 0;
    let combBottom = gridType !== GridType.HEX_VERT || singlePoint || (startXOdd ? (endXOdd || !pointsSouthEast) : (endXOdd && pointsSouthEast)) ? undefined : 1;
    const combLeft = gridType !== GridType.HEX_HORZ || singlePoint ||  (startYOdd ? (endYOdd || pointsSouthEast) : (endYOdd && !pointsSouthEast)) ? undefined : 1;
    let combRight = gridType !== GridType.HEX_HORZ || singlePoint || (startYOdd ? (!endYOdd && pointsSouthEast) : (!endYOdd || !pointsSouthEast)) ? undefined : 0;
    // Special case: Change any purely horizontal/vertical selection which runs against the grain of the hex grid (which
    // would normally just be every second hex) into a zigzagging line of hexes.
    if (!singlePoint) {
        if (gridType === GridType.HEX_VERT && startY === endY) {
            if (startX % 2) {
                combBottom = 1;
                endY++;
            } else {
                combBottom = undefined;
            }
        } else if (gridType === GridType.HEX_HORZ && startX === endX) {
            if (startY % 2) {
                combRight = undefined;
            } else {
                combRight = 0;
                endX++;
            }
        }
    }
    for (let y = startY; y <= endY; ++y) {
        for (let x = startX; x <= endX; ++x) {
            if ((y === startY && x % 2 === combTop) || (y === endY && x % 2 === combBottom)
                || (x === startX && y % 2 === combLeft) || (x === endX && y % 2 === combRight)
            ) {
                continue;
            }
            const textureIndex = x + y * fogWidth;
            const bitmaskIndex = textureIndex >> 5;
            const mask = 1 << (textureIndex & 0x1f);
            if (reveal === null) {
                fogOfWar[bitmaskIndex] ^= mask;
            } else if (reveal) {
                fogOfWar[bitmaskIndex] |= mask;
            } else {
                fogOfWar[bitmaskIndex] &= ~mask;
            }
        }
    }
    return fogOfWar;
}

export function isFogOfWarAtPoint(map: MapType, point: ObjectVector3) {
    if (!map.fogOfWar) {
        return false;
    }
    let {startX, startY, fogWidth} = getMapFogRect(map, point, point);
    const textureIndex = startX + startY * fogWidth;
    const bitmaskIndex = textureIndex >> 5;
    const mask = 1 << (textureIndex & 0x1f);
    return (map.fogOfWar[bitmaskIndex] & mask) === 0;
}

/**
 * Replace the metadata of the map with the newMetadata, and also update fog of war bitmap so it isn't ruined.
 * @param map The map whose metadata is being updated.
 * @param newMetadata The new metadata replacing the current.
 */
export function replaceMapMetadata(map: MapType, newMetadata: FileMetadata<void, MapProperties>): MapType {
    if (map.fogOfWar && map.metadata.properties) {
        const {fogWidth: oldFogWidth, fogHeight: oldFogHeight} = map.metadata.properties;
        const {fogWidth: newFogWidth, fogHeight: newFogHeight} = newMetadata.properties!;
        if (oldFogWidth !== newFogWidth || oldFogHeight !== newFogHeight) {
            const fogWidth = Math.min(oldFogWidth, newFogWidth);
            const fogHeight = Math.min(oldFogHeight, newFogHeight);
            // Adjust the current bitmap so it has the same shape with the new dimensions, as much as possible.
            const fogOfWar = new Array(Math.ceil(newFogWidth * newFogHeight / 32.0)).fill(0);
            for (let y = 0; y < fogHeight; ++y) {
                for (let x = 0; x < fogWidth; ++x) {
                    const newTextureIndex = x + y * newFogWidth;
                    const newBitmaskIndex = newTextureIndex >> 5;
                    const newMask = (1 << (newTextureIndex & 0x1f));
                    const oldTextureIndex = x + y * oldFogWidth;
                    const oldBitmaskIndex = oldTextureIndex >> 5;
                    const oldMask = 1 << (oldTextureIndex & 0x1f);
                    if (map.fogOfWar[oldBitmaskIndex] & oldMask) {
                        fogOfWar[newBitmaskIndex] ^= newMask;
                    }
                }
            }
            return {...map, fogOfWar, metadata: newMetadata};
        }
    }
    return {...map, metadata: newMetadata};
}

export function isMapFoggedAtPosition(map: MapType | undefined, position: ObjectVector3, fogOfWar: number[] | null = map ? map.fogOfWar || null : null): boolean {
    if (map && fogOfWar) {
        const {startX: mapX, startY: mapY, fogWidth, fogHeight} = getMapFogRect(map, position, position);
        if (mapX < 0 || mapX >= fogWidth || mapY < 0 || mapY >= fogHeight) {
            return false;
        }
        const textureIndex = mapX + mapY * fogWidth;
        const bitmaskIndex = textureIndex >> 5;
        const mask = 1 << (textureIndex & 0x1f);
        return (fogOfWar[bitmaskIndex] & mask) === 0;
    }
    return false;
}

export function getMapIdAtPoint(point: THREE.Vector3 | ObjectVector3, maps: {[mapId: string]: MapType}, allowHidden: boolean): string | undefined {
    return Object.keys(maps).reduce<string | undefined>((touching, mapId) => {
        const map = maps[mapId];
        if (touching || (!allowHidden && map.gmOnly) || !isCloseTo(point.y, map.position.y)) {
            return touching;
        }
        const {width, height} = castMapProperties(map.metadata.properties);
        const cos = Math.cos(+map.rotation.y);
        const sin = Math.sin(+map.rotation.y);
        const dx = point.x - map.position.x;
        const dz = point.z - map.position.z;
        const effectiveX = dx * cos - dz * sin;
        const effectiveZ = dz * cos + dx * sin;
        return (effectiveX >= -width / 2 && effectiveX < width / 2
            && effectiveZ >= -height / 2 && effectiveZ < height / 2) ? mapId : touching
    }, undefined);
}

export function getRootAttachedMiniId(miniId: string, minis: {[miniId: string]: MiniType}): string {
    while (minis[miniId].attachMiniId) {
        miniId = minis[miniId].attachMiniId!;
    }
    return miniId;
}

export function isTabletopLockedForPeer(tabletop: TabletopType, connectedUsers: ConnectedUserUsersType, peerId: string | null, override = false): boolean {
    const fromGm = (override && peerId) ? (connectedUsers[peerId] && connectedUsers[peerId].verifiedConnection && connectedUsers[peerId].user.emailAddress === tabletop.gm) : false;
    return !!(tabletop.tabletopLockedPeerId && tabletop.tabletopLockedPeerId !== peerId && !fromGm);
}

export function isScenarioEmpty(scenario?: ScenarioType) {
    return !scenario || (Object.keys(scenario.minis).length === 0 && Object.keys(scenario.maps).length === 0);
}

export const SAME_LEVEL_MAP_DELTA_Y = 1.5;
export const NEW_MAP_DELTA_Y = 6.0;
export const MAP_EPSILON = 1e-4;

export const isMapIdHighest = memoizeOne((maps: {[key: string]: MapType}, mapId?: string): boolean => {
    const map = mapId ? maps[mapId] : undefined;
    return !map ? true : Object.keys(maps).reduce<boolean>((highest, otherMapId) => {
        return highest && (mapId === otherMapId || maps[otherMapId].position.y <= map.position.y + SAME_LEVEL_MAP_DELTA_Y)
    }, true);
});

export const isMapIdLowest = memoizeOne((maps: {[key: string]: MapType}, mapId?: string): boolean => {
    const map = mapId ? maps[mapId] : undefined;
    return !map ? true : Object.keys(maps).reduce<boolean>((lowest, otherMapId) => {
        return lowest && (mapId === otherMapId || maps[otherMapId].position.y > map.position.y - SAME_LEVEL_MAP_DELTA_Y)
    }, true);
});

export const getMapIdClosestToZero = memoizeOne((maps: {[key: string]: MapType}) => {
    let closestElevation = 0;
    return Object.keys(maps).reduce<string | undefined>((closestId, mapId) => {
        const elevation = Math.abs(+maps[mapId].position.y);
        if (closestId === undefined || elevation < closestElevation || (elevation === closestElevation && mapId < closestId)) {
            closestElevation = elevation;
            return mapId;
        } else {
            return closestId;
        }
    }, undefined);
});

export function arePositionsOnSameLevel(position1: ObjectVector3, position2: ObjectVector3): boolean {
    return Math.abs(position1.y - position2.y) <= SAME_LEVEL_MAP_DELTA_Y;
}

export const getMapIdsAtLevel = memoizeOne((maps: {[key: string]: MapType}, elevation: number) => {
    return Object.keys(maps).filter((mapId) => {
        const map = maps[mapId];
        return map.position.y >= elevation - SAME_LEVEL_MAP_DELTA_Y && map.position.y <= elevation + SAME_LEVEL_MAP_DELTA_Y;
    });
});

/**
 * Searches all maps near the given elevation for the best map to focus on, and the best explicitly selected camera
 * point.
 *
 * @param maps The dictionary of all maps in the scenario.
 * @param elevation The elevation of the maps to search.  If undefined, searches the level closest to elevation 0.
 * @returns {focusMapId, cameraFocusPoint} focusMapId: The mapId of the map on the level with the highest elevation and
 * (if tied) the lowest mapId.  cameraFocusPoint: The explicitly chosen map focus with the highest elevation on the
 * level, and (if tied) the one on the lowest mapId, but then lifted to have the same y as the focusMapId.
 */
function _getFocusMapIdAndFocusPointAtLevel(maps: {[key: string]: MapType}, elevation?: number): {focusMapId?: string, cameraFocusPoint?: ObjectVector3} {
    if (elevation === undefined) {
        const closestId = getMapIdClosestToZero(maps);
        elevation = closestId ? maps[closestId].position.y : 0;
    }
    const levelMapIds = getMapIdsAtLevel(maps, elevation);
    let focusMapId: string | undefined = undefined;
    let cameraFocusMapId: string | undefined = undefined;
    for (let mapId of levelMapIds) {
        const map = maps[mapId];
        focusMapId = (
            !focusMapId
            || map.position.y > maps[focusMapId].position.y
            || parseInt(mapId || '0') < parseInt(focusMapId || '0')
        ) ? mapId : focusMapId;
        cameraFocusMapId = (
            map.cameraFocusPoint && (!cameraFocusMapId
                || map.cameraFocusPoint.y > maps[cameraFocusMapId].cameraFocusPoint!.y
                || parseInt(mapId || '0') < parseInt(cameraFocusMapId || '0')
            )
        ) ? mapId : cameraFocusMapId;
    }
    let cameraFocusPoint: ObjectVector3 | undefined = undefined;
    if (focusMapId && cameraFocusMapId) {
        const pointMap = maps[cameraFocusMapId];
        const cameraFocusOffset = pointMap.cameraFocusPoint!;
        cameraFocusPoint = {
            x: pointMap.position.x + cameraFocusOffset.x,
            y: maps[focusMapId].position.y,
            z: pointMap.position.z + cameraFocusOffset.z
        };
    }
    return {focusMapId, cameraFocusPoint};
}

export const getFocusMapIdAndFocusPointAtLevel = memoizeOne(_getFocusMapIdAndFocusPointAtLevel);

/**
 * Get the first mapId in the nominated direction (up or down) from the level containing the given mapId.
 *
 * @param direction The direction to search: 1 = up, -1 = down
 * @param maps The dictionary of maps for the scenario.
 * @param mapId The mapId from which to search.  If undefined, searches from 0.
 * @param limit If true (default), the search will be limited to maps that are within NEW_MAP_DELTA_Y of the starting point.
 */
export function getMapIdOnNextLevel(direction: 1 | -1, maps: {[mapId: string]: MapType}, mapId?: string, limit = true) {
    const mapY = mapId && maps[mapId] ? maps[mapId].position.y : 0;
    const floor = direction > 0 ? mapY + SAME_LEVEL_MAP_DELTA_Y : (limit ? mapY - NEW_MAP_DELTA_Y : undefined);
    const ceiling = direction > 0 ? (limit ? mapY + NEW_MAP_DELTA_Y : undefined) : mapY - SAME_LEVEL_MAP_DELTA_Y;
    return Object.keys(maps).reduce<string | undefined>((result, otherMapId) => {
        const mapY = maps[otherMapId].position.y;
        return (floor === undefined || mapY >= floor) && (ceiling === undefined || mapY <= ceiling) && (
            !result
            || (direction > 0 && mapY < maps[result].position.y)
            || (direction < 0 && mapY > maps[result].position.y)
        ) ? otherMapId : result;
    }, undefined);
}

function _getHighestMapId(maps: {[mapId: string]: MapType}) {
    return Object.keys(maps).reduce<string | undefined>((maxMapId, mapId) => (
        maxMapId === undefined || maps[maxMapId].position.y < maps[mapId].position.y ? mapId : maxMapId
    ), undefined);
}

export const getHighestMapId = memoizeOne(_getHighestMapId);

function adjustMapPositionToNotCollide(scenario: ScenarioType, position: THREE.Vector3, properties: MapProperties, performAdjust: boolean): boolean {
    // TODO this doesn't account for map rotation.
    let adjusted = false;
    for (let mapId of Object.keys(scenario.maps)) {
        const map = scenario.maps[mapId];
        const {width: mapWidth, height: mapHeight} = castMapProperties(map.metadata.properties);
        if (arePositionsOnSameLevel(position, map.position)
            && position.x + properties.width / 2 >= map.position.x - mapWidth / 2 && position.x - properties.width / 2 < map.position.x + mapWidth / 2
            && position.z + properties.height / 2 >= map.position.z - mapHeight / 2 && position.z - properties.height / 2 < map.position.z + mapHeight / 2) {
            adjusted = true;
            if (performAdjust) {
                const delta = position.clone().sub(map.position as THREE.Vector3);
                const quadrant14 = (delta.x - delta.z > 0);
                const quadrant12 = (delta.x + delta.z > 0);
                if (quadrant12 && quadrant14) {
                    position.x = map.position.x + MAP_EPSILON + (mapWidth + properties.width) / 2;
                } else if (quadrant12) {
                    position.z = map.position.z + MAP_EPSILON + (mapHeight + properties.height) / 2;
                } else if (quadrant14) {
                    position.z = map.position.z - MAP_EPSILON - (mapHeight + properties.height) / 2;
                } else {
                    position.x = map.position.x - MAP_EPSILON - (mapWidth + properties.width) / 2;
                }
                const {positionObj} = snapMap(true, properties, position);
                position.copy(positionObj as THREE.Vector3);
            }
        }
    }
    return adjusted;
}

export function findPositionForNewMap(scenario: ScenarioType, rawProperties: MapProperties, position: THREE.Vector3, cameraLookingDown: boolean): THREE.Vector3 {
    let properties = castMapProperties(rawProperties);
    properties = {...properties, width: properties.width || 10, height: properties.height || 10};
    const {positionObj} = snapMap(true, properties, position);
    while (true) {
        const search = buildVector3(positionObj);
        if (getMapIdAtPoint(search, scenario.maps, true) === undefined) {
            // Attempt to find free space for the map at current elevation.
            adjustMapPositionToNotCollide(scenario, search, properties, true);
            if (!adjustMapPositionToNotCollide(scenario, search, properties, false)) {
                return search;
            }
        }
        // Try to fit the map at a higher/lower elevation
        positionObj.y += cameraLookingDown ? NEW_MAP_DELTA_Y : -NEW_MAP_DELTA_Y;
    }
}

function _getMaxCameraDistance(maps: {[mapId: string]: MapType}) {
    const maxMapDimension = Object.keys(maps).reduce((max, mapId) => {
        const {width, height} = maps[mapId].metadata.properties || {width: 10, height: 10};
        return Math.max(max, width, height);
    }, 0);
    return Math.max(2 * maxMapDimension, 50);
}

export const getMaxCameraDistance = memoizeOne(_getMaxCameraDistance);

const CAMERA_INITIAL_OFFSET = new THREE.Vector3(0, Math.sqrt(0.5), Math.sqrt(0.5));

function _getBaseCameraParameters(map?: MapType, zoom = 1, cameraLookAt?: THREE.Vector3) {
    cameraLookAt = cameraLookAt || buildVector3(map ? map.position : {x: 0, y: 0, z: 0});
    const {width, height} = (map?.metadata.properties?.width) ? map.metadata.properties : {width: 10, height: 10};
    const cameraDistance = 2 * Math.max(20, width, height);
    const cameraPosition = cameraLookAt.clone().addScaledVector(CAMERA_INITIAL_OFFSET, zoom * Math.sqrt(cameraDistance));
    return {cameraLookAt, cameraPosition};
}

export const getBaseCameraParameters = memoizeOne(_getBaseCameraParameters);

export function isUserAllowedOnTabletop(gm: string, email: string, tabletopUserControl?: TabletopUserControlType): boolean | null {
    if (email !== gm && tabletopUserControl) {
        const onWhitelist = tabletopUserControl.whitelist.reduce((match, value) => (
            (value === email || (!match && value === '*')) ? value : match
        ), '');
        const onBlacklist = tabletopUserControl.blacklist.reduce((match, value) => (
            (value === email || (!match && value === '*')) ? value : match
        ), '');
        if (!onWhitelist && !onBlacklist) {
            return null;
        } else if (!onWhitelist || onBlacklist === onWhitelist || onBlacklist === email) {
            // Blacklist overrides whitelist if the same level (i.e. * or matching email on both)
            return false;
        }
    }
    return true;
}

export function getVisibilityString(visibility: PieceVisibilityEnum): string {
    const option = MINI_VISIBILITY_OPTIONS.find((option) => (option.value === visibility));
    return option ? option.displayName : '';
}

// === Pieces roster functions ===

export function isNameColumn(column: PiecesRosterColumn) {
    return column.type === PiecesRosterColumnType.INTRINSIC && column.name === 'Name';
}

export const intrinsicFieldValueMap: {[name: string]: (mini: MiniType, minis: {[miniId: string]: MiniType}) => string} = {
    Name: (mini) => (mini.name),
    Focus: () => (''),
    Visibility:
        (mini) => (
            mini.visibility === PieceVisibilityEnum.FOGGED ? (mini.gmOnly ? 'Fog (hide)' : 'Fog (show)')
                : getVisibilityString(mini.visibility)
        ),
    Locked: (mini) => (mini.locked ? 'Y' : 'N'),
    Attached: (mini, minis) => (mini.attachMiniId ? 'to ' + minis[mini.attachMiniId].name : ''),
    Prone: (mini) => (mini.prone ? 'Y' : 'N'),
    Flat: (mini) => (mini.flat ? 'Y' : 'N'),
    Base: (mini) => (mini.hideBase ? 'N' : 'Y'),
    Scale: (mini) => (mini.scale.toString(10)),
    Template: (mini) => (isTemplateMetadata(mini.metadata) ? 'Template' : 'Miniature')
};

const intrinsicFieldSortKeyMap: {[name: string]: (mini: MiniType) => string} = {
    Visibility:
        (mini) => {
            switch (mini.visibility) {
                case PieceVisibilityEnum.REVEALED:
                    return '1';
                case PieceVisibilityEnum.FOGGED:
                    return mini.gmOnly ? '4' : '2';
                case PieceVisibilityEnum.HIDDEN:
                    return '3';
            }
        }
};

export function getPiecesRosterValue(column: PiecesRosterColumn, mini: MiniType, minis: {[miniId: string]: MiniType}): PiecesRosterValue {
    const values = (column.gmOnly ? mini.piecesRosterGMValues : mini.piecesRosterValues) || {};
    const value = values[column.id];
    switch (column.type) {
        case PiecesRosterColumnType.INTRINSIC:
            return intrinsicFieldValueMap[column.name] ? intrinsicFieldValueMap[column.name](mini, minis) : '';
        case PiecesRosterColumnType.STRING:
            return value === undefined ? '' : value;
        case PiecesRosterColumnType.NUMBER:
            return value === undefined ? 0 : value;
        case PiecesRosterColumnType.BONUS:
            const bonus = value === undefined ? 0 : value as number;
            return bonus < 0 ? String(bonus) : '+' + String(bonus);
        case PiecesRosterColumnType.FRACTION:
            return (value === undefined ? {denominator: 0} : value) as PiecesRosterFractionValue;
    }
}

export function getPiecesRosterDisplayValue(column: PiecesRosterColumn, values: PiecesRosterValues): string {
    const value = values[column.id];
    const header = column.name + ': ';
    switch (column.type) {
        case PiecesRosterColumnType.STRING:
            return !value ? '' : header + value;
        case PiecesRosterColumnType.NUMBER:
            return header + (value === undefined ? '0' : String(value));
        case PiecesRosterColumnType.BONUS:
            const bonus = value === undefined ? 0 : value;
            return header + (bonus as number < 0 ? String(bonus) : '+' + String(bonus));
        case PiecesRosterColumnType.FRACTION:
            const fraction = value as PiecesRosterFractionValue;
            const {numerator, denominator} = value === undefined ? {numerator: 0, denominator: 0} :
                fraction.numerator === undefined ? {numerator: fraction.denominator, denominator: fraction.denominator} :
                fraction;
            return denominator === 0 ? (
                numerator === 0 ? `${header}full`
                    : `${header}${numerator! > 0 ? 'up' : 'down'} ${Math.abs(numerator!)}`
            ) : (
                `${header}${numerator} / ${denominator}`
            );
        default:
            return '';
    }
}

export function getPiecesRosterSortString(column: PiecesRosterColumn, mini: MiniType, minis: {[miniId: string]: MiniType}): string {
    if (column.type === PiecesRosterColumnType.INTRINSIC) {
        if (intrinsicFieldSortKeyMap[column.name]) {
            return intrinsicFieldSortKeyMap[column.name](mini);
        }
    } else if (mini.piecesRosterSimple) {
        // Ignore custom roster column values in minis with custom values disabled
        return '';
    }
    const value = getPiecesRosterValue(column, mini, minis);
    if (column.type === PiecesRosterColumnType.FRACTION) {
        const fraction = value as PiecesRosterFractionValue;
        return ((fraction.denominator === 0) ? 0 : fraction.numerator === undefined ? 1 : fraction.numerator / fraction.denominator).toString()
            + ' ' + fraction.denominator;
    } else {
        return value === undefined ? '' : value.toString();
    }

}

export function getUserDiceColours(tabletop: TabletopType, email: string) {
    let diceColour: string;
    if (tabletop.userPreferences[email]) {
        diceColour = tabletop.userPreferences[email].dieColour;
    } else {
        diceColour = getColourHexString(Math.floor(stringHash(email) / 2));
    }
    const textColour = isColourDark(new THREE.Color(diceColour)) ? 'white' : 'black';
    return {diceColour, textColour};
}

export function adjustScenarioOrigin(scenario: ScenarioType, defaultGrid: GridType, origin: THREE.Vector3, orientation: THREE.Euler): ScenarioType {
    scenario.maps = Object.keys(scenario.maps).reduce((maps, mapId) => {
        const map = scenario.maps[mapId];
        const position = buildVector3(map.position).applyEuler(orientation).add(origin);
        const rotation = {...map.rotation, y: map.rotation.y + orientation.y};
        const {positionObj, rotationObj} = snapMap(true, map.metadata.properties!, position, rotation);
        (maps as any)[mapId] = {...map, position: positionObj, rotation: rotationObj};
        return maps;
    }, {});
    scenario.minis = Object.keys(scenario.minis).reduce((minis, miniId) => {
        const mini = scenario.minis[miniId];
        if (mini.attachMiniId) {
            (minis as any)[miniId] = mini;
        } else {
            const position = buildVector3(mini.position).applyEuler(orientation).add(origin);
            const rotation = {...mini.rotation, y: mini.rotation.y + orientation.y};
            const gridType = mini.onMapId ? getGridTypeOfMap(scenario.maps[mini.onMapId]) : defaultGrid;
            const {positionObj, rotationObj, elevation} = snapMini(scenario.snapToGrid, gridType, mini.scale, position, mini.elevation, rotation);
            (minis as any)[miniId] = {...mini, position: positionObj, rotation: rotationObj, elevation};
        }
        return minis;
    }, {});
    return scenario;
}

export function copyURLToClipboard(suffix: string) {
    const location = window.location.href.replace(/[\\/][^/\\]*$/, '/' + suffix);
    copyToClipboard(location);
}

export function calculatePieceProperties<T extends MiniProperties | TemplateProperties>(previous: T, update: Partial<T> = {}): T {
    if (isTemplateProperties(previous)) {
        return castTemplateProperties({...previous, ...update}) as T;
    } else {
        return calculateMiniProperties(previous, update as Partial<MiniProperties>) as T;
    }
}

const MINI_ASPECT_RATIO = MINI_WIDTH / MINI_HEIGHT;

export function calculateMiniProperties(previous: MiniProperties, update: Partial<MiniProperties> = {}): MiniProperties {
    const cleaned = castMiniProperties({...defaultMiniProperties, ...previous});
    for (let key of Object.keys(cleaned)) {
        if (typeof((cleaned as any)[key]) !== 'string' && isNaN((cleaned as any)[key])) {
            delete((cleaned as any)[key]);
        }
    }
    const combined = {
        ...cleaned as Partial<MiniProperties>,
        ...update
    } as MiniProperties;
    if (Number(combined.width) !== Number(cleaned.width) || Number(combined.height) !== Number(cleaned.height)) {
        const aspectRatio = Number(combined.width) / Number(combined.height);
        const topDownX = (aspectRatio > 1) ? 0.5 : aspectRatio / 2;
        const topDownY = (aspectRatio > 1) ? 0.5 / aspectRatio : 0.5;
        const standeeRangeX = (aspectRatio > MINI_ASPECT_RATIO ? MINI_WIDTH : MINI_HEIGHT * aspectRatio);
        const standeeRangeY = (aspectRatio > MINI_ASPECT_RATIO ? MINI_WIDTH / aspectRatio : MINI_HEIGHT);
        const standeeX = 0.5;
        const standeeY = (1 - MINI_HEIGHT / standeeRangeY) / 2;
        return {
            ...combined,
            topDownX,
            topDownY,
            aspectRatio,
            standeeRangeX,
            standeeRangeY,
            standeeX,
            standeeY
        };
    } else {
        return combined;
    }
}

export function calculateMapProperties(previous: MapProperties, update: Partial<MapProperties> = {}): MapProperties {
    const cleaned = castMapProperties({...defaultMapProperties, ...previous});
    for (let key of Object.keys(cleaned)) {
        if (typeof((cleaned as any)[key]) !== 'string' && isNaN((cleaned as any)[key])) {
            delete((cleaned as any)[key]);
        }
    }
    if (update.width !== undefined) {
        update.width /= (update.gridSize || cleaned.gridSize);
    }
    if (update.height !== undefined) {
        update.height /= (update.gridSize || cleaned.gridSize);
    }
    return {...cleaned, ...update};
}

export function mapMetadataHasNoGrid(metadata?: FileMetadata<void, MapProperties>): boolean {
    const gridType = metadata?.properties?.gridType;
    return gridType === undefined || gridType === GridType.NONE;
}