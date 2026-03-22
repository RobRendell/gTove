import {useFrame, useThree} from '@react-three/fiber';
import {useCallback, useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {PerspectiveCamera} from 'three';

import {TabletopViewComponentCameraView} from '../presentation/tabletopViewComponent';
import {SetCameraFunction} from '../presentation/virtualGamingTabletop';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {ObjectVector2} from '../util/scenarioUtils';
import {GestureHandler, useGestureHandler} from './gestureControls';

interface ControlledCameraProps {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
    near: number;
    far: number;
    setCamera: SetCameraFunction;
    cameraView?: TabletopViewComponentCameraView;
}

const ControlledCamera: React.FunctionComponent<ControlledCameraProps> = ({position, lookAt, near, far, setCamera, cameraView}) => {
    const {camera, size: {width, height}, invalidate} = useThree();

    // Invalidate whenever camera is re-rendered, because sometimes frames didn't get rendered on prop changes otherwise.
    invalidate();
    
    useFrame(({camera}) => {
        if (!position.equals(camera.position) || camera.userData._lookAt !== lookAt) {
            camera.position.copy(position);
            camera.lookAt(lookAt);
            camera.userData._lookAt = lookAt;
        }
        camera.near = near;
        camera.far = far;
    });

    useEffect(() => {
        if (cameraView) {
            camera.setViewOffset(cameraView.fullWidth, cameraView.fullHeight, cameraView.offsetX, cameraView.offsetY,
                cameraView.width, cameraView.height);
        } else if (camera.view) {
            // Simply clearing the offset doesn't seem to reset the camera properly, so explicitly set it back to default first.
            camera.setViewOffset(width, height, 0, 0, width, height);
            camera.clearViewOffset();
        }
    }, [camera, cameraView, height, width]);

    // Gesture handling
    const onPan = useCallback((delta: ObjectVector2) => {
        setCamera(panCamera(delta, camera as PerspectiveCamera, lookAt, position, width, height));
    }, [camera, lookAt, position, height, setCamera, width]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        setCamera(zoomCamera(delta, lookAt, position, 2, far));
    }, [lookAt, position, far, setCamera]);
    const onRotate = useCallback((delta: ObjectVector2) => {
        setCamera(rotateCamera(delta, camera as PerspectiveCamera, lookAt, position, width, height));
    }, [camera, lookAt, position, height, setCamera, width]);
    const gestureHandler = useMemo<GestureHandler>(() => ({
        id: 'cameraHandler',
        priority: 1,
        onPan,
        onZoom,
        onRotate
    }), [onPan, onRotate, onZoom]);
    useGestureHandler(gestureHandler)

    return null;
};

export default ControlledCamera;