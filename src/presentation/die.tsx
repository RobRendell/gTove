import {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react';
import {BodyProps, ConvexPolyhedronArgs, useConvexPolyhedron} from '@react-three/cannon';
import * as THREE from 'three';
import {Geometry} from 'three-stdlib/deprecated/Geometry'
import {useFrame} from '@react-three/fiber';
import SeedRandom from 'seed-random';

import DieObject, {DieObjectProps, isDieTypeResultFaceInverted} from './dieObject';
import {spiralSquareGridGenerator} from '../util/scenarioUtils';
import {DieResult} from '../redux/diceReducer';

const SETTLED_LIMIT = 20;
const DELTA = 0.01;

interface DieProps extends DieObjectProps {
    onResult?: (result: number, position: [number, number, number], rotation: [number, number, number]) => void;
    seed?: string;
    index?: number;
    result?: DieResult;
    override?: DieResult;
    userData?: any;
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];
}

const Die: FunctionComponent<DieProps> = (props: DieProps) => {

    const [settled, setSettled] = useState(SETTLED_LIMIT);

    const [ref, api] = useConvexPolyhedron(() => {
        const bufferGeometry = (ref.current as THREE.Mesh).geometry;
        const geometry = new Geometry().fromBufferGeometry(bufferGeometry);
        geometry.mergeVertices() // Cannon requires contiguous, closed meshes to work
        const args: ConvexPolyhedronArgs = (geometry?.vertices && geometry?.faces)
            ? [geometry.vertices, geometry.faces.map((f) => [f.a, f.b, f.c]), geometry.faces.map((f) => (f.normal))]
            : [[], [], []];
        return {
            ...initialParameters(setSettled, props.seed, props.index, props.result, props.initialPosition, props.initialRotation),
            mass: 350,
            args,
            allowSleep: true,
            sleepTimeLimit: 3
        };
    });

    const velocity = useRef([0, 0, 0]);
    const angularVelocity = useRef([0, 0, 0]);
    const position = useRef<[number, number, number]>([0, 0, 0]);
    // For some bizarre reason, subscribed rotations come back in YZX order, but set in XYZ order.
    const rotationYZX = useRef<[number, number, number]>([0, 0, 0]);
    useEffect(() => {
        api.velocity.subscribe((value) => {velocity.current = value});
        api.angularVelocity.subscribe((value) => {angularVelocity.current = value});
        api.position.subscribe((value) => {position.current = value});
        api.rotation.subscribe((value) => {rotationYZX.current = value});
    }, [api, velocity, angularVelocity, position, rotationYZX]);

    const invert = isDieTypeResultFaceInverted(props.type);
    const targetNormal = useMemo(() => (
        new THREE.Vector3(0, invert ? -1 : 1, 0)
    ), [invert]);

    const mesh = ref.current as THREE.Mesh | undefined;

    const geometry = useMemo(() => (
        mesh ? new Geometry().fromBufferGeometry(mesh.geometry) : undefined
    ), [mesh]);

    const dieWorldQuaternion = useMemo(() => (new THREE.Quaternion()), []);

    useFrame(() => {
        if (lengthSq(velocity.current) < DELTA && lengthSq(angularVelocity.current) < DELTA) {
            if (settled > 1) {
                setSettled(settled - 1);
            } else if (settled === 1 && ref.current && props.onResult && geometry) {
                setSettled(settled - 1);
                ref.current.getWorldQuaternion(dieWorldQuaternion);
                const resultIndex = getUpsideValue(geometry, dieWorldQuaternion, targetNormal);
                if (resultIndex !== props.result?.index) {
                    // Need to convert YZX order Euler angle to XYZ
                    const euler = new THREE.Euler(...rotationYZX.current, 'YZX');
                    euler.reorder('XYZ');
                    const rotationXYZ = [0, 0, 0] as [number, number, number];
                    euler.toArray(rotationXYZ);
                    props.onResult(resultIndex, position.current, rotationXYZ);
                }
            } else if (props.override) {
                api.position.set(props.override.position[0], props.override.position[1], props.override.position[2]);
                api.rotation.set(props.override.rotation[0], props.override.rotation[1], props.override.rotation[2]);
            }
        } else if (settled < SETTLED_LIMIT) {
            setSettled(SETTLED_LIMIT);
        }
    });

    return (
        <DieObject dieRef={ref} {...props} highlightFace={props.override?.index || props.result?.index} />
    );
};

export default Die;

function initialParameters(setSettled: (count: number) => void, seed?: string, index?: number, result?: DieResult,
                           position?: [number, number, number], rotation?: [number, number, number]): BodyProps {
    if (result) {
        // If we start with a defined result, just start in that position.
        setSettled(0);
        return {
            position: result.position.slice() as [number, number, number],
            rotation: result.rotation.slice() as [number, number, number],
            angularFactor: [0, 0, 0],
            linearFactor: [0, 0, 0]
        }
    }
    let offset = {x: 0, y: 0};
    if (index) {
        const spiral = spiralSquareGridGenerator();
        for (let count = 0; count < index; count++) {
            offset = spiral.next().value;
        }
    }
    const random = seed ? SeedRandom(seed) : Math.random;
    const baseVelocityY = position ? 18 : 4;
    return {
        position: position || [(offset.x + random()) * 4 - 2, 4 + random() * 4, (offset.y + random()) * 4 - 2],
        rotation: rotation || [2 * Math.PI * random(), 2 * Math.PI * random(), 2 * Math.PI * random()],
        velocity: [biModal(4, random), baseVelocityY + random() * 4, biModal(4, random)],
        angularVelocity: [biModal(Math.PI, random), biModal(Math.PI, random), biModal(Math.PI, random)]
    };
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

// Generate a random number from -halfRange to +halfRange, with non-zero values more likely than zero
function biModal(halfRange: number, random: () => number): number {
    const positive = (random() >= 0.5);
    const roll = halfRange * (random() + random() + random()) / 3;
    return positive ? roll : -roll;
}

function lengthSq(v: number[]) {
    return v.reduce((lengthSq, num) => (lengthSq + num * num), 0);
}