import {ReactElement} from 'react';
import * as THREE from 'three';

import {PromiseModalDialogType} from '../container/promiseModalDialog';
import {
    TabletopViewComponentEditSelected,
    TabletopViewComponentMenuSelected,
    TabletopViewComponentSelected
} from '../presentation/tabletopViewComponent';
import {SetCameraFunction} from '../presentation/virtualGamingTabletop';
import {GtoveDispatchProp} from '../redux/mainReducerTypes';
import {TabletopStateReducerType} from '../redux/tabletopStateReducerTypes';
import {MapType, MiniType, MovementPathPoint, ObjectVector3, ScenarioType, TabletopType} from './scenarioUtils';
import {PieceVisibilityEnum} from './storage/storageContract';

export type BaseMenuContext = GtoveDispatchProp & {
    selected: TabletopViewComponentSelected;
    setSelected: (value?: TabletopViewComponentSelected) => void;
    setEditSelected: (value?: TabletopViewComponentEditSelected) => void;
    setMenuSelected: (menuSelected?: TabletopViewComponentMenuSelected) => void;
    setCamera: SetCameraFunction;
    focusMapId?: string;
    setFocusMapId: (mapId: string, panCamera?: boolean) => void;
    userIsGM: boolean;
    scenario: ScenarioType;
    tabletop: TabletopType;
    tabletopState: TabletopStateReducerType;
    confirmLargeFogOfWarAction: (mapIds: string[]) => Promise<boolean>;
    finaliseSelectedBy: (alsoClearHandles?: boolean) => void;
    replaceMapImageFn?: (metadataId: string) => void;
    promiseModal?: PromiseModalDialogType;
    verifyMiniVisibility: (miniId: string, visibility: PieceVisibilityEnum) => Promise<boolean>;
    endFogOfWarMode: () => void;
    findPositionForNewMini: (allowHiddenMap: boolean, scale: number, basePosition?: THREE.Vector3 | ObjectVector3) => MovementPathPoint;
    findUnusedMiniName: (baseName: string, suffix?: number, space?: boolean) => [string, number];
};

export type MapMenuContext = BaseMenuContext & {
    selected: TabletopViewComponentSelected & {mapId: string};
    map: MapType;
    mini?: MiniType;
};

export function isMapMenuContext(context?: AnyMenuContext): context is MapMenuContext {
    return context?.map !== undefined;
}

export type MiniMenuContext = BaseMenuContext & {
    selected: TabletopViewComponentSelected & {miniId: string; name: string};
    map?: MapType;
    mini: MiniType;
};

export function isMiniMenuContext(context?: AnyMenuContext): context is MiniMenuContext {
    return context?.mini !== undefined;
}

export type AnyMenuContext = BaseMenuContext & {
    map?: MapType;
    mini?: MiniType;
};

export interface ButtonContextMenuOption<Context extends BaseMenuContext> {
    label: string;
    title: string;
    onClick: (context: Context) => void | Promise<void>;
    show?: (context: Context) => boolean;
    keepOpenOnClick?: boolean;
    autoExecuteSingleOption?: boolean;
}

export interface CustomContextMenuOption<Context extends BaseMenuContext> {
    render: (context: Context, cancelMenu: () => void) => ReactElement;
    show?: (context: Context) => boolean;
}

export type ContextMenuOption<Context extends BaseMenuContext = BaseMenuContext> = ButtonContextMenuOption<Context> | CustomContextMenuOption<Context>;