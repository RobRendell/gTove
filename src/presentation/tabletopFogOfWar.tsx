import {useThree} from '@react-three/fiber';
import {FunctionComponent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import {Vector2, Vector3} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useCameraParameters} from '../context/cameraParametersContextBridge';
import {useRaycast} from '../hooks/useRaycast';
import {getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {undoGroupThunk, updateMapFogOfWarAction} from '../redux/scenarioReducer';
import {getMapGridRoundedVectors, getUpdatedMapFogRect, isFogOfWarAtPoint, ObjectVector2} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {buildEuler, buildVector2, buildVector3} from '../util/threeUtils';
import FogOfWarRectComponent from './fogOfWarRectComponent';
import {TabletopViewComponentMenuSelected, TabletopViewGestureContext} from './tabletopViewComponent';
import {useToast} from './toastProvider';

const FOG_RECT_HEIGHT_ADJUST = 0.02;
const FOG_RECT_DRAG_BORDER = 30;

export interface FogOfWarRectState {
    mapId: string;
    startPos: Vector3;
    endPos: Vector3;
    colour: string;
    position: Vector2;
}

interface TabletopFogOfWarProps {
    setMenuSelected: (menuSelected?: TabletopViewComponentMenuSelected) => void;
}

const TabletopFogOfWar: FunctionComponent<TabletopFogOfWarProps> = ({setMenuSelected}) => {
    const {raycastForFirstUserDataFields, raycastToPlane} = useRaycast();
    const {size: {width, height}} = useThree();
    const toast = useToast();
    const {setCameraParameters} = useCameraParameters();
    
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

    const [autoPanInterval, setAutoPanInterval] = useState<number | undefined>();
    const deltaPositionRef = useRef(new Vector3());
    const autoPanForFogOfWarRect = useCallback(() => {
        if (!fogOfWarRect && autoPanInterval) {
            clearInterval(autoPanInterval);
            setAutoPanInterval(undefined);
        } else if (fogOfWarRect) {
            deltaPositionRef.current.set(0, 0, 0);
            const dragBorder = Math.min(FOG_RECT_DRAG_BORDER, width / 10, height / 10);
            const {position} = fogOfWarRect;
            if (position.x < dragBorder) {
                deltaPositionRef.current.x = dragBorder - position.x;
            } else if (position.x >= width - dragBorder) {
                deltaPositionRef.current.x = width - dragBorder - position.x;
            }
            if (position.y < dragBorder) {
                deltaPositionRef.current.z = dragBorder - position.y;
            } else if (position.y >= height - dragBorder) {
                deltaPositionRef.current.z = height - dragBorder - position.y;
            }
            if (deltaPositionRef.current.x || deltaPositionRef.current.z) {
                setCameraParameters({deltaPosition: deltaPositionRef.current}, 100);
            }
        }
    }, [autoPanInterval, fogOfWarRect, height, setCameraParameters, width]);

    useEffect(() => {
        if (dragMode !== 'fogOfWarMode') {
            setFogOfWarRect(undefined);
            return undefined;
        }
        return () => {
            setMenuSelected(undefined);
        }
    }, [dragMode, setMenuSelected]);
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
        !context.readOnly && dragMode === 'fogOfWarMode'
    ), [dragMode]);
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
                    setAutoPanInterval(window.setInterval(autoPanForFogOfWarRect, 100));
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
            }
        }
    }, [autoPanForFogOfWarRect, fogOfWarRect, raycastForFirstUserDataFields, raycastToPlane, toast, store]);
    const onRotate = useCallback((_delta: ObjectVector2, currentPos: ObjectVector2) => {
        const selected = raycastForFirstUserDataFields(currentPos, 'mapId');
        if (selected) {
            changeFogOfWarBitmask(startedOnFogRef.current, {mapId: selected.mapId, startPos: selected.point,
                endPos: selected.point, position: buildVector2(currentPos), colour: ''}, 'fogOfWarPaint');
        }

    }, [changeFogOfWarBitmask, raycastForFirstUserDataFields]);
    const onGestureEnd = useCallback(() => {
        if (fogOfWarRect) {
            setMenuSelected({
                selected: {position: fogOfWarRect.position},
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
    }, [cancelFogOfWarRect, changeFogOfWarBitmask, fogOfWarRect, setMenuSelected]);
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
    
    
    return (!fogOfWarRect || !map || dragMode !== 'fogOfWarMode' || !startPos || !endPos) ? null : (
        <group position={position} rotation={rotation}>
            <FogOfWarRectComponent gridType={map.metadata.properties!.gridType}
                                   cornerPos1={startPos} cornerPos2={endPos} colour={fogOfWarRect.colour}
            />
        </group>
    );
};

export default TabletopFogOfWar;