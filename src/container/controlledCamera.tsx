import * as THREE from 'three';
import {useFrame, useThree} from 'react-three-fiber';

export default function ControlledCamera({position, lookAt}: {position: THREE.Vector3, lookAt: THREE.Vector3}) {
    // Invalidate whenever camera is re-rendered, because sometimes frames didn't get rendered on prop changes otherwise.
    useThree().invalidate();
    useFrame(({camera}) => {
        if (!position.equals(camera.position) || camera.userData._lookAt !== lookAt) {
            camera.position.copy(position);
            camera.lookAt(lookAt);
            camera.userData._lookAt = lookAt;
        }
    });
    return null;
}