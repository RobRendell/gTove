import * as THREE from 'three';

import {DriveMetadata, MapAppProperties, MiniAppProperties} from '../util/googleDriveUtils';

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

export interface MiniType extends WithMetadataType<MiniAppProperties> {
    name: string;
    position: ObjectVector3;
    startingPosition?: ObjectVector3;
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

export interface TabletopType {
    gm: string;
    gmSecret: string | null;
}