import {useFrame, useThree} from '@react-three/fiber';
import {FunctionComponent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import * as THREE from 'three';
import {Vector3} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useEdgeAutoPan} from '../hooks/useEdgeAutoPan';
import {useRaycast} from '../hooks/useRaycast';
import {TabletopViewGestureContext} from '../presentation/tabletopViewComponent';
import {getMyPeerIdFromStore, getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {undoGroupThunk, updateMiniSelectedByAction} from '../redux/scenarioReducer';
import {toggleTabletopStateDragModeAction} from '../redux/tabletopStateReducer';
import {isCloseTo} from '../util/mathsUtils';
import {ObjectVector2} from '../util/scenarioUtils';
import {buildVector3} from '../util/threeUtils';

function betweenZeroAndLimit(value: number, limit: number, margin: number) {
    return (limit > 0) ? (value >= -margin && value <= limit + margin)
        : (value >= limit - margin && value <= margin);
}

const COLOUR = '#ff00ff';
const DIR_EAST = new Vector3(1, 0, 0);

interface TabletopElasticBandProps {
    userIsGM: boolean;
}

const TabletopElasticBand: FunctionComponent<TabletopElasticBandProps> = ({userIsGM}) => {
    const {raycastToMapOrPlane, raycastToPlane} = useRaycast();
    const startPosRef = useRef<Vector3 | undefined>();
    const [endPos, setEndPos] = useState<Vector3 | undefined>();
    const [currentMiniIds, setCurrentMiniIds] = useState<{[miniId: string]: boolean}>({});
    const changedMinisRef = useRef<{[miniId: string]: boolean}>({});
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const {dragMode, undoGroupId, focusMapId} = useSelector(getTabletopStateFromStore);
    const store = useStore();
    const dispatch = useDispatch();
    const {camera} = useThree();

    const enabled = (dragMode === 'elasticBandMode');
    useEffect(() => {
        if (!enabled) {
            startPosRef.current = undefined;
            setEndPos(undefined);
            setCurrentMiniIds({});
        }
    }, [enabled]);

    const setAutoPanPosition = useEdgeAutoPan(startPosRef.current !== undefined && endPos !== undefined);

    const match = useCallback((context: TabletopViewGestureContext) => (
        !context.readOnly && !context.dragHandle && context.dragMode === 'elasticBandMode'
    ), []);
    const onGestureStart = useCallback((mousePosition: ObjectVector2) => {
        const focusY = !focusMapId ? 0 : getScenarioFromStore(store.getState()).maps[focusMapId]?.position.y;
        const {position} = raycastToMapOrPlane(mousePosition, focusY ?? 0);
        startPosRef.current = position.clone();
    }, [focusMapId, raycastToMapOrPlane, store]);

    const onPan = useCallback((_delta: ObjectVector2, mousePosition: ObjectVector2) => {
        const startPos = startPosRef.current;
        if (!startPos) {
            return;
        }
        const position = raycastToPlane(mousePosition, startPos.y);
        if (!position) {
            return;
        }
        const endPos = position.clone();
        const corner3 = new Vector3(endPos.x, startPos.y, endPos.z);
        const vectorDiagonal = corner3.clone().sub(startPos);
        const vectorRight = DIR_EAST.clone().applyQuaternion(camera.quaternion);
        const lengthRight = vectorDiagonal.dot(vectorRight);
        const vectorDown = new Vector3(-vectorRight.z, 0, vectorRight.x);
        const lengthDown = vectorDiagonal.dot(vectorDown);
        // We want to select/unselect minis as they enter or leave the elastic band rect, but also leave any existing
        // multipleMiniIds selections from previous elastic bands that haven't been deselected in the meantime.
        const minis = getScenarioFromStore(store.getState()).minis;
        setCurrentMiniIds((previous) => {
            let next: undefined | typeof previous = undefined;
            Object.keys(minis).forEach((miniId) => {
                let mini = minis[miniId];
                if (myPeerId && !mini.attachMiniId && !mini.locked && isCloseTo(mini.position.y, startPos.y)) {
                    const margin = mini.scale / 3; // scale is a diameter, we want a radius, but a bit less.
                    const miniOffsetFromStartPos = buildVector3(mini.position).sub(startPos);
                    const distanceRight = miniOffsetFromStartPos.dot(vectorRight);
                    const distanceDown = miniOffsetFromStartPos.dot(vectorDown);
                    const inside = betweenZeroAndLimit(distanceRight, lengthRight, margin)
                        && betweenZeroAndLimit(distanceDown, lengthDown, margin);
                    if (inside && !previous[miniId] && (mini.selectedBy === null || userIsGM)) {
                        if (!next) {
                            next = {...previous};
                        }
                        next[miniId] = true;
                        changedMinisRef.current[miniId] = true;
                    } else if (!inside && previous[miniId] && mini.selectedBy === myPeerId) {
                        if (!next) {
                            next = {...previous};
                        }
                        next[miniId] = false;
                        changedMinisRef.current[miniId] = true;
                    }
                }
            });
            return next ?? previous;
        });
        setEndPos(endPos);
        setAutoPanPosition(mousePosition);
    }, [camera.quaternion, myPeerId, raycastToPlane, setAutoPanPosition, store, userIsGM]);
    useEffect(() => {
        for (const miniId in changedMinisRef.current) {
            dispatch(undoGroupThunk(updateMiniSelectedByAction(miniId, currentMiniIds[miniId] ? myPeerId : null), undoGroupId));
            changedMinisRef.current = {};
        }
    }, [currentMiniIds, dispatch, myPeerId, undoGroupId]);
    
    const onTap = useCallback(() => {
        store.dispatch(toggleTabletopStateDragModeAction('elasticBandMode'));
    }, [store]);
    
    const onGestureEnd = useCallback(() => {
        startPosRef.current = undefined;
        setEndPos(undefined);
        setCurrentMiniIds({});
        store.dispatch(toggleTabletopStateDragModeAction('elasticBandMode'));
    }, [store]);

    // Gesture handling
    const elasticBandHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'elasticBand',
        priority: 10,
        match,
        onGestureStart,
        onPan,
        onTap,
        onGestureEnd
    }), [match, onGestureEnd, onGestureStart, onPan, onTap]);
    useGestureHandler(elasticBandHandler);

    const quaternion = camera.quaternion;
    const points = useMemo(() => {
        if (startPosRef.current && endPos) {
            const corner1 = new Vector3(startPosRef.current.x, startPosRef.current.y + 0.1, startPosRef.current.z);
            const corner3 = new Vector3(endPos.x, corner1.y, endPos.z);
            const vectorDiagonal = corner3.clone().sub(corner1);
            const vectorRight = DIR_EAST.clone().applyQuaternion(quaternion);
            const width = vectorDiagonal.dot(vectorRight);
            const corner2 = corner1.clone().addScaledVector(vectorRight, width);
            const corner4 = corner3.clone().addScaledVector(vectorRight, -width);
            return [corner1, corner2, corner3, corner4, corner1];
        } else {
            return [];
        }
    }, [endPos, quaternion]);
    const lineLoopRef = useRef<THREE.LineLoop>(null);
    const bufferGeometryRef = useRef<THREE.BufferGeometry>(null);
    useLayoutEffect(() => {
        if (bufferGeometryRef.current) {
            bufferGeometryRef.current.setFromPoints(points);
            if (bufferGeometryRef.current.attributes.position) {
                bufferGeometryRef.current.attributes.position.needsUpdate = true;
            }
            // Recompute bounding volume so it's not culled by the frustum check.
            bufferGeometryRef.current.computeBoundingSphere();
            // Compute dash distances.
            lineLoopRef.current?.computeLineDistances();
        }
    }, [points]);
    useFrame(({invalidate}) => {
        if (points.length) {
            // Re-draw the canvas whenever this component is rendered with points.
            invalidate();
        }
    });

    return !points.length ? null : (
        <lineLoop ref={lineLoopRef}>
            <bufferGeometry attach='geometry' ref={bufferGeometryRef}/>
            <lineDashedMaterial attach='material' color={COLOUR} linecap={'round'} linejoin={'round'}
                                scale={1} dashSize={0.5} gapSize={0.5}
            />
        </lineLoop>
    );
}

export default TabletopElasticBand;