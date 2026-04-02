import {useFrame, useThree} from '@react-three/fiber';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useSelector} from 'react-redux';
import {PerspectiveCamera} from 'three';

import {useCameraParameters} from '../context/cameraParametersProvider';
import {useSetTapMenuSelection} from '../presentation/tabletopTapMenu';
import {getConnectedUsersFromStore, getDeviceLayoutFromStore, getMyPeerIdFromStore} from '../redux/mainReducer';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {ObjectVector2} from '../util/scenarioUtils';
import {buildVector3} from '../util/threeUtils';
import {GestureHandler, useGestureHandler} from './gestureControls';

interface ControlledCameraProps {
    near: number;
    far: number;
}

const ControlledCamera: React.FunctionComponent<ControlledCameraProps> = ({near, far}) => {
    const {camera, size: {width, height}, invalidate} = useThree();
    const {cameraPositionRef, cameraLookAtRef, registerChangeCallback, cameraTargetRef, updateTabletopState, setCameraParameters} = useCameraParameters();
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const deviceLayout = useSelector(getDeviceLayoutFromStore);
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const setTapMenuSelection = useSetTapMenuSelection();

    const cameraVersionRef = useRef(0);
    const lastVersionRef = useRef(-1);

    // Invalidate whenever camera is re-rendered, because sometimes frames didn't get rendered on prop changes otherwise.
    invalidate();

    // When the camera changes, invalidate and also increment cameraVersionRef
    const onCameraChanged = useCallback(() => {
        invalidate();
        cameraVersionRef.current++;
    }, [invalidate]);
    useEffect(() => (
        registerChangeCallback(onCameraChanged)
    ), [onCameraChanged, registerChangeCallback]);

    useFrame(({camera, invalidate}) => {
        const animated = !!cameraTargetRef.current;
        if (cameraTargetRef.current) {
            invalidate();
            const {startTime, endTime, toPosition, toLookAt} = cameraTargetRef.current;
            const progress = (Date.now() - startTime) / (endTime - startTime);
            if (progress >= 1) {
                cameraPositionRef.current.copy(toPosition);
                cameraLookAtRef.current.copy(toLookAt);
                cameraTargetRef.current = undefined;
                updateTabletopState();
            } else {
                cameraPositionRef.current.lerp(toPosition, progress);
                cameraLookAtRef.current.lerp(toLookAt, progress);
            }
        }
        if (animated || cameraVersionRef.current !== lastVersionRef.current) {
            camera.position.copy(cameraPositionRef.current);
            camera.lookAt(cameraLookAtRef.current);
            lastVersionRef.current = cameraVersionRef.current;
        }
    });

    useEffect(() => {
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
    }, [camera, far, near]);

    const cameraView = useMemo(() => {
        const layout = deviceLayout.layout;
        if (!myPeerId || !layout[myPeerId]) {
            return undefined;
        }
        const groupId = layout[myPeerId].deviceGroupId;
        const myX = layout[myPeerId].x;
        const myY = layout[myPeerId].y;
        let minX = myX, maxX = myX + width;
        let minY = myY, maxY = myY + height;
        Object.keys(layout).forEach((peerId) => {
            if (layout[peerId].deviceGroupId === groupId && connectedUsers.users[peerId]) {
                const {x, y} = layout[peerId];
                const {deviceWidth, deviceHeight} = connectedUsers.users[peerId];
                if (minX > x) {
                    minX = x;
                }
                if (maxX < x + deviceWidth) {
                    maxX = x + deviceWidth;
                }
                if (minY > y) {
                    minY = y;
                }
                if (maxY < y + deviceHeight) {
                    maxY = y + deviceHeight;
                }
            }
        });
        return {
            fullWidth: maxX - minX,
            fullHeight: maxY - minY,
            offsetX: myX - minX,
            offsetY: myY - minY,
            width,
            height
        };
    }, [connectedUsers.users, deviceLayout.layout, height, myPeerId, width]);

    useEffect(() => {
        if (cameraView) {
            camera.setViewOffset(cameraView.fullWidth, cameraView.fullHeight, cameraView.offsetX, cameraView.offsetY,
                cameraView.width, cameraView.height);
        } else {
            if (camera.view) {
                camera.clearViewOffset();
                // Clearing the view offset doesn't recalculate the aspect ratio, so fall through.
            }
            // Manually set the camera's aspect ratio, because we've disabled R3F's control.
            (camera as PerspectiveCamera).aspect = width / height;
            camera.updateProjectionMatrix();
        }
    }, [camera, cameraView, height, width]);

    const groupCamera = useMemo(() => (
        !myPeerId || !deviceLayout.layout[myPeerId] ? undefined
            : deviceLayout.groupCamera[deviceLayout.layout[myPeerId].deviceGroupId]
    ), [deviceLayout.groupCamera, deviceLayout.layout, myPeerId]);

    // Sync with group camera.
    useEffect(() => {
        if (groupCamera && groupCamera.peerId !== myPeerId) {
            const cameraPosition = !groupCamera.cameraPosition ? undefined :
                buildVector3(groupCamera.cameraPosition);
            const cameraLookAt = !groupCamera.cameraLookAt ? undefined :
                buildVector3(groupCamera.cameraLookAt);
            setCameraParameters({cameraPosition, cameraLookAt}, groupCamera.animate, groupCamera.focusMapId, true);
        }
    }, [cameraLookAtRef, cameraPositionRef, groupCamera, myPeerId, setCameraParameters]);

    // Gesture handling
    const onMatch = useCallback(() => {
        setTapMenuSelection();
    }, [setTapMenuSelection]);
    const onPan = useCallback((delta: ObjectVector2) => {
        setCameraParameters(panCamera(delta, camera as PerspectiveCamera, cameraLookAtRef.current, cameraPositionRef.current, width, height));
    }, [camera, cameraLookAtRef, cameraPositionRef, height, setCameraParameters, width]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        setCameraParameters(zoomCamera(delta, cameraLookAtRef.current, cameraPositionRef.current, 2, far));
    }, [cameraLookAtRef, cameraPositionRef, far, setCameraParameters]);
    const onRotate = useCallback((delta: ObjectVector2) => {
        setCameraParameters(rotateCamera(delta, camera as PerspectiveCamera, cameraLookAtRef.current, cameraPositionRef.current, width, height));
    }, [camera, cameraLookAtRef, cameraPositionRef, height, setCameraParameters, width]);
    const gestureHandler = useMemo<GestureHandler>(() => ({
        id: 'cameraHandler',
        priority: 1,
        onMatch,
        onPan,
        onZoom,
        onRotate,
        default: true
    }), [onMatch, onPan, onRotate, onZoom]);
    useGestureHandler(gestureHandler)

    return null;
};

export default ControlledCamera;