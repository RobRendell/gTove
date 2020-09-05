import * as React from 'react';
import {useConvexPolyhedron} from 'use-cannon';
import {useEffect, useMemo, useRef, useState} from 'react';
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

function getUpsideValue(geometry: THREE.Geometry, quaterion: THREE.Quaternion, targetNormal: THREE.Vector3): number {
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
const DELTA = 0.01;

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
            rotation: initialParameters.rotation,
            velocity: initialParameters.velocity,
            angularVelocity: initialParameters.angularVelocity,
            allowSleep: true,
            sleepTimeLimit: 3
        };
    });

    const velocity = useRef([0, 0, 0]);
    const angularVelocity = useRef([0, 0, 0]);
    useEffect(() => {
        api.velocity.subscribe((value) => {velocity.current = value});
        api.angularVelocity.subscribe((value) => {angularVelocity.current = value});
    }, [api, velocity, angularVelocity]);

    const invert = dieTypeToParams[props.type].invertUpside;
    const targetNormal = useMemo(() => (
        new THREE.Vector3(0, invert ? -1 : 1, 0)
    ), [invert]);

    const [settled, setSettled] = useState(SETTLED_LIMIT);

    useFrame(() => {
        if (lengthSq(velocity.current) < DELTA && lengthSq(angularVelocity.current) < DELTA) {
            if (settled > 1) {
                setSettled(settled - 1);
            } else if (ref.current && props.onResult) {
                const mesh = ref.current as THREE.Mesh;
                const resultIndex = getUpsideValue(mesh.geometry as THREE.Geometry, mesh.quaternion, targetNormal);
                if (resultIndex !== props.resultIndex) {
                    props.onResult(resultIndex);
                }
            }
        } else if (settled < SETTLED_LIMIT) {
            setSettled(SETTLED_LIMIT);
        }
    });

    return (
        <DieObject dieRef={ref} {...props} highlightFace={props.resultIndex} />
    );
};

function lengthSq(v: number[]) {
    return v.reduce((lengthSq, num) => (lengthSq + num * num), 0);
}