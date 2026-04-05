import {useConvexPolyhedron} from '@react-three/cannon';
import {useFrame} from '@react-three/fiber';
import {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Color, Quaternion, Vector3} from 'three';

import {setDieResultAction} from '../redux/diceReducer';
import {DieResult} from '../redux/diceReducerTypes';
import {getDiceBagFromStore} from '../redux/mainReducer';
import {
    buildDieGeometry,
    buildDieMaterials,
    buildDiePhysicsShape,
    getRotatedDieUpsideValue,
    isDieShapeResultFaceInverted
} from '../util/dieObjectUtils';

const SETTLED_LIMIT = 20;
const DELTA = 0.01;

interface DieProps {
    seed?: string;
    type: string;
    dieColour?: string;
    fontColour?: string;
    index?: number;
    result?: DieResult;
    override?: DieResult;
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];
    spin?: number;
    hidden?: boolean;
    dieId: string;
    dieRollId: string;
    size?: number;
}

const Die: FunctionComponent<DieProps> = (props: DieProps) => {
    const dispatch = useDispatch();
    const [settled, setSettled] = useState(SETTLED_LIMIT);

    const diceBag = useSelector(getDiceBagFromStore);
    const dieParameters = diceBag.dieType[props.type];
    if (!dieParameters) {
        throw new Error('Unknown die type ' + props.type);
    }

    const [ref, api] = useConvexPolyhedron(() => (
        buildDiePhysicsShape(dieParameters.shape, setSettled, props.size, props.seed, props.index, props.result,
            props.initialPosition, props.initialRotation, props.spin)
    ), undefined, [dieParameters.shape, setSettled, props.size, props.seed, props.index, props.result,
        props.initialPosition, props.initialRotation, props.spin]);

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
        new Vector3(0, invert ? -1 : 1, 0)
    ), [invert]);

    const dieWorldQuaternion = useRef(new Quaternion());

    useFrame(({invalidate}) => {
        if (lengthSq(velocity.current) < DELTA && lengthSq(angularVelocity.current) < DELTA) {
            if (settled > 1) {
                invalidate();
                setSettled(settled - 1);
            } else if (settled === 1 && ref.current) {
                setSettled(0);
                ref.current.getWorldQuaternion(dieWorldQuaternion.current);
                const resultIndex = getRotatedDieUpsideValue(dieParameters.shape, dieWorldQuaternion.current, targetNormal);
                if (resultIndex !== props.result?.index) {
                    dispatch(setDieResultAction(props.dieId, resultIndex, position.current, rotation.current));
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

    const highlightFace = props.override?.index || props.result?.index;

    const size = props.size || 1;
    const fontColour = props.fontColour || 'white';
    const dieColour = props.dieColour || 'black';

    const userData = useMemo(() => ({
        dieId: props.dieId,
        dieRollId: props.dieRollId
    }), [props.dieId, props.dieRollId]);

    const geometry = useMemo(() => (
        buildDieGeometry(dieParameters.shape)
    ), [dieParameters.shape]);

    const fadeFontColour = useMemo(() => {
        // Ensure fontColour is in hex format, then add alpha.
        const colour = new Color(fontColour);
        return '#' + colour.getHexString() + '33';
    }, [fontColour]);

    const material = useMemo(() => (
        buildDieMaterials(dieParameters.shape, dieParameters.faceTexts, dieColour, fontColour, dieParameters.faceTextSplit, dieParameters.textMargin, fadeFontColour, highlightFace)
    ), [dieParameters.shape, dieParameters.faceTexts, dieParameters.textMargin, dieColour, fontColour, dieParameters.faceTextSplit, fadeFontColour, highlightFace]);

    return (
        <group userData={userData}>
            <mesh geometry={geometry} material={material} ref={ref as any} scale={size} visible={!props.hidden} />
        </group>
    );
};

export default Die;

function lengthSq(v: number[]) {
    return v.reduce((lengthSq, num) => (lengthSq + num * num), 0);
}