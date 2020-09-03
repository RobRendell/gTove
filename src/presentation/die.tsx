import * as React from 'react';
import {useConvexPolyhedron} from 'use-cannon';
import {useMemo, useState} from 'react';
import * as THREE from 'three';
import {useFrame} from 'react-three-fiber';
import SeedRandom from 'seed-random';

import DieObject, {DieObjectProps, dieTypeToParams} from './dieObject';
import {spiralSquareGridGenerator} from '../util/scenarioUtils';

interface DieProps extends DieObjectProps {
    onResult?: (result: number) => void;
    seed?: string;
    index?: number;
    resultIndex?: number;
    userData?: any;
}

function getUpsideValue(geometry: THREE.Geometry, quaterion: THREE.Quaternion, invert?: boolean) {
    const targetNormal = new THREE.Vector3(0, invert ? -1 : 1, 0);
    let closestFace = undefined, smallestAngle = 0;
    for (let face of geometry.faces) {
        if (face.materialIndex > 0) {
            let angle = face.normal.clone().applyQuaternion(quaterion).angleTo(targetNormal);
            if (!closestFace || angle < smallestAngle) {
                closestFace = face;
                smallestAngle = angle;
            }
        }
    }
    return closestFace!.materialIndex;
}

const SETTLED_LIMIT = 20;
const MOVE_DELTA = 0.000001;

// Generate a random number from -halfRange to +halfRange, with non-zero values more likely than zero
function biModal(halfRange: number, random: () => number): number {
    const positive = (random() >= 0.5);
    const roll = halfRange * (random() + random() + random()) / 3;
    return positive ? roll : -roll;
}

export default function Die(props: DieProps): React.ReactElement | null {

    const initialParameters = useMemo(() => {
        let offset = {x: 0, y: 0};
        if (props.index) {
            const spiral = spiralSquareGridGenerator();
            for (let count = 0; count < props.index; count++) {
                offset = spiral.next().value;
            }
        }
        const random = props.seed ? SeedRandom(props.seed) : Math.random;
        return {
            position: [(offset.x + random()) * 4 - 2, 4 + random() * 4, (offset.y + random()) * 4 - 2],
            rotation: [2 * Math.PI * random(), 2 * Math.PI * random(), 2 * Math.PI * random()],
            velocity: [biModal(4, random), 4 + random() * 4, biModal(4, random)],
            angularVelocity: [biModal(Math.PI, random), biModal(Math.PI, random), biModal(Math.PI, random)]
        };
    }, [props.seed, props.index]);

    const [ref, api] = useConvexPolyhedron(() => {
        return {
            mass: 350,
            args: (ref.current as THREE.Mesh).geometry as THREE.Geometry,
            position: initialParameters.position,
            rotation: initialParameters.rotation
        };
    });

    // use-cannon does not make the physics body available, so we need to detect changes in position and rotation manually.
    const [position, setPosition] = useState<THREE.Vector3 | undefined>();
    const [quaternion, setQuaternion] = useState<THREE.Quaternion | undefined>();
    const [settled, setSettled] = useState(SETTLED_LIMIT + 1);

    useFrame(() => {
        if (ref.current) {
            if (settled > 0) {
                if (settled > SETTLED_LIMIT) {
                    api.velocity.set(initialParameters.velocity[0], initialParameters.velocity[1], initialParameters.velocity[2]);
                    api.angularVelocity.set(initialParameters.angularVelocity[0], initialParameters.angularVelocity[1], initialParameters.angularVelocity[2]);
                }
                if (position && quaternion) {
                    const velocity = position.sub(ref.current.position);
                    const cosAngle = quaternion.dot(ref.current.quaternion);
                    if (velocity.lengthSq() < MOVE_DELTA && Math.abs(cosAngle - 1) < MOVE_DELTA) {
                        setSettled(settled - 1);
                        if (settled === 1 && ref.current && props.onResult) {
                            const mesh = ref.current as THREE.Mesh;
                            const resultIndex = getUpsideValue(mesh.geometry as THREE.Geometry, mesh.quaternion, dieTypeToParams[props.type].invertUpside);
                            props.onResult(resultIndex);
                        }
                    } else {
                        setSettled(SETTLED_LIMIT);
                    }
                }
                // Store current position and rotation for next frame.
                if (ref.current) {
                    setPosition(ref.current.position.clone());
                    setQuaternion(ref.current.quaternion.clone());
                }
            }
        }
    });

    return (
        <DieObject dieRef={ref} {...props} highlightFace={props.resultIndex} />
    );
};
