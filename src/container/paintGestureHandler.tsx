import {FunctionComponent, useCallback, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {v4} from 'uuid';

import {isRayCastIntersectMap, RayCastIntersectMap, useRaycast} from '../hooks/useRaycast';
import {PaintToolEnum} from '../presentation/paintTools';
import {TabletopViewGestureContext} from '../presentation/tabletopViewComponent';
import {getTabletopStateFromStore} from '../redux/mainReducer';
import {
    clearTabletopStateDragModeAction,
    toggleTabletopStateDragModeAction,
    updateTabletopPaintStateAction
} from '../redux/tabletopStateReducer';
import {ObjectVector2} from '../util/scenarioUtils';
import {GestureHandler, useGestureHandler} from './gestureControls';

const PaintGestureHandler: FunctionComponent = () => {
    const {paintState} = useSelector(getTabletopStateFromStore);
    const {raycastForFirstUserDataFields} = useRaycast();
    
    const dispatch = useDispatch();
    const paintModeActive = (paintState.open && paintState.selected !== PaintToolEnum.NONE);
    useEffect(() => {
        if (paintModeActive) {
            dispatch(toggleTabletopStateDragModeAction('paintMode'));
        }
        return () => {
            dispatch(clearTabletopStateDragModeAction('paintMode'));
        }
    }, [dispatch, paintModeActive]);
    
    const match = useCallback((context: TabletopViewGestureContext) => (
        !context.readOnly && !context.dragHandle && context.dragMode === 'paintMode' && context.allIntersects.some(isRayCastIntersectMap)
    ), []);
    const onMatch = useCallback((context: TabletopViewGestureContext<RayCastIntersectMap>) => {
        const mapIntersect = context.allIntersects.find(isRayCastIntersectMap);
        if (mapIntersect) {
            dispatch(updateTabletopPaintStateAction({operationId: v4(), toolPositionStart: mapIntersect.point, toolMapId: mapIntersect.mapId}));
        }
    }, [dispatch]);
    const onTap = useCallback(() => {
        if (paintState.toolPositionStart) {
            dispatch(updateTabletopPaintStateAction({toolPosition: paintState.toolPositionStart}));
        }
    }, [dispatch, paintState.toolPositionStart]);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2) => {
        const paintTarget = raycastForFirstUserDataFields(position, ['mapId']);
        if (paintTarget) {
            dispatch(updateTabletopPaintStateAction({toolPosition: paintTarget.point, toolMapId: paintTarget.mapId}));
        }
    }, [dispatch, raycastForFirstUserDataFields]);
    const onGestureEnd = useCallback(() => {
        setTimeout(() => {
            dispatch(updateTabletopPaintStateAction({operationId: undefined, toolPositionStart: undefined, toolPosition: undefined, toolMapId: undefined}));
        }, 1);
    }, [dispatch]);
    
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'paintGestureHandler',
        priority: 10,
        match,
        onMatch,
        onTap,
        onPan,
        onGestureEnd
    }), [match, onGestureEnd, onMatch, onPan, onTap]);
    useGestureHandler(gestureHandler);
    
    return null;
};

export default PaintGestureHandler;