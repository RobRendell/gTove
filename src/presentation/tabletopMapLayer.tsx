import {useThree} from '@react-three/fiber';
import isEqual from 'lodash/isEqual';
import {FunctionComponent, memo, useCallback, useMemo, useRef} from 'react';
import {shallowEqual, useSelector, useStore} from 'react-redux';
import {Vector3} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useRaycast} from '../hooks/useRaycast';
import {
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import {
    separateUndoGroupAction,
    undoGroupActionList,
    updateMapPositionAction,
    updateMapRotationAction
} from '../redux/scenarioReducer';
import {getGridTypeOfMap, ObjectVector2, snapMap} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {castMapProperties} from '../util/storage/storageUtils';
import {buildEuler} from '../util/threeUtils';
import {TabletopBlankGrid} from './tabletopBlankGrid';
import {TabletopMapWrapper} from './tabletopMapWrapper';
import {RayCastIntersectMap, TabletopViewGestureContext} from './tabletopViewComponent';
import {SetCameraFunction} from './virtualGamingTabletop';

function selectMapIdsFromStore(store: ReduxStoreType) {
    return Object.keys(getScenarioFromStore(store).maps);
}

interface TabletopMapLayerProps extends GtoveDispatchProp {
    interestLevelY: number;
    cameraLookingDown: boolean;
    defaultGrid: GridType;
    gmView: boolean;
    snapToGrid: boolean;
    setCamera: SetCameraFunction;
}

export const TabletopMapLayer: FunctionComponent<TabletopMapLayerProps> = memo(({
                                                                                    dispatch,
                                                                                    interestLevelY,
                                                                                    cameraLookingDown,
                                                                                    defaultGrid,
                                                                                    gmView,
                                                                                    snapToGrid,
                                                                                    setCamera
                                                                                }) => {
    const mapIds = useSelector(selectMapIdsFromStore, shallowEqual);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const store = useStore();
    const {raycastToPlane} = useRaycast();
    const {size: {width}} = useThree();
    const {undoGroupId} = useSelector(getTabletopStateFromStore);

    const getSelectedMapId = useCallback(() => {
        const maps = getScenarioFromStore(store.getState()).maps;
        return Object.keys(maps).find((mapId) => (maps[mapId].selectedBy === myPeerId));
    }, [myPeerId, store]);
    const getValidSelected = useCallback(() => {
        const mapId = getSelectedMapId();
        return !mapId ? undefined : {mapId, map: getScenarioFromStore(store.getState()).maps[mapId]};
    }, [getSelectedMapId, store])

    // Gesture handling
    const offsetRef = useRef(new Vector3());
    const mapDragGridRef = useRef(GridType.NONE);
    const match = useCallback((context: TabletopViewGestureContext) => {
        const selectedMapId = getSelectedMapId();
        return !context.readOnly && (
            (context.intersect?.type === 'mapId' && selectedMapId === context.intersect.mapId)
            || (!context.intersect && selectedMapId !== undefined)
        );
    }, [getSelectedMapId]);
    const onMatch = useCallback((context: TabletopViewGestureContext<RayCastIntersectMap | undefined>) => {
        const validSelected = getValidSelected();
        if (context.intersect && validSelected) {
            offsetRef.current.copy(validSelected.map.position as Vector3).sub(context.intersect.point);
            offsetRef.current.y = 0;
        }
        mapDragGridRef.current = getGridTypeOfMap(validSelected?.map, getTabletopFromStore(store.getState()).defaultGrid);
    }, [getValidSelected, store]);
    const onGestureStart = useCallback(() => {
        // Define a (no-op) onGestureStart to prevent the default behaviour (to unselect everything).
    }, []);
    const onPan = useCallback((_delta: ObjectVector2, gesturePosition: ObjectVector2) => {
        const selected = getValidSelected();
        if (selected) {
            const dragY = selected.map.position.y;
            const intersect = raycastToPlane(gesturePosition, dragY);
            if (intersect) {
                intersect.add(offsetRef.current);
                dispatch(updateMapPositionAction(selected.mapId, intersect, myPeerId));
            }
        }
    }, [dispatch, getValidSelected, myPeerId, raycastToPlane]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        const selected = getValidSelected();
        if (selected) {
            const deltaVector = {x: 0, y: -delta.y / 20, z: 0} as THREE.Vector3;
            offsetRef.current.copy(selected.map.position as THREE.Vector3).add(deltaVector);
            dispatch(updateMapPositionAction(selected.mapId, offsetRef.current, myPeerId));
            setCamera({
                deltaLookAt: deltaVector,
                deltaPosition: deltaVector
            });
        }
    }, [dispatch, getValidSelected, myPeerId, setCamera]);
    const onRotate = useCallback((delta: ObjectVector2, currentPos: ObjectVector2) => {
        const selected = getValidSelected();
        if (selected) {
            const {map, mapId} = selected;
            const intersect = raycastToPlane(currentPos, map.position.y);
            if (map && intersect) {
                const quadrant14 = (intersect.x - map.position.x > intersect.z - map.position.z);
                const quadrant12 = (intersect.x - map.position.x > map.position.z - intersect.z);
                const amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
                let rotation = buildEuler(map.rotation);
                // dragging across whole screen goes 360 degrees around
                rotation.y += 2 * Math.PI * amount / width;
                dispatch(updateMapRotationAction(mapId, rotation, myPeerId));
            }
        }
    }, [dispatch, getValidSelected, myPeerId, raycastToPlane, width]);
    const onGestureEnd = useCallback(() => {
        let actions = [];
        const selected = getValidSelected();
        if (!selected) {
            return;
        }
        const {map, mapId} = selected;
        const {positionObj, rotationObj} = snapMap(snapToGrid && map.selectedBy !== null,
            castMapProperties(map.metadata.properties), map.position, map.rotation);
        if (!isEqual(rotationObj, map.rotation)) {
            actions.push(updateMapRotationAction(mapId, rotationObj, null));
        }
        if (actions.length === 0 || !isEqual(positionObj, map.position)) {
            // Default to updating position if no others are needed, to reset selectedBy
            actions.push(updateMapPositionAction(mapId, positionObj, null));
        }
        if (undoGroupId) {
            actions = undoGroupActionList(actions, undoGroupId);
        } else {
            actions.push(separateUndoGroupAction() as any);
        }
        for (let action of actions) {
            dispatch(action);
        }
    }, [dispatch, getValidSelected, snapToGrid, undoGroupId]);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'mapGestureHandler',
        priority: 5,
        match,
        onMatch,
        onGestureStart,
        onPan,
        onZoom,
        onRotate,
        onGestureEnd,
    }), [match, onGestureEnd, onGestureStart, onMatch, onPan, onRotate, onZoom]);
    useGestureHandler(gestureHandler);

    return mapIds.length === 0 ? (
        <TabletopBlankGrid grid={defaultGrid} />
    ) : (
        <>
            {
                mapIds.map((mapId) => (
                    <TabletopMapWrapper key={mapId} mapId={mapId} interestLevelY={interestLevelY}
                                        cameraLookingDown={cameraLookingDown}
                                        dispatch={dispatch} gmView={gmView} snapToGrid={snapToGrid}
                    />
                ))
            }
        </>
    );
});