import * as THREE from 'three';

import {PaintToolEnum} from '../presentation/paintTools';

export interface PaintState {
    open: boolean;
    selected: PaintToolEnum;
    brushColour: string;
    brushSize: number;
    operationId?: string;
    toolPositionStart?: THREE.Vector3;
    toolPosition?: THREE.Vector3;
    toolMapId?: string;
}

export interface TabletopStateReducerType {
    paintState: PaintState;
}