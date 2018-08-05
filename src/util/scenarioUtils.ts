import {
    DriveMetadata,
    MapAppProperties,
    MiniAppProperties,
    TabletopObjectAppProperties,
    TemplateAppProperties
} from './googleDriveUtils';

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

export interface MiniType extends WithMetadataType<MiniAppProperties | TemplateAppProperties> {
    name: string;
    position: ObjectVector3;
    movementPath?: ObjectVector3[];
    rotation: ObjectEuler;
    scale: number;
    elevation: number;
    gmOnly: boolean;
    selectedBy: string | null;
    prone: boolean;
    flat: boolean;
}

export interface ScenarioType {
    snapToGrid: boolean;
    confirmMoves: boolean;
    maps: {[key: string]: MapType};
    minis: {[key: string]: MiniType};
    lastActionId: string;
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
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
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

export function scenarioToJson(scenario: ScenarioType, publicActionId?: string): ScenarioType[] {
    // Split the scenario into private (everything) and public information.
    const maps = replaceMetadataWithId(scenario.maps);
    const minis = replaceMetadataWithId(scenario.minis);
    return [
        {
            snapToGrid: scenario.snapToGrid,
            confirmMoves: scenario.confirmMoves,
            lastActionId: scenario.lastActionId,
            maps,
            minis
        },
        {
            snapToGrid: scenario.snapToGrid,
            confirmMoves: scenario.confirmMoves,
            lastActionId: publicActionId || scenario.lastActionId,
            maps: filterObject(maps, (map: MapType) => (!map.gmOnly)),
            minis: filterObject(minis, (mini: MiniType) => (!mini.gmOnly))
        }
    ]
}

function updateMetadata(fullDriveMetadata: {[key: string]: DriveMetadata}, object: {[key: string]: WithMetadataType<TabletopObjectAppProperties>}) {
    Object.keys(object).forEach((id) => {
        const metadata = fullDriveMetadata[object[id].metadata.id] as DriveMetadata<TabletopObjectAppProperties>;
        if (metadata) {
            object[id] = {...object[id], metadata};
        }
    });
}

export function jsonToScenarioAndTabletop(combined: ScenarioType & TabletopType, fullDriveMetadata: {[key: string]: DriveMetadata}): [ScenarioType, TabletopType] {
    // Convert minis with old-style startingPosition point to movementPath array
    const minis = Object.keys(combined.minis).reduce((all, miniId) => {
        const mini = combined.minis[miniId];
        if (mini['startingPosition']) {
            mini.movementPath = [mini['startingPosition']];
            delete(mini['startingPosition']);
        }
        all[miniId] = mini;
        return all;
    }, {});
    // Check for id-only metadata
    updateMetadata(fullDriveMetadata, combined.maps);
    updateMetadata(fullDriveMetadata, combined.minis);
    return [
        {
            snapToGrid: combined.snapToGrid,
            confirmMoves: combined.confirmMoves,
            lastActionId: combined.lastActionId,
            maps: combined.maps,
            minis
        },
        {
            gm: combined.gm,
            gmSecret: combined.gmSecret,
            distanceMode: combined.distanceMode,
            distanceRound: combined.distanceRound,
            gridScale: combined.gridScale,
            gridUnit: combined.gridUnit
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