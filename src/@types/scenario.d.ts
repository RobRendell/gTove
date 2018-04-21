import * as THREE from 'three';

import {DriveMetadata} from './googleDrive';

export interface WithMetadataType {
    metadata: DriveMetadata;
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

export interface MapType extends WithMetadataType {
    name: string;
    position: ObjectVector3;
    rotation: ObjectEuler;
    gmOnly: boolean;
    snapping: boolean;
    fogOfWar: number[] | null;
}

export interface MapParameterType extends MapType {
    position: THREE.Vector3;
    rotation: THREE.Euler;
}

export interface MiniType extends WithMetadataType {
    name: string;
    position: ObjectVector3;
    rotation: ObjectEuler;
    scale: number;
    elevation: number;
    gmOnly: boolean;
    snapping: boolean;
}

export interface ScenarioType {
    gm: string | null;
    snapToGrid: boolean;
    maps: {[key: string]: MapType};
    minis: {[key: string]: MiniType};
}