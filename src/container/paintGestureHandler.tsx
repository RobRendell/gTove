import {FunctionComponent, useCallback, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {v4} from 'uuid';

import {PaintToolEnum} from '../presentation/paintTools';
import {RayCastField, RayCastIntersect, TabletopViewGestureContext} from '../presentation/tabletopViewComponent';
import {getTabletopStateFromStore} from '../redux/mainReducer';
import {
    clearTabletopStateDragModeAction,
    toggleTabletopStateDragModeAction,
    updateTabletopPaintStateAction
} from '../redux/tabletopStateReducer';
import {ObjectVector2} from '../util/scenarioUtils';
import {GestureHandler, useGestureHandler} from './gestureControls';

interface PaintGestureHandlerProps  {
    rayCastForFirstUserDataFields<T extends RayCastField, U extends Extract<RayCastIntersect, {type: T}>>(
        position: ObjectVector2, fields: T | T[]
    ): U | null;
}

const PaintGestureHandler: FunctionComponent<PaintGestureHandlerProps> = ({rayCastForFirstUserDataFields}) => {
    const {paintState} = useSelector(getTabletopStateFromStore);
    
    const dispatch = useDispatch();
    const paintModeActive = paintState.open && paintState.selected !== PaintToolEnum.NONE;
    useEffect(() => {
        if (paintModeActive) {
            dispatch(toggleTabletopStateDragModeAction('paintMode'));
        }
        return () => {
            dispatch(clearTabletopStateDragModeAction('paintMode'));
        }
    }, [dispatch, paintModeActive]);
    
    const match = useCallback((context: TabletopViewGestureContext) => {
        if (!context.readOnly && context.intersect?.type === 'mapId' && paintModeActive) {
            dispatch(updateTabletopPaintStateAction({operationId: v4(), toolPositionStart: context.intersect.point, toolMapId: context.intersect.mapId}));
            return true;
        }
        return false;
    }, [dispatch, paintModeActive]);
    const onTap = useCallback(() => {
        if (paintState.toolPositionStart) {
            dispatch(updateTabletopPaintStateAction({toolPosition: paintState.toolPositionStart}));
        }
    }, [dispatch, paintState.toolPositionStart]);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2) => {
        const paintTarget = rayCastForFirstUserDataFields(position, ['mapId']);
        if (paintTarget) {
            dispatch(updateTabletopPaintStateAction({toolPosition: paintTarget.point, toolMapId: paintTarget.mapId}));
        }
    }, [dispatch, rayCastForFirstUserDataFields]);
    const onGestureEnd = useCallback(() => {
        setTimeout(() => {
            dispatch(updateTabletopPaintStateAction({operationId: undefined, toolPositionStart: undefined, toolPosition: undefined, toolMapId: undefined}));
        }, 1);
    }, [dispatch]);
    
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'paintGestureHandler',
        priority: 10,
        match,
        onTap,
        onPan,
        onGestureEnd
    }), [match, onGestureEnd, onPan, onTap]);
    useGestureHandler(gestureHandler);
    
    return null;
};

export default PaintGestureHandler;