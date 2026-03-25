import {useThree} from '@react-three/fiber';
import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import isEqual from 'lodash/isEqual';
import {FunctionComponent, memo, useCallback, useMemo, useRef} from 'react';
import {shallowEqual, useDispatch, useSelector, useStore} from 'react-redux';
import {AnyAction} from 'redux';
import {Euler, Plane, Vector3} from 'three';
import {v4} from 'uuid';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useCameraParameters} from '../context/cameraParametersContextBridge';
import {useMapPathData} from '../hooks/useMapPathData';
import {useRaycast} from '../hooks/useRaycast';
import {useUserIsGM} from '../hooks/useUserIsGM';
import {
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    separateUndoGroupAction,
    undoGroupActionList,
    undoGroupThunk,
    updateMiniElevationAction,
    updateMiniPositionAction,
    updateMiniRotationAction,
    updateMiniScaleAction,
    updateMiniSelectedByAction
} from '../redux/scenarioReducer';
import {
    clearTabletopStateUndoGroupIdAction,
    setTabletopStateAdjustingMiniScaleAction,
    startTabletopStateUndoGroupIdAction
} from '../redux/tabletopStateReducer';
import {
    getAbsoluteMiniPosition,
    getGridTypeOfMap,
    getMapIdAtPoint,
    getRootAttachedMiniId,
    isNameColumn,
    ObjectVector2,
    PiecesRosterColumn,
    snapMini
} from '../util/scenarioUtils';
import {PieceVisibilityEnum} from '../util/storage/storageContract';
import {buildEuler, buildVector3, objectEulerSubtractY, reverseEuler} from '../util/threeUtils';
import {GToveThunk} from '../util/types';
import {isDefined} from '../util/typescriptUtils';
import {SnapMiniIdToTabletopType, TabletopMiniWrapper} from './tabletopMiniWrapper';
import {RayCastIntersectMini, TabletopViewGestureContext} from './tabletopViewComponent';
import {useToast} from './toastProvider';

interface TabletopMiniLayerProps {
    snapToGrid: boolean;
    interestLevelY: number;
    gmView: boolean;
    labelSize: number;
}

export const TabletopMiniLayer: FunctionComponent<TabletopMiniLayerProps> = memo(({
                                                                                      snapToGrid,
                                                                                      interestLevelY,
                                                                                      gmView,
                                                                                      labelSize,
                                                                                  }) => {
    const {rootMiniIds, attachedMinisMap, polygonOffsetMap} = useSelector(rootMinisAndAttachedMinisMapSelector);
    const mapPathData = useMapPathData();
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const dispatch = useDispatch();
    const {raycastForFirstUserDataFields, raycaster} = useRaycast();
    const {size: {width}} = useThree();
    const store = useStore();
    const {adjustingMiniScale, undoGroupId, isLookingDown, topDown} = useSelector(getTabletopStateFromStore);
    const userIsGM = useUserIsGM();
    const toast = useToast();
    const {defaultGrid, labelColour, piecesRosterColumns} = useSelector(getTabletopFromStore);
    const {cameraPositionRef, cameraLookAtRef} = useCameraParameters();

    const {showMiniNames, nearColumns, simpleNearColumns} = useMemo(() => (
        getShowNearColumns(!gmView, piecesRosterColumns)
    ), [gmView, piecesRosterColumns]);

    // Create some functions which use data from the store, but don't change referentially when the store data changes.
    // TODO when tabletopViewComponent is functional, consider defining these there and passing them as props, instead
    //  of this component requiring props for defaultGrid and tabletop
    const getGridTypeOfMapId = useCallback((mapId?: string) => (
        !mapId ? defaultGrid
            : getGridTypeOfMap(getScenarioFromStore(store.getState()).maps[mapId], defaultGrid)
    ), [defaultGrid, store]);
    const snapMiniIdToTabletop = useCallback<SnapMiniIdToTabletopType>((miniId: string, absolute = false) => {
        const minis = getScenarioFromStore(store.getState()).minis;
        const mini = minis[miniId];
        const absolutePosition = getAbsoluteMiniPosition(miniId, minis);
        if (!mini || !absolutePosition) {
            return undefined;
        }
        const gridType = getGridTypeOfMapId(mini.onMapId);
        const snapped = snapMini(snapToGrid && !!mini.selectedBy, gridType, mini.scale, absolutePosition.positionObj,
            absolutePosition.elevation, absolutePosition.rotationObj, !adjustingMiniScale);
        if (!absolutePosition?.baseMiniPosition || absolute) {
            return snapped;
        }
        const position = buildVector3(snapped.positionObj)
            .sub(absolutePosition.baseMiniPosition.positionObj as Vector3)
            .applyEuler(buildEuler(reverseEuler(absolutePosition.baseMiniPosition.rotationObj)));
        return {
            positionObj: {...position},
            rotationObj: objectEulerSubtractY(snapped.rotationObj, absolutePosition.baseMiniPosition.rotationObj.y),
            scaleFactor: snapped.scaleFactor,
            elevation: snapped.elevation - absolutePosition.baseMiniPosition.elevation
        };
    }, [adjustingMiniScale, getGridTypeOfMapId, snapToGrid, store]);

    const isCameraTooOblique = useCallback(() => {
        // Is the camera is too oblique to safely pan minis?
        const cameraDistanceSq = cameraPositionRef.current.distanceToSquared(cameraLookAtRef.current);
        const deltaY = cameraPositionRef.current.y - cameraLookAtRef.current.y;
        return deltaY * deltaY / cameraDistanceSq < 0.04;
    }, [cameraLookAtRef, cameraPositionRef]);

    const getSelectedMiniIds = useCallback(() => {
        const minis = getScenarioFromStore(store.getState()).minis;
        return !myPeerId ? [] : Object.keys(minis).filter((miniId) => (minis[miniId].selectedBy === myPeerId));
    }, [myPeerId, store]);

    const finaliseAdjustedMinis = useCallback(() => {
        let actions: (AnyAction | GToveThunk<any>)[] = [];
        const allMiniIds = getSelectedMiniIds();
        const minis = getScenarioFromStore(store.getState()).minis;
        for (let miniId of allMiniIds) {
            const actionLength = actions.length;
            const snapped = snapMiniIdToTabletop(miniId);
            if (!snapped) {
                continue;
            }
            const mini = minis[miniId];
            const {positionObj, rotationObj, scaleFactor, elevation} = snapped;
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
        if (actions.length) {
            if (undoGroupId) {
                actions = undoGroupActionList(actions, undoGroupId);
            } else {
                actions.push(separateUndoGroupAction() as any);
            }
            actions.push(
                clearTabletopStateUndoGroupIdAction(),
                setTabletopStateAdjustingMiniScaleAction(false)
            );
            for (const action of actions) {
                dispatch(action);
            }
        }
    }, [dispatch, getSelectedMiniIds, snapMiniIdToTabletop, store, undoGroupId]);

    // Gesture handling
    const intersectMiniIdRef = useRef<string | undefined>();
    const dragYRef = useRef(0);
    const initialOffsetRef = useRef(new Vector3());
    const planeRef = useRef(new Plane());
    const planeIntersectRef = useRef(new Vector3());
    const match = useCallback((context: TabletopViewGestureContext) => {
        const selectedMiniIds = getSelectedMiniIds();
        const minis = getScenarioFromStore(store.getState()).minis;
        return !context.readOnly && isDefined(myPeerId) && (
            (context.intersect?.type === 'miniId' && minis[context.intersect.miniId].selectedBy && (minis[context.intersect.miniId].selectedBy === myPeerId || userIsGM))
            || (context.intersect?.type === 'miniId' && !selectedMiniIds.length)
            || (!context.intersect && selectedMiniIds.length > 0)
        )
    }, [getSelectedMiniIds, myPeerId, store, userIsGM]);
    const onMatch = useCallback((context: TabletopViewGestureContext<RayCastIntersectMini | undefined>) => {
        if (context.intersect) {
            dragYRef.current = context.intersect.point.y;
            const minis = getScenarioFromStore(store.getState()).minis;
            const miniId = (minis[context.intersect.miniId].selectedBy === myPeerId) ? context.intersect.miniId
                // For a new selection, actually operate on the root attached mini.
                : getRootAttachedMiniId(context.intersect.miniId, minis);
            intersectMiniIdRef.current = miniId;
            const undoGroupId = v4();
            dispatch(startTabletopStateUndoGroupIdAction(undoGroupId));
            dispatch(undoGroupThunk(updateMiniSelectedByAction(miniId, myPeerId), undoGroupId));
            const snappedMini = snapMiniIdToTabletop(miniId, true);
            if (snappedMini) {
                initialOffsetRef.current.copy(snappedMini.positionObj as Vector3).sub(context.intersect.point);
            } else {
                initialOffsetRef.current.set(0, 0, 0);
            }
        }
    }, [dispatch, myPeerId, snapMiniIdToTabletop, store]);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2) => {
        const selectedMiniId = intersectMiniIdRef.current;
        if (!selectedMiniId) {
            return;
        }
        if (isCameraTooOblique()) {
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
        const onMapId = getMapIdAtPoint(point, scenario.maps, mini.visibility === PieceVisibilityEnum.HIDDEN);
        if (mini.attachMiniId) {
            // Need to reorient the drag position to be relative to the attachMiniId
            const attachedSnapped = snapMiniIdToTabletop(mini.attachMiniId, true);
            if (attachedSnapped) {
                const {positionObj, rotationObj} = attachedSnapped;
                point.sub(positionObj as Vector3).applyEuler(reverseEuler(rotationObj));
            }
        }
        let actions = [];
        actions.push(updateMiniPositionAction(selectedMiniId, point, myPeerId, onMapId));
        const selectedMiniIds = getSelectedMiniIds();
        if (selectedMiniIds.length > 1) {
            // Also update the position of the other minis
            point.sub(mini.position as Vector3);
            for (let otherMiniId of selectedMiniIds) {
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
    }, [dispatch, getSelectedMiniIds, isCameraTooOblique, myPeerId, raycastForFirstUserDataFields, raycaster.ray, snapMiniIdToTabletop, store, toast, undoGroupId]);
    const onRotate = useCallback((delta: ObjectVector2, currentPos: ObjectVector2, startPos: ObjectVector2) => {
        const selectedMiniId = intersectMiniIdRef.current;
        if (!selectedMiniId) {
            return;
        }
        const quadrant14 = (currentPos.x - startPos.x > currentPos.y - startPos.y);
        const quadrant12 = (currentPos.x - startPos.x > startPos.y - currentPos.y);
        const amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
        // dragging across whole screen goes 360 degrees around
        const rotation = new Euler(0, 2 * Math.PI * amount / width, 0);
        const scenario = getScenarioFromStore(store.getState());
        const centre = buildVector3(scenario.minis[selectedMiniId].position);
        let actions = [];
        const selectedMiniIds = getSelectedMiniIds();
        for (let miniId of selectedMiniIds) {
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
    }, [dispatch, getSelectedMiniIds, myPeerId, store, undoGroupId, width]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        const selectedMiniId = intersectMiniIdRef.current;
        if (!selectedMiniId) {
            return;
        }
        const scenario = getScenarioFromStore(store.getState());
        if (adjustingMiniScale) {
            const {scale} = scenario.minis[selectedMiniId];
            // The smaller the mini's scale, the more fine-grained the adjustments
            const deltaScale = delta.y / Math.max(20, 20 / scale);
            dispatch(updateMiniScaleAction(selectedMiniId, Math.max(0.0625, scale - deltaScale), myPeerId));
        } else {
            const deltaY = -delta.y / 20;
            let actions = [];
            const selectedMiniIds = getSelectedMiniIds();
            for (let miniId of selectedMiniIds) {
                const mini = scenario.minis[miniId];
                const snapMini = !mini.attachMiniId ? undefined : snapMiniIdToTabletop(mini.attachMiniId);
                const lowerLimit = (snapMini) ? -snapMini.elevation : 0;
                actions.push(updateMiniElevationAction(miniId, Math.max(lowerLimit, mini.elevation + deltaY), myPeerId));
            }
            actions = undoGroupActionList(actions, undoGroupId);
            for (const action of actions) {
                dispatch(action);
            }
        }
    }, [adjustingMiniScale, dispatch, getSelectedMiniIds, myPeerId, snapMiniIdToTabletop, store, undoGroupId]);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'miniLayerGestureHandler',
        priority: 5,
        match,
        onMatch,
        onNoMatch: finaliseAdjustedMinis,
        onPan,
        onRotate,
        onZoom,
        onGestureEnd: finaliseAdjustedMinis
    }), [finaliseAdjustedMinis, match, onMatch, onPan, onRotate, onZoom]);
    useGestureHandler(gestureHandler);

    return (
        <>
            {
                rootMiniIds.map((miniId) => (
                    <TabletopMiniWrapper key={miniId} miniId={miniId} polygonOffsetMap={polygonOffsetMap}
                                         snapMiniIdToTabletop={snapMiniIdToTabletop} attachedMinisMap={attachedMinisMap}
                                         interestLevelY={interestLevelY} cameraLookingDown={isLookingDown}
                                         topDown={topDown} gmView={gmView} showMiniNames={showMiniNames}
                                         nearColumns={nearColumns} simpleNearColumns={simpleNearColumns}
                                         labelSize={labelSize} labelColour={labelColour}
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

function getShowNearColumns(playerView: boolean, columns: PiecesRosterColumn[]): {showMiniNames: boolean, nearColumns: PiecesRosterColumn[], simpleNearColumns: PiecesRosterColumn[]} {
    const nameColumn = columns.find(isNameColumn);
    const nearColumns = columns.filter((column) => {
        return (!playerView || !column.gmOnly) && column.showNear;
    });
    return {showMiniNames: !nameColumn || !!nameColumn.showNear, nearColumns, simpleNearColumns: nameColumn ? [nameColumn] : []};
}
