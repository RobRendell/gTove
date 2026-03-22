import './tabletopDragHandle.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Vector2} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {getMyPeerIdFromStore, getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {toggleTabletopStateDragModeAction} from '../redux/tabletopStateReducer';
import {ObjectVector2} from '../util/scenarioUtils';
import {TabletopViewComponentMenuSelected, TabletopViewGestureContext} from './tabletopViewComponent';
import Tooltip from './tooltip';

interface TabletopDragHandleProps {
    className?: string;
    setMenuSelected: (menuSelected?: TabletopViewComponentMenuSelected) => void;
}

const TabletopDragHandle: FunctionComponent<TabletopDragHandleProps> = ({
                                                                            className,
                                                                            setMenuSelected
                                                                        }) => {
    const {dragMode} = useSelector(getTabletopStateFromStore);
    const dispatch = useDispatch();
    const repositionMap = useSelector(selectAnySelectedMap);

    const match = useCallback((context: TabletopViewGestureContext) => (
        context.dragHandle
    ), []);
    
    const onTap = useCallback((position: ObjectVector2) => {
        if (dragMode === 'fogOfWarMode') {
            // show fog of war menu
            setMenuSelected({
                selected: {position: new Vector2(position.x, position.y), fogOfWarHandle: true},
                label: 'Use this handle to pan the camera while in Fog of War mode.'
            });
        } else if (repositionMap) {
            // show reposition menu
            setMenuSelected({
                selected: {position: new Vector2(position.x, position.y), repositionMap: true},
                label: 'Use this handle to pan the camera while repositioning the map.'
            });
        } else if (dragMode === 'measureDistanceMode') {
            // End measureDistanceMode
            dispatch(toggleTabletopStateDragModeAction('measureDistanceMode'));
        }
    }, [dispatch, dragMode, repositionMap, setMenuSelected]);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'dragHandle',
        priority: 20,
        match,
        onTap
    }), [match, onTap]);
    useGestureHandler(gestureHandler);

    const dragHandleTooltip = useMemo(() => (
        (dragMode === 'fogOfWarMode') ? 'Use this handle to pan the camera without leaving Fog of War mode.'
            : (dragMode === 'measureDistanceMode') ? 'Use this handle to pan the camera while measuring distances.'
                : (dragMode === 'elasticBandMode') ? 'Use this handle to pan the camera while in elastic band mode.'
                    : (dragMode === 'paintMode') ? 'Use this handle to pan the camera without leaving paint mode.'
                        : (repositionMap) ? 'Use this handle to pan the camera while repositioning the map.'
                            : undefined
    ), [dragMode, repositionMap]);

    return (
        (!dragHandleTooltip) ? null : (
            <div className={classNames('tabletopDragHandle', className)}>
                <Tooltip tooltip={dragHandleTooltip}>
                    <div className='material-icons'>pan_tool</div>
                </Tooltip>
            </div>
        )
    )
};

export default TabletopDragHandle;

function selectAnySelectedMap(state: ReduxStoreType) {
    const myPeerId = getMyPeerIdFromStore(state);
    const maps = getScenarioFromStore(state).maps;
    return !myPeerId ? false : Object.values(maps).some((map) => (map.selectedBy === myPeerId))
}