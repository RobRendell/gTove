import {useThree} from '@react-three/fiber';
import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import isEqual from 'lodash/isEqual';
import {FunctionComponent, memo, useCallback, useMemo, useRef} from 'react';
import {shallowEqual, useDispatch, useSelector, useStore} from 'react-redux';
import {toast} from 'react-toastify';
import {AnyAction} from 'redux';
import * as THREE from 'three';
import {Euler, Plane, Vector3} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useMapPathData} from '../hooks/useMapPathData';
import {useRaycast} from '../hooks/useRaycast';
import {getMyPeerIdFromStore, getScenarioFromStore, getTabletopFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    separateUndoGroupAction,
    undoGroupActionList,
    updateMiniElevationAction,
    updateMiniPositionAction,
    updateMiniRotationAction,
    updateMiniScaleAction
} from '../redux/scenarioReducer';
import {
    getGridTypeOfMap,
    getMapIdAtPoint,
    getRootAttachedMiniId,
    MiniType,
    ObjectVector2,
    PiecesRosterColumn,
    snapMini,
    TabletopType
} from '../util/scenarioUtils';
import {GridType, PieceVisibilityEnum} from '../util/storage/storageContract';
import {buildEuler, buildVector3} from '../util/threeUtils';
import {GToveThunk} from '../util/types';
import {SnapMiniToTabletopType, TabletopMiniWrapper} from './tabletopMiniWrapper';
import {RayCastIntersectMini, TabletopViewGestureContext} from './tabletopViewComponent';

interface TabletopMiniLayerProps {
    defaultGrid: GridType;
    snapToGrid: boolean;
    adjustingScale: boolean;
    showMiniNames: boolean;
    interestLevelY: number;
    cameraLookingDown: boolean;
    topDown: boolean;
    gmView: boolean;
    nearColumns: PiecesRosterColumn[];
    simpleNearColumns: PiecesRosterColumn[];
    tabletop: TabletopType;
    labelSize: number;
    selectedMiniId?: string;
    multipleMiniIds?: string[];
    undoGroupId?: string;
}

export const TabletopMiniLayer: FunctionComponent<TabletopMiniLayerProps> = memo(({
                                                                                      defaultGrid,
                                                                                      snapToGrid,
                                                                                      adjustingScale,
                                                                                      showMiniNames,
                                                                                      interestLevelY,
                                                                                      cameraLookingDown,
                                                                                      topDown,
                                                                                      gmView,
                                                                                      nearColumns,
                                                                                      simpleNearColumns,
                                                                                      tabletop,
                                                                                      labelSize,
                                                                                      selectedMiniId,
                                                                                      multipleMiniIds,
                                                                                      undoGroupId
                                                                                  }) => {
    const {rootMiniIds, attachedMinisMap, polygonOffsetMap} = useSelector(rootMinisAndAttachedMinisMapSelector);
    const mapPathData = useMapPathData();
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const dispatch = useDispatch();
    const {raycastForFirstUserDataFields, raycaster} = useRaycast();
    const {size: {width}} = useThree();
    const store = useStore();

    // Create some functions which use data from the store, but don't change referentially when the store data changes.
    // TODO when tabletopViewComponent is functional, consider defining these there and passing them as props, instead
    //  of this component requiring props for defaultGrid, adjustingScale and tabletop
    const getGridTypeOfMapId = useCallback((mapId?: string) => (
        !mapId ? defaultGrid
            : getGridTypeOfMap(getScenarioFromStore(store.getState()).maps[mapId], defaultGrid)
    ), [defaultGrid, store]);
    const snapMiniToTabletop = useCallback<SnapMiniToTabletopType>((mini?: MiniType) => (
        !mini ? undefined
            // Only actually snap the mini to the grid when it's being moved by someone.
            : snapMini(snapToGrid && !!mini.selectedBy, getGridTypeOfMapId(mini.onMapId), mini.scale, mini.position,
                mini.elevation, mini.rotation, !adjustingScale)
    ), [adjustingScale, getGridTypeOfMapId, snapToGrid]);

    const {camera} = useThree();
    const isCameraTooOblique = useCallback(() => {
        // Is the camera is too oblique to safely pan minis?
        const cameraDistanceSq = camera.position.distanceToSquared(camera.userData._lookAt);
        const deltaY = camera.position.y - camera.userData._lookAt.y;
        return deltaY * deltaY / cameraDistanceSq < 0.04;
    }, [camera]);

    const finaliseAdjustedMinis = useCallback(() => {
        let actions: (AnyAction | GToveThunk<any>)[] = [];
        const scenario = getScenarioFromStore(store.getState());
        const allMiniIds = Object.keys(scenario.minis)
            .filter((miniId) => (scenario.minis[miniId].selectedBy === myPeerId));
        for (let miniId of allMiniIds) {
            const actionLength = actions.length;
            const mini = scenario.minis[miniId];
            if (!mini || mini.selectedBy !== myPeerId) {
                continue;
            }
            const snapMini = snapMiniToTabletop(mini);
            if (!snapMini) {
                continue;
            }
            let {positionObj, rotationObj, scaleFactor, elevation} = snapMini;
            if (mini.attachMiniId) {
                // Need to make position, rotation and elevation relative to the attached mini
                const attachSnapMini = snapMiniToTabletop(scenario.minis[mini.attachMiniId]);
                if (attachSnapMini) {
                    const {positionObj: attachPosition, rotationObj: attachRotation, elevation: attachElevation} = attachSnapMini;
                    positionObj = buildVector3(positionObj).sub(attachPosition as THREE.Vector3).applyEuler(new THREE.Euler(-attachRotation.x, -attachRotation.y, -attachRotation.z, attachRotation.order));
                    rotationObj = {x: rotationObj.x - attachRotation.x, y: rotationObj.y - attachRotation.y, z: rotationObj.z - attachRotation.z, order: rotationObj.order};
                    elevation -= attachElevation;
                }
            }
            if (!isEqual(rotationObj, mini.rotation)) {
                actions.push(updateMiniRotationAction(miniId, rotationObj, null));
            }
            if (elevation !== mini.elevation) {
                actions.push(updateMiniElevationAction(miniId, elevation, null));
            }
            if (scaleFactor !== mini.scale) {
                actions.push(updateMiniScaleAction(miniId, scaleFactor, null));
            }
            if (actions.length === actionLength || !isEqual(positionObj, mini.position)) {
                // Default to updating position if no others are needed, to reset selectedBy
                actions.push(updateMiniPositionAction(miniId, positionObj, null, mini.onMapId));
            }
        }
        if (undoGroupId) {
            actions = undoGroupActionList(actions, undoGroupId);
        } else {
            actions.push(separateUndoGroupAction() as any);
        }
        for (const action of actions) {
            dispatch(action);
        }
    }, [dispatch, myPeerId, snapMiniToTabletop, store, undoGroupId]);

    // Gesture handling
    const intersectMiniIdRef = useRef<string | undefined>();
    const dragYRef = useRef(0);
    const initialOffsetRef = useRef(new Vector3());
    const mapDragGridRef = useRef(GridType.NONE);
    const planeRef = useRef(new Plane());
    const planeIntersectRef = useRef(new Vector3());
    const match = useCallback((context: TabletopViewGestureContext) => (
        !context.readOnly && (
            (context.intersect?.type === 'miniId' && (!selectedMiniId || selectedMiniId === context.intersect.miniId || multipleMiniIds?.includes(context.intersect.miniId)))
            || (!context.intersect && (selectedMiniId !== undefined))
        )
    ), [multipleMiniIds, selectedMiniId]);
    const onMatch = useCallback((context: TabletopViewGestureContext<RayCastIntersectMini | undefined>) => {
        if (context.intersect) {
            const scenario = getScenarioFromStore(store.getState());
            intersectMiniIdRef.current = getRootAttachedMiniId(context.intersect.miniId, scenario.minis);
            dragYRef.current = context.intersect.point.y;
            mapDragGridRef.current = getTabletopFromStore(store.getState()).defaultGrid;
            const snappedMini = snapMiniToTabletop(scenario.minis[intersectMiniIdRef.current]);
            if (snappedMini) {
                initialOffsetRef.current.copy(snappedMini.positionObj as Vector3).sub(context.intersect.point);
            } else {
                initialOffsetRef.current.set(0, 0, 0);
            }
        }
    }, [snapMiniToTabletop, store]);
    const onGestureStart = useCallback(() => {
        // Define a (no-op) onGestureStart to prevent the default behaviour (to unselect everything).
    }, []);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2) => {
        const selectedMiniId = intersectMiniIdRef.current;
        if (!selectedMiniId) {
            return;
        }
        if (isCameraTooOblique()) {
            // TODO this will spam toasts
            toast('Your view is too oblique to safely move pieces.  Rotate your view to look down from further above the map.');
            return;
        }
        const intersect = raycastForFirstUserDataFields(position, 'mapId');
        const dragY = intersect ? (intersect.point.y - initialOffsetRef.current.y) : dragYRef.current;
        planeRef.current.setComponents(0, -1, 0, dragY);
        const point = planeIntersectRef.current;
        if (!raycaster.ray.intersectPlane(planeRef.current, point)) {
            return;
        }
        point.add(initialOffsetRef.current);
        const scenario = getScenarioFromStore(store.getState());
        const mini = scenario.minis[selectedMiniId];
        if (mini.attachMiniId) {
            // Need to reorient the drag position to be relative to the attachMiniId
            const snapMini = snapMiniToTabletop(scenario.minis[mini.attachMiniId]);
            if (snapMini) {
                const {positionObj, rotationObj} = snapMini;
                point.sub(positionObj as Vector3).applyEuler(new Euler(-rotationObj.x, -rotationObj.y, -rotationObj.z, rotationObj.order));
            }
        }
        let actions = [];
        const onMapId = getMapIdAtPoint(point, scenario.maps, mini.visibility === PieceVisibilityEnum.HIDDEN);
        actions.push(updateMiniPositionAction(selectedMiniId, point, myPeerId, onMapId));
        if (multipleMiniIds) {
            // Also update the position of the other minis
            point.sub(mini.position as Vector3);
            for (let otherMiniId of multipleMiniIds) {
                if (otherMiniId !== selectedMiniId) {
                    const otherMini = scenario.minis[otherMiniId];
                    if (otherMini) {
                        // Players might drag the elastic-banded minis into fog, losing some of them from their scenario.
                        const newPosition = buildVector3(otherMini.position).add(point);
                        const newOnMapId = getMapIdAtPoint(newPosition, scenario.maps, otherMini.visibility === PieceVisibilityEnum.HIDDEN);
                        actions.push(updateMiniPositionAction(otherMiniId, newPosition, myPeerId, newOnMapId));
                    }
                }
            }
        }
        actions = undoGroupActionList(actions, undoGroupId);
        for (let action of actions) {
            dispatch(action);
        }
    }, [dispatch, isCameraTooOblique, multipleMiniIds, myPeerId, raycastForFirstUserDataFields, raycaster, snapMiniToTabletop, store, undoGroupId]);
    const onRotate = useCallback((delta: ObjectVector2, currentPos: ObjectVector2, startPos: ObjectVector2) => {
        const selectedMiniId = intersectMiniIdRef.current;
        if (!selectedMiniId) {
            return;
        }
        const quadrant14 = (currentPos.x - startPos.x > currentPos.y - startPos.y);
        const quadrant12 = (currentPos.x - startPos.x > startPos.y - currentPos.y);
        const amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
        // dragging across whole screen goes 360 degrees around
        const rotation = new THREE.Euler(0, 2 * Math.PI * amount / width, 0);
        const scenario = getScenarioFromStore(store.getState());
        const centre = buildVector3(scenario.minis[selectedMiniId].position);
        let actions = [];
        for (let miniId of multipleMiniIds?.length ? multipleMiniIds : [selectedMiniId]) {
            const mini = scenario.minis[miniId];
            if (mini) {
                // Players might rotate the elastic-banded minis into fog, losing some of them from their scenario.
                const miniRotation = buildEuler(mini.rotation);
                miniRotation.y += rotation.y;
                actions.push(updateMiniRotationAction(miniId, miniRotation, myPeerId));
                if (miniId !== selectedMiniId) {
                    const position = buildVector3(mini.position).sub(centre).applyEuler(rotation).add(centre);
                    actions.push(updateMiniPositionAction(miniId, position, myPeerId,
                        getMapIdAtPoint(position, scenario.maps, mini.visibility === PieceVisibilityEnum.HIDDEN)
                    ));
                }
            }
        }
        actions = undoGroupActionList(actions, undoGroupId);
        for (let action of actions) {
            dispatch(action);
        }
    }, [dispatch, multipleMiniIds, myPeerId, store, undoGroupId, width]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        const selectedMiniId = intersectMiniIdRef.current;
        if (!selectedMiniId) {
            return;
        }
        const scenario = getScenarioFromStore(store.getState());
        if (adjustingScale) {
            const {scale} = scenario.minis[selectedMiniId];
            // The smaller the mini's scale, the more fine-grained the adjustments
            const deltaScale = delta.y / Math.max(20, 20 / scale);
            dispatch(updateMiniScaleAction(selectedMiniId, Math.max(0.0625, scale - deltaScale), myPeerId));
        } else {
            const deltaY = -delta.y / 20;
            let actions = [];
            for (let miniId of multipleMiniIds?.length ? multipleMiniIds : [selectedMiniId]) {
                const mini = scenario.minis[miniId];
                if (mini) {
                    // Players might drag the elastic-banded minis into fog, losing some of them from their scenario.
                    const snapMini = !mini.attachMiniId ? undefined : snapMiniToTabletop(scenario.minis[mini.attachMiniId]);
                    const lowerLimit = (snapMini) ? -snapMini.elevation : 0;
                    actions.push(updateMiniElevationAction(miniId, Math.max(lowerLimit, mini.elevation + deltaY), myPeerId));
                }
            }
            actions = undoGroupActionList(actions, undoGroupId);
            for (const action of actions) {
                dispatch(action);
            }
        }
    }, [adjustingScale, dispatch, multipleMiniIds, myPeerId, snapMiniToTabletop, store, undoGroupId]);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'miniLayerGestureHandler',
        priority: 5,
        match,
        onMatch,
        onNoMatch: finaliseAdjustedMinis,
        onGestureStart,
        onPan,
        onRotate,
        onZoom,
        onGestureEnd: finaliseAdjustedMinis
    }), [finaliseAdjustedMinis, match, onGestureStart, onMatch, onPan, onRotate, onZoom]);
    useGestureHandler(gestureHandler);

    return (
        <>
            {
                rootMiniIds.map((miniId) => (
                    <TabletopMiniWrapper key={miniId} miniId={miniId} polygonOffsetMap={polygonOffsetMap}
                                         snapMiniToTabletop={snapMiniToTabletop} attachedMinisMap={attachedMinisMap}
                                         interestLevelY={interestLevelY} cameraLookingDown={cameraLookingDown}
                                         topDown={topDown} gmView={gmView} showMiniNames={showMiniNames}
                                         nearColumns={nearColumns} simpleNearColumns={simpleNearColumns}
                                         labelSize={labelSize} labelColour={tabletop.labelColour}
                                         snapToGrid={snapToGrid} mapPathData={mapPathData}
                    />
                ))
            }
        </>
    );
});

// This selector only emits a new array if mini IDs are added or removed
const selectMiniIds = createSelector(
    [(state: ReduxStoreType) => getScenarioFromStore(state).minis],
    (minis) => Object.keys(minis),
    {
        memoize: lruMemoize,
        memoizeOptions: {resultEqualityCheck: shallowEqual}
    }
);

// This selector only emits a new array if an attachment relationships change
const selectAttachmentIds = createSelector(
    [(state: ReduxStoreType) => getScenarioFromStore(state).minis],
    (minis) => Object.values(minis).map(m => m.attachMiniId),
    {
        memoize: lruMemoize,
        memoizeOptions: {resultEqualityCheck: shallowEqual}
    }
);

// To reduce z-fighting, give every mini a different (tiny) polygon offset.
const POLYGON_OFFSET = -0.025;

// This selector returns the miniIds that are not attached to any others (rootMiniIds) and a map from miniIds to arrays
// of any attached minis (attachedMinisMap), allowing us to efficiently render the minis in a THREE.js object tree, with
// attached minis as child objects of their parent. Also return a map of unique polygonOffset values for each mini.
const rootMinisAndAttachedMinisMapSelector = createSelector(
    // The memoized output of the below two input selectors ensures the output selector isn't re-evaluated unless the
    // input values actually change (i.e. the combined selector will not trigger a re-render for irrelevant changes to
    // the minis slice such as updates to a mini's name or position, and will just return its memoized result if the
    // calling component is otherwise re-rendered).
    [selectMiniIds, selectAttachmentIds],
    (miniIds, attachedMiniIds) => {
        const rootMiniIds: string[] = [];
        const attachedMinisMap: {[miniId: string]: string[]} = {};
        attachedMiniIds.forEach((attachMiniId, index) => {
            const miniId = miniIds[index];
            if (!attachMiniId) {
                rootMiniIds.push(miniId);
            } else {
                if (!attachedMinisMap[attachMiniId]) {
                    attachedMinisMap[attachMiniId] = [miniId];
                } else {
                    attachedMinisMap[attachMiniId].push(miniId);
                }
            }
        });
        const polygonOffsetMap = Object.fromEntries(
            miniIds.map((miniId, index) => ([miniId, index * POLYGON_OFFSET]))
        );
        return {rootMiniIds, attachedMinisMap, polygonOffsetMap};
    }
);