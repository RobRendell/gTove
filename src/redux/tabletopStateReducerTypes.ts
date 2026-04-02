import * as THREE from 'three';

import {PaintToolEnum} from '../presentation/paintTools';

export enum GToveMode {
    GAMING_TABLETOP,
    MAP_SCREEN,
    MINIS_SCREEN,
    TEMPLATES_SCREEN,
    TABLETOP_SCREEN,
    SCENARIOS_SCREEN,
    PDFS_SCREEN,
    BUNDLES_SCREEN,
    WORKING_SCREEN,
    DEVICE_LAYOUT_SCREEN,
    USER_PREFERENCES_SCREEN
}

export interface ScenarioReplaceState {
    mapMetadataId?: string;
    mapImageId?: string;
    miniMetadataId?: string;
}

export type DragModeType = 'measureDistanceMode' | 'elasticBandMode' | 'fogOfWarMode' | 'paintMode' | 'repositionMapMode';

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
    currentPage: GToveMode;
    fullScreen: boolean;
    scenarioReplace?: ScenarioReplaceState;
    selectedNoteMiniId: string | null;
    editingNote: boolean;
    playerView: boolean;
    sideMenuOpen: boolean;
    adjustingMiniScale: boolean;
    dragMode?: DragModeType;
    undoGroupId?: string;
    focusMapId?: string;
    topDown: boolean;
    isLookingDown: boolean;
    paintState: PaintState;
}