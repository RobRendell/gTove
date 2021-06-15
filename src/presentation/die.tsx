import * as React from 'react';
import {BodyProps, ConvexPolyhedronArgs, useConvexPolyhedron} from '@react-three/cannon';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {Geometry} from 'three-stdlib/deprecated/Geometry'
import {useFrame} from '@react-three/fiber';
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

function getUpsideValue(geometry: Geometry, quaterion: THREE.Quaternion, targetNormal: THREE.Vector3): number {
    let closestFace = undefined, smallestAngle = 0;
    for (let face of geometry.faces) {
        if (face.materialIndex > 0) {
            const angle = face.normal.clone().applyQuaternion(quaterion).angleTo(targetNormal);
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

    const initialParameters = useMemo<BodyProps>(() => {
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
        const bufferGeometry = (ref.current as THREE.Mesh).geometry;
        const geometry = new Geometry().fromBufferGeometry(bufferGeometry);
        geometry.mergeVertices() // Cannon requires contiguous, closed meshes to work
        const args: ConvexPolyhedronArgs = (geometry?.vertices && geometry?.faces)
            ? [geometry.vertices, geometry.faces.map((f) => [f.a, f.b, f.c]), geometry.faces.map((f) => (f.normal))]
            : [[], [], []];
        return {
            ...initialParameters,
            mass: 350,
            args,
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

    const mesh = ref.current as THREE.Mesh | undefined;

    const geometry = useMemo(() => (
        mesh ? new Geometry().fromBufferGeometry(mesh.geometry) : undefined
    ), [mesh]);

    const dieWorldQuaternion = useMemo(() => (new THREE.Quaternion()), []);

    useFrame(() => {
        if (lengthSq(velocity.current) < DELTA && lengthSq(angularVelocity.current) < DELTA) {
            if (settled > 1) {
                setSettled(settled - 1);
            } else if (ref.current && props.onResult && geometry) {
                ref.current.getWorldQuaternion(dieWorldQuaternion);
                const resultIndex = getUpsideValue(geometry, dieWorldQuaternion, targetNormal);
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