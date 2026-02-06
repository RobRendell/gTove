import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';
import {Line} from '@react-three/drei';

import {GridType} from '../util/storage/storageContract';
import {getGridStride} from '../util/scenarioUtils';
import {vector3ToArray} from '../util/threeUtils';

interface FogOfWarRectComponentProps {
    gridType: GridType;
    cornerPos1: THREE.Vector3;
    cornerPos2: THREE.Vector3;
    colour: string;
}

export const FogOfWarRectComponent: FunctionComponent<FogOfWarRectComponentProps> = ({gridType, cornerPos1, cornerPos2, colour}) => {
    const points = useMemo(() => {
        const startX = Math.min(cornerPos1.x, cornerPos2.x);
        const startZ = Math.min(cornerPos1.z, cornerPos2.z);
        const endX = Math.max(cornerPos1.x, cornerPos2.x);
        const endZ = Math.max(cornerPos1.z, cornerPos2.z);
        const points: [number, number, number][] = [];
        const current = new THREE.Vector3(startX, 0, startZ);
        const {strideX, strideY} = getGridStride(gridType);
        let hexZigZagOffset, hexZigStep, hexZagStep, hexStraightStep, hexStraightZigStep, hexStraightZagStep;
        let lengthZigZag, lengthStraight, straightTargetX, straightXMin = 0, straightTargetZ, straightZMin = 0;
        switch (gridType) {
            case GridType.SQUARE:
                const vertical = new THREE.Vector3(0, 0, endZ - startZ);
                const horizontal = new THREE.Vector3(endX - startX, 0, 0);
                points.push(vector3ToArray(current));
                current.add(vertical);
                points.push(vector3ToArray(current));
                current.add(horizontal);
                points.push(vector3ToArray(current));
                current.sub(vertical);
                points.push(vector3ToArray(current));
                current.sub(horizontal);
                points.push(vector3ToArray(current));
                return points;
            case GridType.HEX_VERT:
                hexZigZagOffset = new THREE.Vector3(strideX / 3, 0, 0);
                hexZigStep = new THREE.Vector3(strideX / 3, 0, strideY);
                hexZagStep = new THREE.Vector3(-strideX / 3, 0, strideY);
                hexStraightStep = new THREE.Vector3(strideX * 2 / 3, 0, 0);
                hexStraightZigStep = new THREE.Vector3(strideX / 3, 0, strideY);
                hexStraightZagStep = new THREE.Vector3(strideX / 3, 0, -strideY);
                lengthZigZag = Math.round((endZ - startZ) / strideY);
                lengthStraight = Math.round((endX - startX) / strideX);
                straightTargetZ = -strideY / 2;
                straightZMin = startZ + 3 * strideY;
                break;
            case GridType.HEX_HORZ:
                hexZigZagOffset = new THREE.Vector3(0, 0, strideY / 3);
                hexZigStep = new THREE.Vector3(strideX, 0, strideY / 3);
                hexZagStep = new THREE.Vector3(strideX, 0, -strideY / 3);
                hexStraightStep = new THREE.Vector3(0, 0, strideY * 2 / 3);
                hexStraightZigStep = new THREE.Vector3(strideX, 0, strideY / 3);
                hexStraightZagStep = new THREE.Vector3(-strideX, 0, strideY / 3);
                lengthStraight = Math.round((endZ - startZ) / strideY);
                lengthZigZag = Math.round((endX - startX) / strideX);
                straightTargetX = -strideX / 2;
                straightXMin = startX + 3 * strideX;
                break;
            default:
                return [];
        }
        const startWithZigStep = (cornerPos1.x < cornerPos2.x) !== (cornerPos1.z < cornerPos2.z) && lengthZigZag % 2;
        if (startWithZigStep) {
            current.add(hexZigStep);
        } else {
            current.add(hexZigZagOffset);
        }
        points.push(vector3ToArray(current));
        for (let zigzag = 0; zigzag < lengthZigZag - (lengthZigZag % 2); ++zigzag) {
            current.add(zigzag % 2 ? hexZigStep : hexZagStep);
            points.push(vector3ToArray(current));
        }
        current.add(hexStraightStep);
        points.push(vector3ToArray(current));
        for (let straight = 0; straight < lengthStraight - (lengthStraight % 2) - (lengthZigZag % 2); ++straight) {
            if ((straightTargetX && current.x < Math.max(endX + straightTargetX, straightXMin)) || (straightTargetZ && current.z < Math.max(endZ + straightTargetZ, straightZMin))) {
                current.add(hexStraightZigStep);
            } else {
                current.add(hexStraightZagStep);
            }
            points.push(vector3ToArray(current));
            current.add(hexStraightStep);
            points.push(vector3ToArray(current));
        }
        for (let zigzag = 0; zigzag < lengthZigZag - (lengthZigZag % 2); ++zigzag) {
            current.sub(zigzag % 2 ? hexZigStep : hexZagStep);
            points.push(vector3ToArray(current));
        }
        current.sub(hexStraightStep);
        points.push(vector3ToArray(current));
        for (let straight = 0; straight < lengthStraight - (lengthStraight % 2) - (lengthZigZag % 2); ++straight) {
            if ((straightTargetX && current.x > startX - straightTargetX) || (straightTargetZ && current.z > startZ - straightTargetZ)) {
                current.sub(hexStraightZigStep);
            } else {
                current.sub(hexStraightZagStep);
            }
            points.push(vector3ToArray(current));
            current.sub(hexStraightStep);
            points.push(vector3ToArray(current));
        }
        return points;
    }, [gridType, cornerPos1, cornerPos2]);

    return (
        <Line points={points} color={colour} lineWidth={1} />
    )
};

export default FogOfWarRectComponent;