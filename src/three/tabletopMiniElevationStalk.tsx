import {Line} from '@react-three/drei';
import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';

interface TabletopMiniElevationArrowProps {
    length: number;
}

const ELEVATION_LINE_DELTA = 0.1;
const tickScale = new THREE.Vector3(0.2, 0.02, 1);

const TabletopMiniElevationStalk: FunctionComponent<TabletopMiniElevationArrowProps> = ({length}) => {
    const elevationLinePoints = useMemo(() => (
        [
            [0, 0, 0],
            [0, length, 0]
        ] as [number, number, number][]
    ), [length]);
    const tickLinePoints = useMemo(() => (
        new Array(Math.floor(length)).fill(null).map((_, index) => (
            new THREE.Vector3(0, index + 1, 0)
        ))
    ), [length]);
    return (length > ELEVATION_LINE_DELTA) ? (
        <>
            <Line points={elevationLinePoints} color={0xffff00} lineWidth={1}/>
            {
                tickLinePoints.map((position, index) => (
                    <sprite key={`tick_${index}`} position={position} scale={tickScale}>
                        <spriteMaterial color={0xffff00} depthWrite={false} />
                    </sprite>
                ))
            }
        </>
    ) : null;
};

export default TabletopMiniElevationStalk;