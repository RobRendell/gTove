import {useThree} from '@react-three/fiber';
import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';
import {FunctionComponent, memo, useCallback, useContext, useMemo, useRef} from 'react';
import {shallowEqual, useDispatch, useSelector, useStore} from 'react-redux';
import {Vector3} from 'three';
import {v4} from 'uuid';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useCameraParameters} from '../context/cameraParametersProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {useConfirmLargeFogOfWarAction} from '../hooks/useConfirmLargeFogOfWarAction';
import {isRayCastIntersectMap, RayCastIntersectMap, useRaycast} from '../hooks/useRaycast';
import {
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    addMapAction,
    removeMapAction,
    removeMiniAction,
    separateUndoGroupAction,
    undoGroupActionList,
    undoGroupThunk,
    updateMapCameraFocusPoint,
    updateMapFogOfWarAction,
    updateMapGMOnlyAction,
    updateMapPositionAction,
    updateMapRotationAction,
    updateMapSelectedByAction,
    updateMapTransparencyAction,
    updateMiniElevationAction,
    updateMiniPositionAction
} from '../redux/scenarioReducer';
import {updateTabletopVideoMutedAction} from '../redux/tabletopReducer';
import {
    clearTabletopStateUndoGroupIdAction,
    setTabletopStateCurrentPageStateAction,
    setTabletopStateScenarioReplaceStateAction,
    toggleTabletopStateDragModeAction
} from '../redux/tabletopStateReducer';
import {GToveMode} from '../redux/tabletopStateReducerTypes';
import {MAP_EPSILON, NEW_MAP_DELTA_Y} from '../util/constants';
import {promiseSleep} from '../util/promiseSleep';
import {
    getBaseCameraParameters,
    getFocusMapIdAndFocusPointAtLevel,
    getGridTypeOfMap,
    getMapIdOnNextLevel,
    getMapIdsAtLevel,
    ObjectVector2,
    selectConfirmMovesAndSnapToGridFromScenario,
    snapMap
} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {castMapProperties} from '../util/storage/storageUtils';
import {TabletopTapMenuList} from '../util/tapMenuTypes';
import {buildEuler, buildVector3} from '../util/threeUtils';
import {TabletopBlankGrid} from './tabletopBlankGrid';
import {TabletopMapWrapper} from './tabletopMapWrapper';
import {useTapMenu} from './tabletopTapMenu';
import {TabletopViewGestureContext} from './tabletopViewComponent';

function selectMapIdsFromStore(store: ReduxStoreType) {
    return Object.keys(getScenarioFromStore(store).maps);
}

interface TabletopMapLayerProps {
    interestLevelY: number;
    gmView: boolean;
}

export const TabletopMapLayer: FunctionComponent<TabletopMapLayerProps> = memo(({interestLevelY, gmView}) => {
    const dispatch = useDispatch();
    const {snapToGrid} = useSelector(selectConfirmMovesAndSnapToGridFromScenario, shallowEqual);
    const mapIds = useSelector(selectMapIdsFromStore, shallowEqual);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const store = useStore();
    const {raycastToPlane} = useRaycast();
    const {size: {width}} = useThree();
    const {undoGroupId, isLookingDown, focusMapId} = useSelector(getTabletopStateFromStore);
    const {setCameraParameters, setFocusMapId} = useCameraParameters();
    const promiseModal = useContext(PromiseModalContextObject);
    const confirmLargeFogOfWarAction = useConfirmLargeFogOfWarAction();

    const getSelectedMapId = useCallback(() => {
        const maps = getScenarioFromStore(store.getState()).maps;
        return !myPeerId ? undefined : Object.keys(maps).find((mapId) => (maps[mapId].selectedBy === myPeerId));
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
        return !context.readOnly && !context.dragHandle && (!context.dragMode || context.dragMode === 'repositionMapMode') && (
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
            const deltaVector = {x: 0, y: -delta.y / 20, z: 0} as Vector3;
            offsetRef.current.copy(selected.map.position as Vector3).add(deltaVector);
            dispatch(updateMapPositionAction(selected.mapId, offsetRef.current, myPeerId));
            setCameraParameters({
                deltaLookAt: deltaVector,
                deltaPosition: deltaVector
            });
        }
    }, [dispatch, getValidSelected, myPeerId, setCameraParameters]);
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
        actions.push(clearTabletopStateUndoGroupIdAction());
        actions.push(toggleTabletopStateDragModeAction('repositionMapMode'));
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
    
    const tapMenuOptions = useMemo<TabletopTapMenuList<RayCastIntersectMap>>(() => ({
        id: 'map tap options',
        intersect: {
            match: isRayCastIntersectMap,
            options: [
                {
                    label: 'Focus on map',
                    title: 'Focus the camera on this map.',
                    onClick: ({map, intersect}) => {
                        setCameraParameters(getBaseCameraParameters(map), 1000, intersect.mapId);
                    },
                    show: ({intersect}) => (intersect.mapId !== focusMapId)
                },
                {
                    label: 'Set camera focus point',
                    title: 'Set this point as the default camera focus point for this level.',
                    onClick: async ({map, intersect, scenario}) => {
                        const mapsAtLevel = getMapIdsAtLevel(scenario.maps, map.position.y);
                        for (let levelMapId of mapsAtLevel) {
                            if (levelMapId !== intersect.mapId && scenario.maps[levelMapId].cameraFocusPoint) {
                                dispatch(updateMapCameraFocusPoint(levelMapId));
                            }
                        }
                        dispatch(updateMapCameraFocusPoint(intersect.mapId, buildVector3(intersect.point).sub(map.position as Vector3)));
                        await promiseSleep(1);
                        setFocusMapId(intersect.mapId);
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
                {
                    label: 'Clear camera focus point',
                    title: 'Clear the default camera focus point for this level.',
                    onClick: ({map, scenario}) => {
                        const mapsAtLevel = getMapIdsAtLevel(scenario.maps, map.position.y);
                        for (let levelMapId of mapsAtLevel) {
                            dispatch(updateMapCameraFocusPoint(levelMapId));
                        }
                    },
                    show: ({map, userIsGM, scenario}) => {
                        return userIsGM && getFocusMapIdAndFocusPointAtLevel(scenario.maps, map.position.y).cameraFocusPoint !== undefined;
                    }
                },
                {
                    label: 'Mute Video',
                    title: 'Mute the audio track of this video texture',
                    onClick: ({map}) => {
                        dispatch(updateTabletopVideoMutedAction(map.metadata.id, true));
                    },
                    show: ({userIsGM, map, tabletop}) => (
                        userIsGM && !tabletop.videoMuted[map.metadata.id]
                    )
                },
                {
                    label: 'Unmute Video',
                    title: 'Unmute the audio track of this video texture',
                    onClick: ({map}) => {
                        dispatch(updateTabletopVideoMutedAction(map.metadata.id, false));
                    },
                    show: ({userIsGM, map, tabletop}) => (
                        userIsGM && tabletop.videoMuted[map.metadata.id] === true
                    )
                },
                {
                    label: 'Reveal',
                    title: 'Reveal this map to players',
                    onClick: ({intersect}) => {
                        dispatch(updateMapGMOnlyAction(intersect.mapId, false))
                    },
                    show: ({userIsGM, map}) => (userIsGM && map.gmOnly)
                },
                {
                    label: 'Hide',
                    title: 'Hide this map from players',
                    onClick: ({intersect}) => {
                        dispatch(updateMapGMOnlyAction(intersect.mapId, true))
                    },
                    show: ({userIsGM, map}) => (userIsGM && !map.gmOnly)
                },
                {
                    label: 'Reposition',
                    title: 'Pan, zoom (elevate) and rotate this map on the tabletop.',
                    onClick: ({intersect: selected}) => {
                        dispatch(updateMapSelectedByAction(selected.mapId, myPeerId));
                        dispatch(toggleTabletopStateDragModeAction('repositionMapMode'));
                        setFocusMapId(selected.mapId, false);
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
                {
                    label: 'Lift map one level',
                    title: 'Lift this map up to the elevation of the next level above',
                    onClick: ({map, intersect, scenario}) => {
                        const nextMapUpId = getMapIdOnNextLevel(1, scenario.maps, intersect.mapId);
                        const deltaVector = new Vector3(0, nextMapUpId ? scenario.maps[nextMapUpId].position.y - map.position.y + MAP_EPSILON : NEW_MAP_DELTA_Y, 0);
                        dispatch(updateMapPositionAction(intersect.mapId, deltaVector.clone().add(map.position as Vector3), null));
                        setCameraParameters({
                            deltaPosition: deltaVector,
                            deltaLookAt: deltaVector
                        }, 1000, intersect.mapId);
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
                {
                    label: 'Lower map one level',
                    title: 'Lower this map down to the elevation of the next level below',
                    onClick: ({map, intersect, scenario}) => {
                        const nextMapDownId = getMapIdOnNextLevel(-1, scenario.maps, intersect.mapId);
                        const deltaVector = new Vector3(0, nextMapDownId ? scenario.maps[nextMapDownId].position.y - map.position.y + MAP_EPSILON : -NEW_MAP_DELTA_Y, 0);
                        dispatch(updateMapPositionAction(intersect.mapId, deltaVector.clone().add(map.position as Vector3), null));
                        setCameraParameters({
                            deltaPosition: deltaVector,
                            deltaLookAt: deltaVector
                        }, 1000, intersect.mapId);
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
                {
                    label: 'Uncover map',
                    title: 'Uncover all Fog of War on this map.',
                    onClick: async ({intersect}) => {
                        if (await confirmLargeFogOfWarAction([intersect.mapId])) {
                            dispatch(updateMapFogOfWarAction(intersect.mapId));
                        }
                    },
                    show: ({userIsGM, map}) => (userIsGM && map.metadata?.properties?.gridType !== GridType.NONE)
                },
                {
                    label: 'Cover map',
                    title: 'Cover this map with Fog of War.',
                    onClick: async ({intersect}) => {
                        if (await confirmLargeFogOfWarAction([intersect.mapId])) {
                            dispatch(updateMapFogOfWarAction(intersect.mapId, []));
                        }
                    },
                    show: ({userIsGM, map}) => (userIsGM && map.metadata?.properties?.gridType !== GridType.NONE)
                },
                {
                    label: 'Enable transparent pixels',
                    title: 'Respect transparent or translucent pixels in the map\'s image, and make fog of war transparent (hiding the map\'s overall shape/size).  Enabling may cause visual glitches from certain angles.',
                    onClick: ({intersect}) => {
                        dispatch(updateMapTransparencyAction(intersect.mapId, true));
                    },
                    show: ({userIsGM, map}) => (userIsGM && map.transparent)
                },
                {
                    label: 'Disable transparent pixels',
                    title: 'Treat all pixels on this map as opaque.',
                    onClick: ({intersect}) => {
                        dispatch(updateMapTransparencyAction(intersect.mapId, false));
                    },
                    show: ({userIsGM, map}) => (userIsGM && map.transparent)
                },
                {
                    label: 'Copy and reposition',
                    title: 'Copy this map, and reposition the copy',
                    onClick: ({map}) => {
                        const mapId = v4();
                        dispatch(addMapAction({...map, selectedBy: myPeerId}, mapId));
                        setFocusMapId(mapId, false);
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
                {
                    label: 'Replace map',
                    title: 'Replace this map with a different map, preserving the current Fog of War',
                    onClick: ({intersect: selected}) => {
                        dispatch(setTabletopStateScenarioReplaceStateAction({mapImageId: selected.mapId}));
                        dispatch(setTabletopStateCurrentPageStateAction(GToveMode.MAP_SCREEN));
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
                {
                    label: 'Remove map',
                    title: 'Remove this map from the tabletop',
                    onClick: async ({intersect, map, scenario}) => {
                        const miniIdsOnMap = Object.keys(scenario.minis).filter((miniId) => (scenario.minis[miniId].onMapId === intersect.mapId));
                        const [hiddenMiniIdsOnMap, visibleMiniIdsOnMap] = partition(miniIdsOnMap, (miniId) => (scenario.minis[miniId].gmOnly));
                        const undoGroupId = v4();
                        let removeMiniIds: string[] = [];
                        let remainingMiniIds: string[] = [];
                        if (miniIdsOnMap.length > 0 && promiseModal?.isAvailable()) {
                            const removeAll = 'Remove map and its minis';
                            const removeFogged = hiddenMiniIdsOnMap.length > 0 ? 'Remove map and its hidden minis' : undefined;
                            const cancel = 'Cancel';
                            const answer = await promiseModal({
                                    children: (
                                        <>
                                            <p>
                                                The map currently has {miniIdsOnMap.length} piece{miniIdsOnMap.length === 1 ? '' : 's'} on it.
                                            </p>
                                            <p>
                                                You can remove the map and all minis on it, {hiddenMiniIdsOnMap.length === 0
                                                ? null : ' the map and all hidden minis on it, '} or just the map (leaving
                                                the minis behind, potentially revealing any fogged minis as the Fog of War hiding
                                                them is removed).
                                            </p>
                                        </>
                                    ),
                                    options: [removeAll, removeFogged, 'Remove map only', cancel]
                                })
                            ;
                            if (answer === cancel) {
                                return;
                            } else if (answer === removeAll) {
                                removeMiniIds = miniIdsOnMap;
                            } else if (removeFogged && answer === removeFogged) {
                                removeMiniIds = hiddenMiniIdsOnMap;
                                remainingMiniIds = visibleMiniIdsOnMap;
                            } else {
                                remainingMiniIds = miniIdsOnMap;
                            }
                        }
                        for (let miniId of removeMiniIds) {
                            dispatch(undoGroupThunk(removeMiniAction(miniId), undoGroupId));
                        }
                        if (remainingMiniIds.length > 0) {
                            const currentMapY = map.position.y;
                            const nextMapDownId = getMapIdOnNextLevel(-1, scenario.maps, intersect.mapId);
                            if (nextMapDownId || currentMapY > 0) {
                                const newMapY = nextMapDownId ? scenario.maps[nextMapDownId].position.y : 0;
                                for (let miniId of remainingMiniIds) {
                                    // Change the elevation of remaining minis so they're based on the next map down.
                                    const mini = scenario.minis[miniId];
                                    const elevation = mini.elevation + currentMapY - newMapY;
                                    dispatch(undoGroupThunk(updateMiniElevationAction(miniId, elevation, null), undoGroupId));
                                    dispatch(undoGroupThunk(updateMiniPositionAction(miniId, {
                                        ...mini.position,
                                        y: newMapY
                                    }, null, nextMapDownId), undoGroupId));
                                }
                            }
                        }
                        dispatch(undoGroupThunk(removeMapAction(intersect.mapId), undoGroupId));
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
            ]
        },
        dragHandle: {
            'repositionMapMode': {
                label: 'Use this handle to pan the camera while repositioning the map.',
                options: [
                    {
                        label: 'Finish',
                        title: 'Stop repositioning the map',
                        onClick: () => {
                            const mapId = getSelectedMapId();
                            if (mapId) {
                                dispatch(updateMapSelectedByAction(mapId, null));
                                dispatch(toggleTabletopStateDragModeAction('repositionMapMode'));
                            }
                        },
                        show: ({userIsGM}) => (userIsGM)
                    }
                ]
            }
        }
    }), [confirmLargeFogOfWarAction, dispatch, focusMapId, getSelectedMapId, myPeerId, promiseModal, setCameraParameters, setFocusMapId]);
    useTapMenu(tapMenuOptions);

    return mapIds.length === 0 ? (
        <TabletopBlankGrid />
    ) : (
        <>
            {
                mapIds.map((mapId) => (
                    <TabletopMapWrapper key={mapId} mapId={mapId} interestLevelY={interestLevelY}
                                        cameraLookingDown={isLookingDown} gmView={gmView} snapToGrid={snapToGrid}
                    />
                ))
            }
        </>
    );
});