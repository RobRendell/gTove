import {
    castMapAppProperties,
    castMiniAppProperties,
    DriveMetadata,
    GridType,
    MapAppProperties,
    MiniAppProperties,
    TabletopObjectAppProperties,
    TemplateAppProperties
} from './googleDriveUtils';
import {CommsStyle} from './commsNode';
import {INV_SQRT3} from './constants';
import {TabletopPathPoint} from '../presentation/tabletopPathComponent';

export interface WithMetadataType<T> {
    metadata: DriveMetadata<T>;
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

export interface MapType extends WithMetadataType<MapAppProperties> {
    name: string;
    position: ObjectVector3;
    rotation: ObjectEuler;
    gmOnly: boolean;
    selectedBy: string | null;
    fogOfWar?: number[];
}

export type MovementPathPoint = ObjectVector3 & {elevation?: number, onMapId?: string};

export interface MiniType<T = MiniAppProperties | TemplateAppProperties> extends WithMetadataType<T> {
    name: string;
    position: ObjectVector3;
    movementPath?: MovementPathPoint[];
    rotation: ObjectEuler;
    scale: number;
    elevation: number;
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
    defaultGrid: GridType;
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    commsStyle: CommsStyle;
    baseColourSwatches?: string[];
    templateColourSwatches?: string[];
    gridColourSwatches?: string[];
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

function updateMetadata<T = TabletopObjectAppProperties>(fullDriveMetadata: {[key: string]: DriveMetadata}, object: {[key: string]: WithMetadataType<T>}, converter: (appProperties: T) => T) {
    Object.keys(object).forEach((id) => {
        const metadata = fullDriveMetadata[object[id].metadata.id] as DriveMetadata<TabletopObjectAppProperties>;
        if (metadata) {
            object[id] = {...object[id], metadata: {...metadata, appProperties: converter(metadata.appProperties as any)}};
        }
    });
}

export function jsonToScenarioAndTabletop(combined: ScenarioType & TabletopType, fullDriveMetadata: {[key: string]: DriveMetadata}): [ScenarioType, TabletopType] {
    // Convert minis with old-style startingPosition point to movementPath array
    Object.keys(combined.minis).forEach((miniId) => {
        const mini = combined.minis[miniId];
        if (mini['startingPosition']) {
            mini.movementPath = [mini['startingPosition']];
            delete(mini['startingPosition']);
        }
    });
    // Check for id-only metadata
    updateMetadata(fullDriveMetadata, combined.maps, castMapAppProperties);
    updateMetadata(fullDriveMetadata, combined.minis, castMiniAppProperties);
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
            defaultGrid: combined.defaultGrid || GridType.SQUARE,
            distanceMode: combined.distanceMode,
            distanceRound: combined.distanceRound,
            gridScale: combined.gridScale,
            gridUnit: combined.gridUnit,
            commsStyle: combined.commsStyle || CommsStyle.PeerToPeer,
            baseColourSwatches: combined.baseColourSwatches,
            templateColourSwatches: combined.templateColourSwatches,
            gridColourSwatches: combined.gridColourSwatches
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
            return {strideX: 1.5 * INV_SQRT3, strideY: 0.5};
        case GridType.HEX_HORZ:
            return {strideX: 0.5, strideY: 1.5 * INV_SQRT3};
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

export function snapMap(snap: boolean, appProperties: MapAppProperties, position: ObjectVector3, rotation: ObjectEuler = {order: 'xyz', x: 0, y: 0, z: 0}) {
    if (!appProperties) {
        return {positionObj: position, rotationObj: rotation, dx: 0, dy: 0, width: 10, height: 10};
    }
    let dx, dy, rotationSnap;
    switch (appProperties.gridType) {
        case GridType.HEX_HORZ:
        case GridType.HEX_VERT:
            const {strideX, strideY} = getGridStride(appProperties.gridType);
            dx = (appProperties.gridOffsetX / appProperties.gridSize) % (2 * strideX);
            dy = (appProperties.gridOffsetY / appProperties.gridSize) % (2 * strideY);
            rotationSnap = MAP_ROTATION_HEX_SNAP;
            break;
        default:
            dx = (1 + appProperties.gridOffsetX / appProperties.gridSize) % 1;
            dy = (1 + appProperties.gridOffsetY / appProperties.gridSize) % 1;
            rotationSnap = MAP_ROTATION_SNAP;
            break;
    }
    if (snap) {
        const mapRotation = Math.round(rotation.y / rotationSnap) * rotationSnap;
        const cos = Math.cos(mapRotation);
        const sin = Math.sin(mapRotation);
        let mapDX, mapDZ, x, z;
        switch (appProperties.gridType) {
            case GridType.HEX_HORZ:
            case GridType.HEX_VERT:
                // A hex map should rotate around the centre of the hex closest to the map's centre.
                const mapCentreX = appProperties.width / 2;
                const mapCentreY = appProperties.height / 2;
                const {strideX: centreStrideX, strideY: centreStrideY, hexX: centreHexX, hexY: centreHexY} = cartesianToHexCoords(mapCentreX, mapCentreY, appProperties.gridType);
                mapDX = mapCentreX - (centreHexX * centreStrideX + dx);
                mapDZ = mapCentreY - (centreHexY * centreStrideY + dy);
                const snapGridType = effectiveHexGridType(mapRotation, appProperties.gridType);
                const {strideX, strideY, centreX, centreY} = cartesianToHexCoords(position.x - cos * mapDX - sin * mapDZ, position.z - cos * mapDZ + sin * mapDX, snapGridType);
                x = centreX * strideX + cos * mapDX + sin * mapDZ;
                z = centreY * strideY + cos * mapDZ - sin * mapDX;
                break;
            default:
                // A square map should rotate around the grid intersection closest to the map's centre.
                mapDX = (appProperties.width / 2) % 1 - dx;
                mapDZ = (appProperties.height / 2) % 1 - dy;
                x = Math.round(position.x) + cos * mapDX + sin * mapDZ;
                z = Math.round(position.z) + cos * mapDZ - sin * mapDX;
                break;
        }
        const y = Math.round(position.y);
        return {
            positionObj: {x, y, z},
            rotationObj: {...rotation, y: mapRotation},
            dx, dy, width: appProperties.width, height: appProperties.height
        };
    } else {
        return {positionObj: position, rotationObj: rotation, dx, dy, width: appProperties.width, height: appProperties.height};
    }
}

export function generateMovementPath(movementPath: MovementPathPoint[], maps: {[mapId: string]: MapType}, defaultGridType: GridType): TabletopPathPoint[] {
    return movementPath.map((point) => {
        let gridType = defaultGridType;
        if (point.onMapId) {
            const map = maps[point.onMapId];
            gridType = map.metadata.appProperties ? map.metadata.appProperties.gridType : GridType.NONE;
            if (gridType === GridType.HEX_HORZ || gridType === GridType.HEX_VERT) {
                gridType = effectiveHexGridType(map.rotation.y, gridType);
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

export function getColourHex(colour: string) {
    const hex = GRID_COLOUR_TO_HEX[colour] || colour || '#000000';
    return Number.parseInt(hex[0] === '#' ? hex.substr(1) : hex, 16);
}