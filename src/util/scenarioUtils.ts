import * as THREE from 'three';
import memoizeOne from 'memoize-one';

import {
    AnyProperties,
    castMapProperties,
    castMiniProperties,
    DriveMetadata,
    GridType,
    MapProperties,
    MiniProperties,
    ScenarioObjectProperties,
    TemplateProperties
} from './googleDriveUtils';
import {CommsStyle} from './commsNode';
import * as constants from './constants';
import {TabletopPathPoint} from '../presentation/tabletopPathComponent';
import {ConnectedUserUsersType} from '../redux/connectedUserReducer';
import {buildEuler, buildVector3} from './threeUtils';
import {isCloseTo} from './mathsUtils';

export interface WithMetadataType<T extends AnyProperties> {
    metadata: DriveMetadata<void, T>;
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

export interface MapType extends WithMetadataType<MapProperties> {
    name: string;
    position: ObjectVector3;
    rotation: ObjectEuler;
    gmOnly: boolean;
    selectedBy: string | null;
    fogOfWar?: number[];
}

export type MovementPathPoint = ObjectVector3 & {elevation?: number, onMapId?: string};

export enum PieceVisibilityEnum {
    HIDDEN = 1, FOGGED = 2, REVEALED = 3
}

export interface MiniType<T = MiniProperties | TemplateProperties> extends WithMetadataType<T> {
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
}

export interface ScenarioType {
    snapToGrid: boolean;
    confirmMoves: boolean;
    maps: {[key: string]: MapType};
    minis: {[key: string]: MiniType};
    startCameraAtOrigin?: boolean;
    headActionIds: string[];
    playerHeadActionIds: string[];
}

export enum DistanceMode {
    STRAIGHT = 'STRAIGHT',
    GRID_DIAGONAL_ONE_ONE = 'GRID_DIAGONAL_ONE_ONE',
    GRID_DIAGONAL_THREE_EVERY_TWO = 'GRID_DIAGONAL_THREE_EVERY_TWO'
}

export enum DistanceRound {
    ONE_DECIMAL = 'ONE_DECIMAL',
    ROUND_OFF = 'ROUND_OFF',
    ROUND_UP = 'ROUND_UP',
    ROUND_DOWN = 'ROUND_DOWN'
}

export interface TabletopType {
    gm: string;
    gmSecret: string | null;
    gmOnlyPing: boolean;
    defaultGrid: GridType;
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    commsStyle: CommsStyle;
    baseColourSwatches?: string[];
    templateColourSwatches?: string[];
    gridColourSwatches?: string[];
    lastSavedHeadActionIds: null | string[];
    lastSavedPlayerHeadActionIds: null | string[];
    tabletopLockedPeerId?: string;
}

function replaceMetadataWithId(all: {[key: string]: any}): {[key: string]: any} {
    return Object.keys(all).reduce((result, guid) => {
        result[guid] = {
            ...all[guid],
            metadata: {id: all[guid].metadata.id}
        };
        return result;
    }, {});
}

function filterObject<T>(object: {[key: string]: T}, filterFn: (object: T, key?: string, collection?: {[key: string]: T}) => boolean) {
    return Object.keys(object).reduce((result, key) => {
        if (filterFn(object[key], key, object)) {
            result[key] = object[key];
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
            snapToGrid: scenario.snapToGrid,
            confirmMoves: scenario.confirmMoves,
            startCameraAtOrigin: scenario.startCameraAtOrigin,
            maps,
            minis,
            headActionIds: scenario.playerHeadActionIds,
            playerHeadActionIds: scenario.playerHeadActionIds
        },
        {
            snapToGrid: scenario.snapToGrid,
            confirmMoves: scenario.confirmMoves,
            startCameraAtOrigin: scenario.startCameraAtOrigin,
            maps: filterObject(maps, (map: MapType) => (!map.gmOnly)),
            minis: filterObject(minis, (mini: MiniType) => (!mini.gmOnly)),
            headActionIds: scenario.headActionIds,
            playerHeadActionIds: scenario.playerHeadActionIds
        }
    ]
}

function updateMetadata<T = ScenarioObjectProperties>(fullDriveMetadata: {[key: string]: DriveMetadata}, object: {[key: string]: WithMetadataType<T>}, converter: (properties: T) => T) {
    Object.keys(object).forEach((id) => {
        const metadata = fullDriveMetadata[object[id].metadata.id] as DriveMetadata<void, T>;
        if (metadata) {
            object[id] = {...object[id], metadata: {...metadata, properties: converter(metadata.properties)}};
        }
    });
}

export function jsonToScenarioAndTabletop(combined: ScenarioType & TabletopType, fullDriveMetadata: {[key: string]: DriveMetadata}): [ScenarioType, TabletopType] {
    Object.keys(combined.minis).forEach((miniId) => {
        const mini = combined.minis[miniId];
        // Convert minis with old-style startingPosition point to movementPath array
        if (mini['startingPosition']) {
            mini.movementPath = [mini['startingPosition']];
            delete(mini['startingPosition']);
        }
        // If missing, set visibility based on gmOnly
        if (mini.visibility === undefined) {
            mini.visibility = (mini.gmOnly) ? PieceVisibilityEnum.HIDDEN : PieceVisibilityEnum.REVEALED;
        }
    });
    // Check for id-only metadata
    updateMetadata(fullDriveMetadata, combined.maps, castMapProperties);
    updateMetadata(fullDriveMetadata, combined.minis, castMiniProperties);
    // Convert old-style lastActionId to headActionIds
    const headActionIds = combined.headActionIds ? combined.headActionIds : [combined['lastActionId'] || 'legacyAction'];
    const playerHeadActionIds = combined.playerHeadActionIds ? combined.playerHeadActionIds : [combined['lastActionId'] || 'legacyAction'];
    // Return scenario and tabletop
    return [
        {
            snapToGrid: combined.snapToGrid,
            confirmMoves: combined.confirmMoves,
            startCameraAtOrigin: combined.startCameraAtOrigin,
            maps: combined.maps,
            minis: combined.minis,
            headActionIds,
            playerHeadActionIds
        },
        {
            gm: combined.gm,
            gmSecret: combined.gmSecret,
            gmOnlyPing: combined.gmOnlyPing === undefined ? false : combined.gmOnlyPing,
            defaultGrid: combined.defaultGrid || GridType.SQUARE,
            distanceMode: combined.distanceMode,
            distanceRound: combined.distanceRound,
            gridScale: combined.gridScale,
            gridUnit: combined.gridUnit,
            commsStyle: combined.commsStyle || CommsStyle.PeerToPeer,
            baseColourSwatches: combined.baseColourSwatches,
            templateColourSwatches: combined.templateColourSwatches,
            gridColourSwatches: combined.gridColourSwatches,
            lastSavedHeadActionIds: null,
            lastSavedPlayerHeadActionIds: null,
            tabletopLockedPeerId: combined.tabletopLockedPeerId
        }
    ];
}

export function getAllScenarioMetadataIds(scenario: ScenarioType): string[] {
    const metadataMap = Object.keys(scenario.maps).reduce((all, mapId) => {
        all[scenario.maps[mapId].metadata.id] = true;
        return all;
    }, Object.keys(scenario.minis).reduce((all, miniId) => {
        all[scenario.minis[miniId].metadata.id] = true;
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

export function getGridStride(type: GridType) {
    switch (type) {
        case GridType.HEX_VERT:
            return {strideX: 1.5 * constants.INV_SQRT3, strideY: 0.5};
        case GridType.HEX_HORZ:
            return {strideX: 0.5, strideY: 1.5 * constants.INV_SQRT3};
        default:
            return {strideX: 1, strideY: 1};
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
    let centreX, centreY;
    if (type === GridType.HEX_VERT) {
        hexX = hexZigzag;
        hexY = hexStraight;
        centreX = hexX + 2/3;
        centreY = hexY + 1;
    } else {
        hexX = hexStraight;
        hexY = hexZigzag;
        centreX = hexX + 1;
        centreY = hexY + 2/3;
    }
    return {strideX, strideY, hexX, hexY, centreX, centreY};
}

const MAP_ROTATION_SNAP = Math.PI / 2;
const MAP_ROTATION_HEX_SNAP = Math.PI / 6;

// A hex map rotated by 30 degrees becomes a grid of the opposite type (horizontal <-> vertical)
export function effectiveHexGridType(mapRotation: number, gridType: GridType.HEX_VERT | GridType.HEX_HORZ): GridType.HEX_VERT | GridType.HEX_HORZ {
    if ((mapRotation / MAP_ROTATION_HEX_SNAP) % 2 === 0) {
        return gridType;
    } else if (gridType === GridType.HEX_HORZ) {
        return GridType.HEX_VERT;
    } else {
        return GridType.HEX_HORZ;
    }
}

export function getMapCentreOffsets(snap: boolean, properties: MapProperties) {
    let dx, dy;
    switch (properties.gridType) {
        case GridType.HEX_HORZ:
        case GridType.HEX_VERT:
            const {strideX, strideY} = getGridStride(properties.gridType);
            dx = (properties.gridOffsetX / properties.gridSize) % (2 * strideX);
            dy = (properties.gridOffsetY / properties.gridSize) % (2 * strideY);
            break;
        default:
            dx = (1 + properties.gridOffsetX / properties.gridSize) % 1;
            dy = (1 + properties.gridOffsetY / properties.gridSize) % 1;
            break;
    }
    let mapDX = 0, mapDZ = 0;
    if (snap) {
        const mapCentreX = properties.width / 2;
        const mapCentreY = properties.height / 2;
        switch (properties.gridType) {
            case GridType.HEX_HORZ:
            case GridType.HEX_VERT:
                // A hex map should rotate around the centre of the hex closest to the map's centre.
                const {strideX: centreStrideX, strideY: centreStrideY, hexX: centreHexX, hexY: centreHexY} = cartesianToHexCoords(mapCentreX, mapCentreY, properties.gridType);
                mapDX = mapCentreX - (centreHexX * centreStrideX + dx);
                mapDZ = mapCentreY - (centreHexY * centreStrideY + dy);
                break;
            default:
                // A square map should rotate around the grid intersection closest to the map's centre.
                mapDX = mapCentreX % 1 - dx;
                mapDZ = mapCentreY % 1 - dy;
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
                x = centreX * strideX + cos * mapDX + sin * mapDZ;
                z = centreY * strideY + cos * mapDZ - sin * mapDX;
                break;
            default:
                x = Math.round(position.x - cos * mapDX - sin * mapDZ) + cos * mapDX + sin * mapDZ;
                z = Math.round(position.z - cos * mapDZ + sin * mapDX) + cos * mapDZ - sin * mapDX;
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
const MINI_HEX_ROTATION_SNAP = Math.PI / 3;

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

const GRID_COLOUR_TO_HEX = {
    black: '#000000', grey: '#9b9b9b', white: '#ffffff', brown: '#8b572a',
    tan: '#c77f16', red: '#ff0000', yellow: '#ffff00', green: '#00ff00',
    cyan: '#00ffff', blue: '#0000ff', magenta: '#ff00ff'
};

export function getColourHex(colour: string | THREE.Color): number {
    if (colour instanceof THREE.Color) {
        return colour.getHex();
    } else {
        const hex = GRID_COLOUR_TO_HEX[colour] || colour || '#000000';
        return Number.parseInt(hex[0] === '#' ? hex.substr(1) : hex, 16);
    }
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

export function roundVectors(start: THREE.Vector3, end: THREE.Vector3) {
    if (start.x <= end.x) {
        start.x = Math.floor(start.x);
        end.x = Math.ceil(end.x) - ROUND_VECTORS_DELTA;
    } else {
        start.x = Math.ceil(start.x) - ROUND_VECTORS_DELTA;
        end.x = Math.floor(end.x);
    }
    if (start.z <= end.z) {
        start.z = Math.floor(start.z);
        end.z = Math.ceil(end.z) - ROUND_VECTORS_DELTA;
    } else {
        start.z = Math.ceil(start.z) - ROUND_VECTORS_DELTA;
        end.z = Math.floor(end.z);
    }
}

export function getMapGridRoundedVectors(map: MapType, rotationObj: THREE.Euler, worldStart: THREE.Vector3 | ObjectVector3, worldEnd: THREE.Vector3 | ObjectVector3) {
    // Counter-rotate start/end vectors around map position to get their un-rotated equivalent positions
    const mapPosition = buildVector3(map.position);
    const reverseRotation = new THREE.Euler(-rotationObj.x, -rotationObj.y, -rotationObj.z, rotationObj.order);
    const startPos = buildVector3(worldStart).sub(mapPosition).applyEuler(reverseRotation).add(mapPosition);
    const endPos = buildVector3(worldEnd).sub(mapPosition).applyEuler(reverseRotation).add(mapPosition);
    // Find the world coords of the grid intersection point closest to map's position
    const properties = castMapProperties(map.metadata.properties);
    const {mapDX, mapDZ} = getMapCentreOffsets(true, properties);
    const gridOffset = new THREE.Vector3(mapDX, 0, mapDZ);
    const gridIntersection = mapPosition.clone().sub(gridOffset);
    // Convert the start/end positions to points relative to the grid intersection, and round them off.
    startPos.sub(gridIntersection);
    endPos.sub(gridIntersection);
    roundVectors(startPos, endPos);
    // Return the start/end positions as (un-rotated) points relative to the map position
    startPos.sub(gridOffset);
    endPos.sub(gridOffset);
    return [startPos, endPos];
}

export function getMapFogRect(map: MapType, start: ObjectVector3, end: ObjectVector3) {
    const rotation = buildEuler(map.rotation);
    const [startPos, endPos] = getMapGridRoundedVectors(map, rotation, start, end);
    const fogWidth = Number(map.metadata.properties.fogWidth);
    const fogHeight = Number(map.metadata.properties.fogHeight);
    const fogCentre = {x: fogWidth / 2, y: 0, z: fogHeight / 2} as THREE.Vector3;
    startPos.add(fogCentre);
    endPos.add(fogCentre);
    return {startPos, endPos, fogWidth, fogHeight};
}

export function isMapFoggedAtPosition(map: MapType | undefined, position: ObjectVector3, fogOfWar: number[] | null = map ? map.fogOfWar || null : null): boolean {
    if (map) {
        switch (map.metadata.properties.gridType) {
            case GridType.SQUARE:
                if (!fogOfWar) {
                    return false;
                }
                const {startPos: mapPos, fogWidth, fogHeight} = getMapFogRect(map, position, position);
                const mapX = Math.floor(mapPos.x + 0.5);
                const mapY = Math.floor(mapPos.z + 0.5);
                if (mapX < 0 || mapX >= fogWidth || mapY < 0 || mapY >= fogHeight) {
                    return false;
                }
                const textureIndex = mapX + mapY * fogWidth;
                const bitmaskIndex = textureIndex >> 5;
                const mask = 1 << (textureIndex & 0x1f);
                return (fogOfWar[bitmaskIndex] & mask) === 0;
            default:
                break;
        }
    }
    return false;
}

export function getMapIdAtPoint(point: THREE.Vector3 | ObjectVector3, maps: {[mapId: string]: MapType}): string | undefined {
    return Object.keys(maps).reduce<string | undefined>((touching, mapId) => {
        const map = maps[mapId];
        if (touching || !isCloseTo(point.y, map.position.y)) {
            return touching;
        }
        const width = Number(map.metadata.properties.width);
        const height = Number(map.metadata.properties.height);
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
    const fromGm = (override && peerId) ? (connectedUsers[peerId] && connectedUsers[peerId].user.emailAddress === tabletop.gm) : false;
    return !!(tabletop.tabletopLockedPeerId && tabletop.tabletopLockedPeerId !== peerId && !fromGm);
}

export function isScenarioEmpty(scenario?: ScenarioType) {
    return !scenario || (Object.keys(scenario.minis).length === 0 && Object.keys(scenario.maps).length === 0);
}