import {FunctionComponent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import {Vector2, Vector3} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useConfirmLargeFogOfWarAction} from '../hooks/useConfirmLargeFogOfWarAction';
import {useEdgeAutoPan} from '../hooks/useEdgeAutoPan';
import {useRaycast} from '../hooks/useRaycast';
import {getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {undoGroupThunk, updateMapFogOfWarAction} from '../redux/scenarioReducer';
import {toggleTabletopStateDragModeAction} from '../redux/tabletopStateReducer';
import {getMapGridRoundedVectors, getUpdatedMapFogRect, isFogOfWarAtPoint, ObjectVector2} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {TabletopTapMenuList} from '../util/tapMenuTypes';
import {buildEuler, buildVector2, buildVector3} from '../util/threeUtils';
import FogOfWarRectComponent from './fogOfWarRectComponent';
import {useSetTapMenuSelection, useTapMenu} from './tabletopTapMenu';
import {TabletopViewGestureContext} from './tabletopViewComponent';
import {useToast} from './toastProvider';

const FOG_RECT_HEIGHT_ADJUST = 0.02;

export interface FogOfWarRectState {
    mapId: string;
    startPos: Vector3;
    endPos: Vector3;
    colour: string;
    position: Vector2;
}

const TabletopFogOfWar: FunctionComponent = () => {
    const {raycastForFirstUserDataFields, raycastToPlane} = useRaycast();
    const toast = useToast();
    const setTapMenuSelection = useSetTapMenuSelection();
    const confirmLargeFogOfWarAction = useConfirmLargeFogOfWarAction();
    
    const [fogOfWarRect, setFogOfWarRect] = useState<FogOfWarRectState | undefined>();
    const selectSpecificMap = useCallback((state: ReduxStoreType) => (
        !fogOfWarRect?.mapId ? undefined : getScenarioFromStore(state).maps[fogOfWarRect.mapId]
    ), [fogOfWarRect?.mapId]);
    const map = useSelector(selectSpecificMap);
    const {rotation, position, startPos, endPos} = useMemo(() => {
        if (!map || !fogOfWarRect) {
            return {};
        }
        const rotation = buildEuler(map.rotation);
        const {startPos, endPos} = getMapGridRoundedVectors(map, rotation, fogOfWarRect.startPos, fogOfWarRect.endPos);
        return {
            rotation,
            position: buildVector3(map.position),
            startPos,
            endPos,
        }
    }, [fogOfWarRect, map]);
    const {dragMode} = useSelector(getTabletopStateFromStore);
    const store = useStore();
    const dispatch = useDispatch();

    const setAutoPanPosition = useEdgeAutoPan(fogOfWarRect !== undefined);

    useEffect(() => {
        if (dragMode !== 'fogOfWarMode') {
            setFogOfWarRect(undefined);
            return undefined;
        }
        return () => {
            setTapMenuSelection(undefined);
        }
    }, [dragMode, setTapMenuSelection]);
    const changeFogOfWarBitmask = useCallback((reveal: boolean | null, rect: FogOfWarRectState, undoGroupId?: string) => {
        const map = getScenarioFromStore(store.getState()).maps[rect.mapId];
        if (rect && map) {
            const fogOfWar = getUpdatedMapFogRect(map, rect.startPos, rect.endPos, reveal);
            dispatch(
                undoGroupId ? undoGroupThunk(updateMapFogOfWarAction(rect.mapId, fogOfWar), undoGroupId)
                    : updateMapFogOfWarAction(rect.mapId, fogOfWar)
            );
            setFogOfWarRect(undefined);
        }
    }, [dispatch, store]);
    const cancelFogOfWarRect = useCallback(() => {
        setFogOfWarRect(undefined);
    }, []);
    
    const match = useCallback((context: TabletopViewGestureContext) => (
        !context.readOnly && !context.dragHandle && context.dragMode === 'fogOfWarMode'
    ), []);
    const startedOnFogRef = useRef(false);
    const onGestureStart = useCallback((startPos: ObjectVector2) => {
        const selected = raycastForFirstUserDataFields(startPos, 'mapId');
        const map = selected?.mapId ? getScenarioFromStore(store.getState()).maps[selected.mapId] : undefined;
        if (map) {
            startedOnFogRef.current = isFogOfWarAtPoint(map, selected!.point);
        }
    }, [raycastForFirstUserDataFields, store]);
    const onTap = useCallback((position: ObjectVector2) => {
        const selected = raycastForFirstUserDataFields(position, 'mapId');
        const map = selected?.mapId ? getScenarioFromStore(store.getState()).maps[selected.mapId] : undefined;
        if (selected && map?.metadata.properties && map.metadata.properties.gridType !== GridType.NONE) {
            changeFogOfWarBitmask(null, {mapId: selected.mapId, startPos: selected.point,
                endPos: selected.point, position: buildVector2(position), colour: ''});
        }
    }, [changeFogOfWarBitmask, raycastForFirstUserDataFields, store]);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2, startPos: ObjectVector2) => {
        if (!fogOfWarRect) {
            const selected = raycastForFirstUserDataFields(startPos, 'mapId');
            if (selected?.mapId) {
                const map = getScenarioFromStore(store.getState()).maps[selected.mapId];
                if (map.metadata.properties!.gridType === GridType.NONE) {
                    toast('Map has no grid - Fog of War for it is disabled.');
                } else {
                    const offset = selected.point.clone();
                    offset.y += FOG_RECT_HEIGHT_ADJUST;
                    setFogOfWarRect({mapId: selected.mapId, startPos: offset, endPos: offset,
                        colour: map.metadata.properties!.gridColour || 'black',
                        position: new Vector2(position.x, position.y)});
                    setAutoPanPosition(position);
                }
            }
        } else {
            const map = getScenarioFromStore(store.getState()).maps[fogOfWarRect.mapId];
            const mapY = map?.position.y ?? 0;
            const intersect = raycastToPlane(position, mapY + FOG_RECT_HEIGHT_ADJUST);
            if (intersect) {
                setFogOfWarRect((prev) => ({
                    ...prev!, endPos: intersect.clone(), position: buildVector2(position)
                }));
                setAutoPanPosition(position);
            }
        }
    }, [fogOfWarRect, raycastForFirstUserDataFields, store, toast, setAutoPanPosition, raycastToPlane]);
    const onRotate = useCallback((_delta: ObjectVector2, currentPos: ObjectVector2) => {
        const selected = raycastForFirstUserDataFields(currentPos, 'mapId');
        if (selected) {
            changeFogOfWarBitmask(startedOnFogRef.current, {mapId: selected.mapId, startPos: selected.point,
                endPos: selected.point, position: buildVector2(currentPos), colour: ''}, 'fogOfWarPaint');
        }

    }, [changeFogOfWarBitmask, raycastForFirstUserDataFields]);
    const onGestureEnd = useCallback(() => {
        if (fogOfWarRect) {
            setTapMenuSelection({
                position: fogOfWarRect.position,
                options: [
                    {
                        label: 'Cover',
                        title: 'Cover the selected area with fog of war',
                        onClick: () => {
                            changeFogOfWarBitmask(false, fogOfWarRect);
                        }
                    },
                    {
                        label: 'Uncover',
                        title: 'Remove fog of war from the selected area',
                        onClick: () => {
                            changeFogOfWarBitmask(true, fogOfWarRect);
                        }
                    },
                    {
                        label: 'Cancel',
                        title: 'Cancel',
                        onClick: cancelFogOfWarRect
                    },
                ]
            });
        }
    }, [cancelFogOfWarRect, changeFogOfWarBitmask, fogOfWarRect, setTapMenuSelection]);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'fogOfWarGestureHandler',
        priority: 10,
        match,
        onGestureStart,
        onTap,
        onPan,
        onRotate,
        onGestureEnd
    }), [match, onGestureEnd, onGestureStart, onPan, onRotate, onTap]);
    useGestureHandler(gestureHandler);
    
    const tapMenuOptions = useMemo<TabletopTapMenuList>(() => ({
        id: 'tabletopFogOfWar',
        dragHandle: {
            'fogOfWarMode': {
                label: 'Use this handle to pan the camera while in Fog of War mode.',
                options: [
                    {
                        label: 'Cover all maps',
                        title: 'Cover all maps with Fog of War.',
                        onClick: async ({scenario}) => {
                            const mapIds = Object.keys(scenario.maps);
                            if (await confirmLargeFogOfWarAction(mapIds)) {
                                mapIds.forEach((mapId) => {
                                    dispatch(updateMapFogOfWarAction(mapId, []));
                                });
                            }
                        },
                        show: ({userIsGM}) => (userIsGM)
                    },
                    {
                        label: 'Uncover all maps',
                        title: 'Remove Fog of War from all maps.',
                        onClick: async ({scenario}) => {
                            const mapIds = Object.keys(scenario.maps);
                            if (await confirmLargeFogOfWarAction(mapIds)) {
                                mapIds.forEach((mapId) => {
                                    dispatch(updateMapFogOfWarAction(mapId));
                                });
                            }
                        },
                        show: ({userIsGM}) => (userIsGM)
                    },
                    {
                        label: 'Finish',
                        title: 'Exit Fog of War Mode',
                        onClick: () => {dispatch(toggleTabletopStateDragModeAction('fogOfWarMode'))},
                        show: ({userIsGM}) => (userIsGM)
                    }
                ]
            }
        }
    }), [confirmLargeFogOfWarAction, dispatch]);
    useTapMenu(tapMenuOptions);

    return (!fogOfWarRect || !map || dragMode !== 'fogOfWarMode' || !startPos || !endPos) ? null : (
        <group position={position} rotation={rotation}>
            <FogOfWarRectComponent gridType={map.metadata.properties!.gridType}
                                   cornerPos1={startPos} cornerPos2={endPos} colour={fogOfWarRect.colour}
            />
        </group>
    );
};

export default TabletopFogOfWar;