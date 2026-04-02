import {useThree} from '@react-three/fiber';
import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import isEqual from 'lodash/isEqual';
import {FunctionComponent, memo, useCallback, useContext, useMemo, useRef} from 'react';
import {shallowEqual, useDispatch, useSelector, useStore} from 'react-redux';
import {AnyAction} from 'redux';
import {Euler, Plane, Quaternion, Vector3} from 'three';
import {v4} from 'uuid';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useCameraParameters} from '../context/cameraParametersProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {useMapPathData} from '../hooks/useMapPathData';
import {isRayCastIntersectMini, RayCastIntersectMini, useRaycast} from '../hooks/useRaycast';
import {useUserIsGM} from '../hooks/useUserIsGM';
import ColourPicker from '../presentation/colourPicker';
import InputField from '../presentation/inputField';
import Tooltip from '../presentation/tooltip';
import VisibilitySlider from '../presentation/visibilitySlider';
import {
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    addMiniAction,
    addMiniWaypointAction,
    cancelMiniMoveAction,
    cancelMiniWaypointAction,
    confirmMiniMoveAction,
    removeMiniAction,
    removeMiniWaypointAction,
    separateUndoGroupAction,
    undoGroupAction,
    undoGroupActionList,
    undoGroupThunk,
    updateAttachMinisAction,
    updateMiniBaseColourAction,
    updateMiniElevationAction,
    updateMiniFlatAction,
    updateMiniHideBaseAction,
    updateMiniLockedAction,
    updateMiniNameAction,
    updateMiniPositionAction,
    updateMiniProneAction,
    updateMiniRotationAction,
    updateMiniScaleAction,
    updateMiniSelectedByAction,
    updateMiniVisibilityAction
} from '../redux/scenarioReducer';
import {updateTabletopAction, updateTabletopVideoMutedAction} from '../redux/tabletopReducer';
import {
    clearTabletopStateUndoGroupIdAction,
    setTabletopStateAdjustingMiniScaleAction,
    setTabletopStateSelectedNoteMiniIdAction,
    startTabletopStateUndoGroupIdAction
} from '../redux/tabletopStateReducer';
import {MAP_DELTA, MINI_HEIGHT} from '../util/constants';
import {promiseSleep} from '../util/promiseSleep';
import {
    findPositionForNewMini,
    findUnusedMiniName,
    getAbsoluteMiniPosition,
    getGridTypeOfMap,
    getMapIdAtPoint,
    getPieceName,
    getRootAttachedMiniId,
    getVisibilityString,
    isNameColumn,
    MiniType,
    MovementPathPoint,
    ObjectVector2,
    PiecesRosterColumn,
    ScenarioType,
    selectConfirmMovesAndSnapToGridFromScenario,
    snapMini,
    snapMiniIdToTabletop,
    TabletopType
} from '../util/scenarioUtils';
import {PieceVisibilityEnum, TemplateProperties, TemplateShape} from '../util/storage/storageContract';
import {castTemplateProperties, isMiniMetadata, isTemplateMetadata} from '../util/storage/storageUtils';
import {joinAnd} from '../util/stringUtils';
import {TabletopTapMenuList, TapMenuOption} from '../util/tapMenuTypes';
import {buildEuler, buildVector3, objectEulerSubtractY, reverseEuler} from '../util/threeUtils';
import {GToveThunk} from '../util/types';
import {isDefined} from '../util/typescriptUtils';
import {SnapMiniIdToTabletopType, TabletopMiniWrapper} from './tabletopMiniWrapper';
import {useSetTapMenuSelection, useTapMenu} from './tabletopTapMenu';
import {TabletopViewComponentEditSelected, TabletopViewGestureContext} from './tabletopViewComponent';
import {useToast} from './toastProvider';

interface TabletopMiniLayerProps {
    interestLevelY: number;
    gmView: boolean;
    labelSize: number;
    setEditSelected: (editSelected?: TabletopViewComponentEditSelected) => void;
}

export const TabletopMiniLayer: FunctionComponent<TabletopMiniLayerProps> = memo(({
                                                                                      interestLevelY,
                                                                                      gmView,
                                                                                      labelSize,
                                                                                      setEditSelected,
                                                                                  }) => {
    const {snapToGrid} = useSelector(selectConfirmMovesAndSnapToGridFromScenario, shallowEqual);
    const {rootMiniIds, attachedMinisMap, polygonOffsetMap} = useSelector(rootMinisAndAttachedMinisMapSelector);
    const mapPathData = useMapPathData();
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const dispatch = useDispatch();
    const {raycastForFirstUserDataFields, raycaster} = useRaycast();
    const {size: {width}} = useThree();
    const store = useStore();
    const {adjustingMiniScale, undoGroupId, isLookingDown, topDown, selectedNoteMiniId} = useSelector(getTabletopStateFromStore);
    const userIsGM = useUserIsGM();
    const toast = useToast();
    const {defaultGrid, labelColour, piecesRosterColumns} = useSelector(getTabletopFromStore);
    const {cameraPositionRef, cameraLookAtRef} = useCameraParameters();
    const promiseModal = useContext(PromiseModalContextObject);
    const setTapMenuSelection = useSetTapMenuSelection();

    const {showMiniNames, nearColumns, simpleNearColumns} = useMemo(() => (
        getShowNearColumns(!gmView, piecesRosterColumns)
    ), [gmView, piecesRosterColumns]);

    // Create some functions which use data from the store, but don't change referentially when the store data changes.
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
        return !context.readOnly && !context.dragHandle && !context.dragMode && isDefined(myPeerId) && (
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

    const verifyMiniVisibility = useCallback(async (miniId: string, visibility: PieceVisibilityEnum) => {
        const scenario = getScenarioFromStore(store.getState());
        const mini = scenario.minis[miniId];
        // A piece can only attach to pieces with the same or higher visibility.
        const problemMinisIds = [];
        for (let attachMiniId = mini.attachMiniId; attachMiniId; attachMiniId = attachMiniId && scenario.minis[attachMiniId].attachMiniId) {
            const attachMini = scenario.minis[attachMiniId];
            if (attachMini.visibility < visibility) {
                problemMinisIds.push(attachMiniId);
            } else {
                attachMiniId = undefined;
            }
        }
        addAttachedMinisWithHigherVisibility(scenario.minis, miniId, visibility, problemMinisIds);
        if (problemMinisIds.length > 0 && promiseModal?.isAvailable()) {
            const fixProblems = 'Change the visibility of all affected pieces';
            const visibilityString = getVisibilityString(visibility);
            const response = await promiseModal({
                children: (
                    <div>
                        <p>
                            A piece can only attach to pieces with the same or higher visibility.  Changing the
                            visibility of {mini.name} to {visibilityString} will thus cause problems for the
                            following {problemMinisIds.length === 1 ? 'piece' : 'pieces'}:
                            {joinAnd(problemMinisIds.map((miniId) => ('"' + scenario.minis[miniId].name + '"')))}
                        </p>
                        <p>
                            You can change {problemMinisIds.length === 1 ? 'that piece' : 'all those pieces'} as well
                            as {mini.name} to the new visibility level, or cancel your change.
                        </p>
                    </div>
                ),
                options: [fixProblems, 'Cancel change']
            });
            if (response === fixProblems) {
                for (let otherMiniId of problemMinisIds) {
                    dispatch(updateMiniVisibilityAction(otherMiniId, visibility));
                }
                return true;
            }
            return false;
        }
        return true;
    }, [dispatch, promiseModal, store]);
    
    const buildAttachMiniOption = useCallback((attachMiniId: string, baseMiniId: string, baseMini: MiniType, scenario: ScenarioType, tabletop: TabletopType): TapMenuOption => {
        const attachMini = scenario.minis[attachMiniId];
        const attachMiniName = getPieceName(attachMiniId, scenario.minis, tabletop.piecesRosterColumns);
        return attachMini.visibility < baseMini!.visibility ? {
            label: `(${attachMiniName} is less visible)`,
            title: 'You cannot attach a piece to something which is less visible.',
            onClick: () => {
                toast('You cannot attach a piece to something which is less visible.');
            },
            keepOpenOnClick: true
        } : {
            label: `Attach to ${attachMiniName}`,
            title: `Attach this piece to ${attachMiniName}`,
            onClick: () => {
                const snapMini = snapMiniIdToTabletop(baseMiniId, true);
                if (!snapMini) {
                    // Mini may have been deleted mid-action
                    toast(`Unable to determine the position of ${baseMini.name}?  Action failed.`);
                    return;
                }
                let {positionObj, rotationObj, elevation} = snapMini;
                // Need to make position and rotation relative to the attachMiniId
                const attachSnapMini = snapMiniIdToTabletop(attachMiniId, true);
                if (!attachSnapMini) {
                    toast(`Unable to determine the position of ${attachMiniName}?  Action failed.`);
                    // Mini may have been deleted mid-action
                    return;
                }
                const {positionObj: attachPosition, rotationObj: attachRotation, elevation: otherElevation} = attachSnapMini;
                positionObj = buildVector3(positionObj).sub(attachPosition as Vector3).applyEuler(new Euler(-attachRotation.x, -attachRotation.y, -attachRotation.z, attachRotation.order));
                rotationObj = {x: rotationObj.x - attachRotation.x, y: rotationObj.y - attachRotation.y, z: rotationObj.z - attachRotation.z, order: rotationObj.order};
                dispatch(updateAttachMinisAction(baseMiniId, attachMiniId, positionObj, rotationObj, elevation - otherElevation));
            },
            autoExecuteSingleOption: true
        };
    }, [dispatch, snapMiniIdToTabletop, toast])
    
    const tapMenuOptions = useMemo<TabletopTapMenuList<RayCastIntersectMini>>(() => ({
        id: 'mini tap options',
        intersect: {
            match: isRayCastIntersectMini,
            options: [
                {
                    render: ({intersect, mini}) => {
                        return (
                            <Tooltip tooltip='Visibility to players: Fog means hidden by Fog of War on a map.' verticalSpace={40}>
                                <label>
                                    <VisibilitySlider visibility={mini.visibility} onChange={async (value) => {
                                        if (await verifyMiniVisibility(intersect.miniId, value)) {
                                            dispatch(updateMiniVisibilityAction(intersect.miniId, value));
                                        }
                                    }}/>
                                </label>
                            </Tooltip>
                        );
                    },
                    show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
                },
                {
                    label: 'Add GM note',
                    title: 'Add a rich text GM note to this piece',
                    onClick: ({intersect}) => {
                        dispatch(setTabletopStateSelectedNoteMiniIdAction(intersect.miniId));
                    },
                    show: ({userIsGM, mini}) => (userIsGM && !mini.gmNoteMarkdown)
                },
                {
                    label: 'Open GM note',
                    title: 'Show the GM note associated with this piece (closing any other GM notes)',
                    onClick: ({intersect}) => {
                        dispatch(setTabletopStateSelectedNoteMiniIdAction(intersect.miniId));
                    },
                    show: ({intersect, userIsGM, mini}) => (
                        userIsGM && !!mini.gmNoteMarkdown && selectedNoteMiniId !== intersect.miniId
                    )
                },
                {
                    label: 'Close GM note',
                    title: 'Close the GM note associated with this piece',
                    onClick: () => {
                        dispatch(setTabletopStateSelectedNoteMiniIdAction(null));
                    },
                    show: ({intersect, userIsGM}) => (
                        userIsGM && selectedNoteMiniId === intersect.miniId
                    )
                },
                {
                    label: 'Confirm move',
                    title: 'Reset the piece\'s starting position to its current location',
                    onClick: ({intersect, scenario}) => {
                        dispatch(confirmMiniMoveAction(getMovedMiniId(intersect.miniId, scenario.minis)!));
                    },
                    show: ({intersect, scenario}) => (!!getMovedMiniId(intersect.miniId, scenario.minis))
                },
                {
                    label: 'Make waypoint',
                    title: 'Make the current position a waypoint on the path',
                    onClick: ({intersect, scenario}) => {
                        dispatch(addMiniWaypointAction(getMovedMiniId(intersect.miniId, scenario.minis)!));
                    },
                    show: ({intersect, scenario}) => (!!getMovedMiniId(intersect.miniId, scenario.minis))
                },
                {
                    label: 'Remove waypoint',
                    title: 'Remove the last waypoint added to the path',
                    onClick: ({intersect, scenario}) => {
                        dispatch(removeMiniWaypointAction(getMovedMiniId(intersect.miniId, scenario.minis)!));
                    },
                    show: ({mini}) => (!!mini.movementPath && mini.movementPath.length > 1)
                },
                {
                    label: 'Cancel move',
                    title: 'Reset the piece\'s position back to where it started',
                    onClick: ({intersect, scenario}) => {
                        dispatch(cancelMiniMoveAction(getMovedMiniId(intersect.miniId, scenario.minis)!));
                    },
                    show: ({intersect, scenario}) => (!!getMovedMiniId(intersect.miniId, scenario.minis))
                },
                {
                    label: 'Cancel waypoint',
                    title: 'Reset the piece\'s position back to the last waypoint, and remove the waypoint',
                    onClick: ({intersect, scenario}) => {
                        dispatch(cancelMiniWaypointAction(getMovedMiniId(intersect.miniId, scenario.minis)!));
                    },
                    show: ({mini}) => (!!mini.movementPath && mini.movementPath.length > 1)
                },
                {
                    label: 'Attach...',
                    title: 'Attach this piece to another.',
                    onClick: ({intersect, scenario, tabletop, mini}) => {
                        const attachIds = getOverlappingDetachedMinis(intersect.miniId, scenario, tabletop);
                        setTapMenuSelection({
                            label: 'Attach to which piece?',
                            position: intersect.position,
                            options: attachIds.map((miniId) => (buildAttachMiniOption(miniId, intersect.miniId, mini, scenario, tabletop)))
                        });
                    },
                    show: ({intersect, mini, scenario, tabletop}) => (
                        !mini.attachMiniId && getOverlappingDetachedMinis(intersect.miniId, scenario, tabletop).length > 0
                    ),
                    keepOpenOnClick: true,
                    autoExecuteSingleOption: true
                },
                {
                    label: 'Detach',
                    title: 'Detach this piece from the piece it is attached to.',
                    onClick: ({intersect}) => {
                        const snapMini = snapMiniIdToTabletop(intersect.miniId, true);
                        if (!snapMini) {
                            // Mini may have been deleted mid-action
                            return;
                        }
                        const {positionObj, rotationObj, elevation} = snapMini;
                        dispatch(updateAttachMinisAction(intersect.miniId, undefined, positionObj, rotationObj, elevation));
                    },
                    show: ({mini}) => (mini.attachMiniId !== undefined)
                },
                {
                    label: 'Move attachment point',
                    title: 'Move this piece relative to the piece it is attached to.',
                    onClick: ({intersect}) => {
                        if (intersect.miniId) {
                            dispatch(updateMiniSelectedByAction(intersect.miniId, myPeerId));
                        }
                    },
                    show: ({mini}) => (mini.attachMiniId !== undefined)
                },
                {
                    label: 'Lie down',
                    title: 'Tip this piece over so it\'s lying down.',
                    onClick: ({intersect}) => {dispatch(updateMiniProneAction(intersect.miniId, true))},
                    show: ({mini}) => (isMiniMetadata(mini.metadata) && !mini.prone)
                },
                {
                    label: 'Stand up',
                    title: 'Stand this piece up.',
                    onClick: ({intersect}) => {dispatch(updateMiniProneAction(intersect.miniId, false))},
                    show: ({mini}) => (isMiniMetadata(mini.metadata) && mini.prone)
                },
                {
                    label: 'Make flat',
                    title: 'Make this piece always render as a flat counter.',
                    onClick: ({intersect}) => {dispatch(updateMiniFlatAction(intersect.miniId, true))},
                    show: ({mini}) => (isMiniMetadata(mini.metadata) && !mini.flat)
                },
                {
                    label: 'Make standee',
                    title: 'Make this piece render as a standee when not viewed from above.',
                    onClick: ({intersect}) => {dispatch(updateMiniFlatAction(intersect.miniId, false))},
                    show: ({mini}) => (isMiniMetadata(mini.metadata) && mini.flat)
                },
                {
                    label: 'Mute Video',
                    title: 'Mute the audio track of this video texture',
                    onClick: ({mini}) => {
                        dispatch(updateTabletopVideoMutedAction(mini.metadata.id, true));
                    },
                    show: ({userIsGM, mini, tabletop}) => (
                        userIsGM && tabletop.videoMuted[mini.metadata.id] === false
                    )
                },
                {
                    label: 'Unmute Video',
                    title: 'Unmute the audio track of this video texture',
                    onClick: ({mini}) => {
                        dispatch(updateTabletopVideoMutedAction(mini.metadata.id, false));
                    },
                    show: ({userIsGM, mini, tabletop}) => (
                        userIsGM && tabletop.videoMuted[mini.metadata.id] === true
                    )
                },
                {
                    label: 'Lock position',
                    title: 'Prevent movement of this piece until unlocked again.',
                    onClick: ({intersect}) => {dispatch(updateMiniLockedAction(intersect.miniId, true))},
                    show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !mini.attachMiniId && !mini.locked)
                },
                {
                    label: 'Unlock position',
                    title: 'Allow movement of this piece again.',
                    onClick: ({intersect}) => {dispatch(updateMiniLockedAction(intersect.miniId, false))},
                    show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !mini.attachMiniId && mini.locked)
                },
                {
                    label: 'Make ungrabbable',
                    title: 'Prevent this attached piece from registering gestures and mouse movement.',
                    onClick: ({intersect}) => {dispatch(updateMiniLockedAction(intersect.miniId, true))},
                    show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !!mini.attachMiniId && !mini.locked)
                },
                {
                    label: 'Make grabbable',
                    title: 'Allow this attached piece to register gestures and mouse movement again.',
                    onClick: ({intersect}) => {dispatch(updateMiniLockedAction(intersect.miniId, false))},
                    show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && !!mini.attachMiniId && mini.locked)
                },
                {
                    label: 'Hide base',
                    title: 'Hide the base of the standee piece.',
                    onClick: ({intersect}) => {dispatch(updateMiniHideBaseAction(intersect.miniId, true))},
                    show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && isMiniMetadata(mini.metadata) && !mini.hideBase)
                },
                {
                    label: 'Show base',
                    title: 'Show the base of the standee piece.',
                    onClick: ({intersect}) => {dispatch(updateMiniHideBaseAction(intersect.miniId, false))},
                    show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && isMiniMetadata(mini.metadata) && mini.hideBase)
                },
                {
                    label: 'Color base',
                    title: 'Change the standee piece\'s base color.',
                    onClick: async ({mini, tabletop, intersect}) => {
                        if (promiseModal?.isAvailable()) {
                            setTapMenuSelection();
                            const okOption = 'OK';
                            let baseColour = mini.baseColour || 0;
                            let swatches: string[] | undefined = undefined;
                            const result = await promiseModal({
                                children: (
                                    <div>
                                        <p>Set base color for {mini.name}.</p>
                                        <ColourPicker
                                            disableAlpha={true}
                                            initialColour={baseColour}
                                            onColourChange={(colourObj) => {
                                                baseColour = (colourObj.rgb.r << 16) + (colourObj.rgb.g << 8) + colourObj.rgb.b;
                                            }}
                                            initialSwatches={tabletop.baseColourSwatches}
                                            onSwatchChange={(newSwatches: string[]) => {
                                                swatches = newSwatches;
                                            }}
                                        />
                                    </div>
                                ),
                                options: [okOption, 'Cancel']
                            });
                            if (result === okOption) {
                                dispatch(updateMiniBaseColourAction(intersect.miniId, baseColour));
                                if (swatches) {
                                    dispatch(updateTabletopAction({baseColourSwatches: swatches}));
                                }
                            }
                        }
                    },
                    show: ({userIsGM, mini}) => ((userIsGM || userOwnsMini(mini)) && isMiniMetadata(mini.metadata) && !mini.hideBase)
                },
                {
                    label: 'Rename',
                    title: 'Change the label shown for this piece.',
                    onClick: ({intersect, mini}) => {
                        setTapMenuSelection();
                        setEditSelected({
                            selected: intersect,
                            value: mini.name,
                            finish: (value: string) => {
                                dispatch(updateMiniNameAction(intersect.miniId, value));
                            }
                        });
                    },
                    show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
                },
                {
                    label: 'Scale',
                    title: 'Adjust this piece\'s scale',
                    onClick: ({intersect}) => {
                        if (intersect.miniId) {
                            dispatch(updateMiniSelectedByAction(intersect.miniId, myPeerId));
                            dispatch(setTabletopStateAdjustingMiniScaleAction(true));
                        }
                        toast('Zoom in or out to change mini scale.');
                    },
                    show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
                },
                {
                    label: 'Duplicate...',
                    title: 'Add duplicates of this piece to the tabletop.',
                    onClick: async ({intersect, mini, scenario, tabletop}) => {
                        if (promiseModal?.isAvailable()) {
                            setTapMenuSelection();
                            const okOption = 'OK';
                            let duplicateNumber: number = 1;
                            const result = await promiseModal({
                                children: (
                                    <div className='duplicateMiniDialog'>
                                        Duplicate this miniature
                                        <InputField type='number' select={true} initialValue={duplicateNumber} onChange={(value: number) => {
                                            duplicateNumber = value;
                                        }}/> time(s).
                                    </div>
                                ),
                                options: [okOption, 'Cancel']
                            });
                            if (result === okOption) {
                                const match = mini.name.match(/^(.*?)( *[0-9]*)$/);
                                if (match) {
                                    const baseName = match[1];
                                    let name: string, suffix: number;
                                    let space = true;
                                    if (match[2]) {
                                        suffix = Number(match[2]) + 1;
                                        space = (match[2][0] === ' ');
                                    } else {
                                        // Update base mini name too, since it didn't have a numeric suffix.
                                        [name, suffix] = findUnusedMiniName(scenario, baseName);
                                        dispatch(updateMiniNameAction(intersect.miniId, name));
                                    }
                                    const confirmMoves = scenario.confirmMoves;
                                    const undoGroupId = v4();
                                    for (let count = 0; count < duplicateNumber; ++count) {
                                        [name, suffix] = findUnusedMiniName(scenario, baseName, suffix, space);
                                        let position: MovementPathPoint = findPositionForNewMini(scenario, tabletop, mini.visibility === PieceVisibilityEnum.HIDDEN, mini.position, mini.scale);
                                        if (mini.elevation) {
                                            position = {...position, elevation: mini.elevation};
                                        }
                                        dispatch(undoGroupAction(addMiniAction({
                                            ...mini,
                                            name,
                                            position,
                                            movementPath: confirmMoves ? [position] : undefined
                                        }), undoGroupId));
                                        // TODO I believe this will be unnecessary when all parent components are functional.
                                        await promiseSleep(0);
                                    }
                                }
                            }
                        }
                    },
                    show: ({userIsGM}) => (userIsGM)
                },
                {
                    label: 'Remove',
                    title: 'Remove this piece from the tabletop',
                    onClick: ({intersect}) => {dispatch(removeMiniAction(intersect.miniId))},
                    show: ({userIsGM, mini}) => (userIsGM || userOwnsMini(mini))
                }
            ]
        },
    }), [buildAttachMiniOption, dispatch, myPeerId, promiseModal, selectedNoteMiniId, setEditSelected, setTapMenuSelection, snapMiniIdToTabletop, toast, verifyMiniVisibility]);
    useTapMenu(tapMenuOptions);

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


/**
 * If this mini or any mini it is attached to has moved, return the miniId of the moved mini closest to this one.
 */
function getMovedMiniId(miniId: string, minis: {[miniId: string]: MiniType}): string | undefined | null {
    const mini = minis[miniId];
    return (!mini?.movementPath ? undefined :
            (mini.movementPath.length > 1) ? miniId :
                (mini.movementPath[0].x !== mini.position.x
                    || mini.movementPath[0].y !== mini.position.y
                    || mini.movementPath[0].z !== mini.position.z
                    || (mini.movementPath[0].elevation || 0) !== mini.elevation)
                    ? miniId : undefined)
        || (mini.attachMiniId && getMovedMiniId(mini.attachMiniId, minis));
}

function isMiniAttachedTo(miniId: string, targetMiniId: string, scenario: ScenarioType): boolean {
    if (miniId === targetMiniId) {
        return true;
    } else {
        const mini = scenario.minis[miniId];
        return (mini.attachMiniId) ? isMiniAttachedTo(mini.attachMiniId, targetMiniId, scenario) : false;
    }
}

function doesMiniOverlapTemplate(miniId: string, templateId: string, scenario: ScenarioType, tabletop: TabletopType): boolean {
    const snappedMini = snapMiniIdToTabletop(miniId, scenario, tabletop);
    const snappedTemplate = snapMiniIdToTabletop(templateId, scenario, tabletop);
    if (!snappedMini || !snappedTemplate) {
        return false;
    }
    const {positionObj: miniPosition, scaleFactor: miniScale, elevation} = snappedMini;
    const {positionObj: templatePosition, elevation: templateElevation, rotationObj: templateRotation, scaleFactor: templateScale} = snappedTemplate;
    const template: MiniType = scenario.minis[templateId] as MiniType;
    const templateProperties: TemplateProperties =
        castTemplateProperties(template.metadata.properties as TemplateProperties);
    const dy = templatePosition.y - miniPosition.y + templateElevation;
    const miniRadius = miniScale / 2;
    const templateWidth = templateProperties.width * templateScale;
    const templateHeight = templateProperties.height * templateScale;
    if (dy < -templateHeight / 2 - 0.5 || dy > templateHeight / 2 + MINI_HEIGHT * miniScale + elevation + 0.5) {
        return false;
    }
    const adjustedPos = new Vector3(templatePosition.x - miniPosition.x, 0, templatePosition.z - miniPosition.z)
        .applyQuaternion(new Quaternion().setFromEuler(buildEuler(templateRotation)).invert())
        .add({x: templateProperties.offsetX, y: templateProperties.offsetY, z: templateProperties.offsetZ} as Vector3);
    switch (templateProperties.templateShape) {
        case TemplateShape.RECTANGLE:
            return (Math.abs(adjustedPos.x) < miniRadius + templateWidth / 2) && (Math.abs(adjustedPos.z) < miniRadius + (templateProperties.depth * templateScale) / 2);
        case TemplateShape.CIRCLE:
        case TemplateShape.ICON:
            return adjustedPos.x*adjustedPos.x + adjustedPos.z*adjustedPos.z < (miniRadius + templateWidth) * (miniRadius + templateWidth);
        case TemplateShape.ARC:
            if (adjustedPos.x*adjustedPos.x + adjustedPos.z*adjustedPos.z >= (miniRadius + templateWidth) * (miniRadius + templateWidth)) {
                return false;
            }
            const angle = Math.PI * (templateProperties.angle!) / 360;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const pointGreaterLine1 = -sin * adjustedPos.x + cos * adjustedPos.z + miniRadius > 0;
            const pointGreaterLine2 = sin * adjustedPos.x + cos * adjustedPos.z - miniRadius < 0;
            return ((templateProperties.angle!) < 180) ? pointGreaterLine1 && pointGreaterLine2 : pointGreaterLine1 || pointGreaterLine2;
    }
}

function doMinisOverlap(mini1Id: string, mini2Id: string, scenario: ScenarioType, tabletop: TabletopType): boolean {
    const mini1 = scenario.minis[mini1Id];
    const mini2 = scenario.minis[mini2Id];
    const mini1Template = isTemplateMetadata(mini1.metadata);
    const mini2Template = isTemplateMetadata(mini2.metadata);
    if (!mini1Template && !mini2Template) {
        const snapMini1 = snapMiniIdToTabletop(mini1Id, scenario, tabletop);
        const snapMini2 = snapMiniIdToTabletop(mini2Id, scenario, tabletop);
        if (!snapMini1 || !snapMini2) {
            return false;
        }
        const {positionObj: position1, scaleFactor: scale1} = snapMini1;
        const {positionObj: position2, scaleFactor: scale2} = snapMini2;
        const dx = position2.x - position1.x,
            dy = position2.y - position1.y,
            dz = position2.z - position1.z,
            r1 = scale1 / 2, r2 = scale2 / 2;
        return Math.abs(dy) < MAP_DELTA && (dx*dx + dz*dz < (r1 + r2) * (r1 + r2));
    } else if (mini1Template && mini2Template) {
        return false; // TODO
    } else if (mini1Template) {
        return doesMiniOverlapTemplate(mini2Id, mini1Id, scenario, tabletop);
    } else {
        return doesMiniOverlapTemplate(mini1Id, mini2Id, scenario, tabletop);
    }
}

function getOverlappingDetachedMinis(miniId: string, scenario: ScenarioType, tabletop: TabletopType): string[] {
    return Object.keys(scenario.minis).filter((otherMiniId) => {
        // Ensure we don't create attachment loops.
        if (isMiniAttachedTo(otherMiniId, miniId, scenario)) {
            return false;
        } else {
            return doMinisOverlap(miniId, otherMiniId, scenario, tabletop);
        }
    });
}

function userOwnsMini(mini?: MiniType): boolean {
    return (mini?.metadata.owners?.some((owner) => (owner.me))) ?? false;
}

function addAttachedMinisWithHigherVisibility(minis: {[miniId: string]: MiniType}, miniId: string, visibility: PieceVisibilityEnum, miniIds: string[]) {
    for (let otherMiniId of Object.keys(minis)) {
        const otherMini = minis[otherMiniId];
        if (otherMini.attachMiniId === miniId && otherMini.visibility > visibility) {
            miniIds.push(otherMiniId);
            addAttachedMinisWithHigherVisibility(minis, otherMiniId, visibility, miniIds);
        }
    }
}