import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';

interface ControlledCameraProps {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
    near: number;
    far: number;
}

const ControlledCamera: React.FunctionComponent<ControlledCameraProps> = ({position, lookAt, near, far}) => {
    // Invalidate whenever camera is re-rendered, because sometimes frames didn't get rendered on prop changes otherwise.
    useThree().invalidate();
    useFrame(({camera}) => {
        if (!position.equals(camera.position) || camera.userData._lookAt !== lookAt) {
            camera.position.copy(position);
            camera.lookAt(lookAt);
            camera.userData._lookAt = lookAt;
        }
        camera.near = near;
        camera.far = far;
    });
    return null;
};

export default ControlledCamera;