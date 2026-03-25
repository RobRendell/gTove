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

export type DragModeType = 'measureDistanceMode' | 'elasticBandMode' | 'fogOfWarMode' | 'paintMode';

export interface TabletopStateReducerType {
    paintState: PaintState;
    selectedNoteMiniId: string | null;
    editingNote: boolean;
    playerView: boolean;
    adjustingMiniScale: boolean;
    dragMode?: DragModeType;
    undoGroupId?: string;
    focusMapId?: string;
    topDown: boolean;
    isLookingDown: boolean;
}