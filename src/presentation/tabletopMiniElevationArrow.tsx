import * as THREE from 'three';
import {FunctionComponent, useMemo} from 'react';
import {Line} from '@react-three/drei';

interface TabletopMiniElevationArrowProps {
    length: number;
    cameraInverseQuat?: THREE.Quaternion;
}

const ELEVATION_LINE_DELTA = 0.1;
const TICK_OFFSET = new THREE.Vector3(ELEVATION_LINE_DELTA, 0, 0);

const TabletopMiniElevationArrow: FunctionComponent<TabletopMiniElevationArrowProps> = ({length, cameraInverseQuat}) => {
    const elevationLinePoints = useMemo(() => (
        [
            [0, 0, 0],
            [0, length, 0]
        ] as [number, number, number][]
    ), [length]);
    const offset = TICK_OFFSET.clone();
    if (cameraInverseQuat) {
        offset.applyQuaternion(cameraInverseQuat);
    }
    const tickLinePoints = useMemo(() => (
        new Array(Math.floor(length)).fill(null).map((_, index) => (
            [
                [offset.x, index + 1, offset.z],
                [-offset.x, index + 1, -offset.z]
            ] as [number, number, number][]
        ))
    ), [length, offset]);
    return (length > ELEVATION_LINE_DELTA) ? (
        <>
            <Line points={elevationLinePoints} color='yellow' lineWidth={1}/>
            {
                tickLinePoints.map((points, index) => (
                    <Line key={`tick_${index}`} points={points} color='yellow' lineWidth={1}/>
                ))
            }
        </>
    ) : null;
};

export default TabletopMiniElevationArrow;