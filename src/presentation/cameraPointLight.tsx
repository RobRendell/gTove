import {useFrame} from '@react-three/fiber';
import {FunctionComponent, useRef} from 'react';
import {PointLight} from 'three';

import {useCameraParameters} from '../context/cameraParametersContextBridge';

interface CameraPointLightProps {
    intensity?: number;
}

const CameraPointLight: FunctionComponent<CameraPointLightProps> = ({intensity = 0.6}) => {
    const {cameraPositionRef} = useCameraParameters();
    const pointLightRef = useRef<PointLight | null>(null);
    useFrame(() => {
        if (pointLightRef.current) {
            pointLightRef.current.position.copy(cameraPositionRef.current);
        }
    });
    
    return (
        <pointLight ref={pointLightRef} intensity={intensity} />
    )
}

export default CameraPointLight;