import React, {FunctionComponent, useCallback, useMemo} from 'react';
import * as THREE from 'three';
import {BufferGeometry, Line, LineBasicMaterial} from 'react-three-fiber/components';

import {GridType} from '../util/googleDriveUtils';
import {getGridStride} from '../util/scenarioUtils';

interface FogOfWarRectComponentProps {
    gridType: GridType;
    cornerPos1: THREE.Vector3;
    cornerPos2: THREE.Vector3;
    colour: string;
}

const deltaY = 0.01;

export const FogOfWarRectComponent: FunctionComponent<FogOfWarRectComponentProps> = ({gridType, cornerPos1, cornerPos2, colour}) => {
    const points = useMemo(() => {
        const startX = Math.min(cornerPos1.x, cornerPos2.x);
        const startZ = Math.min(cornerPos1.z, cornerPos2.z);
        const endX = Math.max(cornerPos1.x, cornerPos2.x);
        const endZ = Math.max(cornerPos1.z, cornerPos2.z);
        const points: THREE.Vector3[] = [];
        const current = new THREE.Vector3(startX, deltaY, startZ);
        const {strideX, strideY} = getGridStride(gridType);
        let hexZigZagOffset, hexZigStep, hexZagStep, hexStraightStep, hexStraightZigStep, hexStraightZagStep;
        let lengthZigZag, lengthStraight, straightTargetX, straightXMin = 0, straightTargetZ, straightZMin = 0;
        switch (gridType) {
            case GridType.SQUARE:
                const vertical = new THREE.Vector3(0, 0, endZ - startZ);
                const horizontal = new THREE.Vector3(endX - startX, 0, 0);
                points.push(current.clone());
                current.add(vertical);
                points.push(current.clone());
                current.add(horizontal);
                points.push(current.clone());
                current.sub(vertical);
                points.push(current.clone());
                current.sub(horizontal);
                points.push(current.clone());
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
        points.push(current.clone());
        for (let zigzag = 0; zigzag < lengthZigZag - (lengthZigZag % 2); ++zigzag) {
            current.add(zigzag % 2 ? hexZigStep : hexZagStep);
            points.push(current.clone());
        }
        current.add(hexStraightStep);
        points.push(current.clone());
        for (let straight = 0; straight < lengthStraight - (lengthStraight % 2) - (lengthZigZag % 2); ++straight) {
            if ((straightTargetX && current.x < Math.max(endX + straightTargetX, straightXMin)) || (straightTargetZ && current.z < Math.max(endZ + straightTargetZ, straightZMin))) {
                current.add(hexStraightZigStep);
            } else {
                current.add(hexStraightZagStep);
            }
            points.push(current.clone());
            current.add(hexStraightStep);
            points.push(current.clone());
        }
        for (let zigzag = 0; zigzag < lengthZigZag - (lengthZigZag % 2); ++zigzag) {
            current.sub(zigzag % 2 ? hexZigStep : hexZagStep);
            points.push(current.clone());
        }
        current.sub(hexStraightStep);
        points.push(current.clone());
        for (let straight = 0; straight < lengthStraight - (lengthStraight % 2) - (lengthZigZag % 2); ++straight) {
            if ((straightTargetX && current.x > startX - straightTargetX) || (straightTargetZ && current.z > startZ - straightTargetZ)) {
                current.sub(hexStraightZigStep);
            } else {
                current.sub(hexStraightZagStep);
            }
            points.push(current.clone());
            current.sub(hexStraightStep);
            points.push(current.clone());
        }
        return points;
    }, [gridType, cornerPos1, cornerPos2]);
    const computeLineDistances = useCallback((line) => (line.computeLineDistances()), []);
    const setFromPoints = useCallback((lineMaterial) => {lineMaterial.setFromPoints(points)}, [points]);

    return (
        <Line onUpdate={computeLineDistances}>
            <BufferGeometry attach='geometry' onUpdate={setFromPoints} />
            <LineBasicMaterial attach="material" color={colour} />
        </Line>
    )
};

export default FogOfWarRectComponent;