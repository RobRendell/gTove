import {ReactElement} from 'react';

import {RayCastIntersect, RayCastIntersectMap, RayCastIntersectMini} from '../hooks/useRaycast';
import {DragModeType} from '../redux/tabletopStateReducerTypes';
import {MapType, MiniType, ObjectVector2, ScenarioType, TabletopType} from './scenarioUtils';

export type BaseTapMenuFunctionContext = {
    userIsGM: boolean;
    scenario: ScenarioType;
    tabletop: TabletopType;
}

export type TapMenuFunctionContext<Intersect extends RayCastIntersect> = BaseTapMenuFunctionContext & (
    Intersect extends RayCastIntersectMap ? {intersect: Intersect; map: MapType}
        : Intersect extends RayCastIntersectMini ? {intersect: Intersect; mini: MiniType}
            : {}
);

export interface TapMenuOptionButton<Intersect extends RayCastIntersect = RayCastIntersect> {
    label: string;
    title: string;
    onClick: (intersect: TapMenuFunctionContext<Intersect>) => void | Promise<void>;
    show?: (intersect: TapMenuFunctionContext<Intersect>) => boolean;
    keepOpenOnClick?: boolean;
    autoExecuteSingleOption?: boolean;
}

export interface TapMenuOptionCustom<Intersect extends RayCastIntersect = RayCastIntersect> {
    render: (intersect: TapMenuFunctionContext<Intersect>) => ReactElement;
    show?: (intersect: TapMenuFunctionContext<Intersect>) => boolean;
}

export type TapMenuOption<Intersect extends RayCastIntersect = RayCastIntersect> = TapMenuOptionButton<Intersect> | TapMenuOptionCustom<Intersect>;

export interface TabletopTapMenuList<Intersect extends RayCastIntersect = RayCastIntersect> {
    id: string;
    intersect?: {
        label?: string;
        match?: (intersect: RayCastIntersect) => intersect is Intersect;
        options: TapMenuOption<Intersect>[];
    };
    dragHandle?: {
        [mode in DragModeType]?: {
            label?: string;
            options: TapMenuOption[];
        }
    };
}

export interface TabletopTapMenuSelection<Intersect extends RayCastIntersect = RayCastIntersect> {
    position: ObjectVector2;
    label?: string;
    options: TapMenuOption<Intersect>[];
}
