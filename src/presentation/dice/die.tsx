import {useConvexPolyhedron} from '@react-three/cannon';
import {useFrame} from '@react-three/fiber';
import {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import * as THREE from 'three';

import {DieResult} from '../../redux/diceReducerTypes';
import {getDiceBagFromStore} from '../../redux/mainReducer';
import {buildDiePhysicsShape, getRotatedDieUpsideValue, isDieShapeResultFaceInverted} from '../../util/dieObjectUtils';
import DieObject, {DieObjectProps} from './dieObject';

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

    const diceBag = useSelector(getDiceBagFromStore);
    const dieParameters = diceBag.dieType[props.type];
    if (!dieParameters) {
        throw new Error('Unknown die type ' + props.type);
    }

    const [ref, api] = useConvexPolyhedron(() => (
        buildDiePhysicsShape(dieParameters.shape, setSettled, props.size, props.seed, props.index, props.result,
            props.initialPosition, props.initialRotation)
    ), undefined, [dieParameters.shape, setSettled, props.size, props.seed, props.index, props.result,
        props.initialPosition, props.initialRotation]);

    const velocity = useRef([0, 0, 0]);
    const angularVelocity = useRef([0, 0, 0]);
    const position = useRef<[number, number, number]>([0, 0, 0]);
    const rotation = useRef<[number, number, number]>([0, 0, 0]);
    useEffect(() => {
        api.velocity.subscribe((value) => {velocity.current = value});
        api.angularVelocity.subscribe((value) => {angularVelocity.current = value});
        api.position.subscribe((value) => {position.current = value});
        api.rotation.subscribe((value) => {rotation.current = value});
    }, [api, velocity, angularVelocity, position, rotation]);

    const invert = isDieShapeResultFaceInverted(dieParameters.shape);
    const targetNormal = useMemo(() => (
        new THREE.Vector3(0, invert ? -1 : 1, 0)
    ), [invert]);

    const dieWorldQuaternion = useRef(new THREE.Quaternion());

    useFrame(({invalidate}) => {
        if (lengthSq(velocity.current) < DELTA && lengthSq(angularVelocity.current) < DELTA) {
            if (settled > 1) {
                invalidate();
                setSettled(settled - 1);
            } else if (settled === 1 && ref.current && props.onResult) {
                setSettled(settled - 1);
                ref.current.getWorldQuaternion(dieWorldQuaternion.current);
                const resultIndex = getRotatedDieUpsideValue(dieParameters.shape, dieWorldQuaternion.current, targetNormal);
                if (resultIndex !== props.result?.index) {
                    props.onResult(resultIndex, position.current, rotation.current);
                }
            } else if (props.override) {
                api.position.set(props.override.position[0], props.override.position[1], props.override.position[2]);
                api.rotation.set(props.override.rotation[0], props.override.rotation[1], props.override.rotation[2]);
            }
        } else {
            invalidate();
            if (settled < SETTLED_LIMIT) {
                setSettled(SETTLED_LIMIT);
            }
        }
    });

    return (
        <DieObject dieRef={ref} {...props} highlightFace={props.override?.index || props.result?.index} />
    );
};

export default Die;

function lengthSq(v: number[]) {
    return v.reduce((lengthSq, num) => (lengthSq + num * num), 0);
}