import {Physics, usePlane} from '@react-three/cannon';
import {useThree} from '@react-three/fiber';
import pick from 'lodash/pick';
import {FunctionComponent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Euler, Vector3} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useRaycast} from '../hooks/useRaycast';
import {addDiceAction, setDieResultAction} from '../redux/diceReducer';
import {AddDieType} from '../redux/diceReducerTypes';
import {getDiceFromStore, getMyPeerIdFromStore} from '../redux/mainReducer';
import {ObjectVector2} from '../util/scenarioUtils';
import Die from './dice/die';
import {RayCastIntersectDie, TabletopViewGestureContext} from './tabletopViewComponent';

interface TabletopDiceLayerProps {
    interestLevelY: number;
}

const TabletopDiceLayer: FunctionComponent<TabletopDiceLayerProps> = ({interestLevelY}) => {
    const dice = useSelector(getDiceFromStore);
    const [diceState, setDiceState] = useState<{[rollId: string]: {position: Vector3; rotation: Euler}}>({});
    const dispatch = useDispatch();
    const {camera, size: {width}} = useThree();
    const {raycastToPlane} = useRaycast();
    const myPeerId = useSelector(getMyPeerIdFromStore);

    useEffect(() => {
        if (dice?.rollIds.length) {
            setDiceState((prevState) => {
                const missingRollIds = dice.rollIds.filter((rollId) => (prevState[rollId] === undefined));
                if (missingRollIds.length > 0) {
                    const position = (camera.userData._lookAt as Vector3).clone();
                    const rotation = new Euler();
                    const diceData = {...prevState};
                    for (let rollId of missingRollIds) {
                        const reRollId = dice.rolls[rollId].reRollId;
                        diceData[rollId] = reRollId ? prevState[reRollId] : {position, rotation};
                    }
                    return diceData;
                } else {
                    return prevState;
                }
            });
        }
    }, [camera, dice]);

    const offsetRef = useRef(new Vector3());
    const intersectRef = useRef<undefined | RayCastIntersectDie>();
    const match = useCallback((context: TabletopViewGestureContext) => (
        context.intersect?.type === 'dieRollId'
    ), []);
    const onMatch = useCallback((context: TabletopViewGestureContext<RayCastIntersectDie>) => {
        intersectRef.current = context.intersect;
    }, []);
    const onGestureStart = useCallback(() => {
        if (intersectRef.current && diceState[intersectRef.current.dieRollId]) {
            offsetRef.current.copy(diceState[intersectRef.current.dieRollId].position).sub(intersectRef.current.point);
        }
    }, [diceState]);
    const onTap = useCallback(() => {
        if (!intersectRef.current) {
            return;
        }
        const {dieRollId, dieId} = intersectRef.current;
        // If the original dice roll has settled, allow whoever rolled it to re-roll.
        if (dice.rolls[dieRollId]?.peerId === myPeerId && dice.rolls[dieRollId].busy <= 0) {
            // Re-roll the clicked die, the others start with their current result.
            const diceReroll: AddDieType[] = dice.rolls[dieRollId].diceIds
                .filter((id) => (id !== dieId))
                .map((dieId) => (dice.rollingDice[dieId]))
                .map((die) => ({...pick(die, 'dieType', 'dieColour', 'textColour'), fixedResult: die.definitiveResult ?? die.result}));
            diceReroll.push({
                ...pick(dice.rollingDice[dieId], 'dieType', 'dieColour', 'textColour'),
                initialPosition: dice.rollingDice[dieId].result?.position,
                initialRotation: dice.rollingDice[dieId].result?.rotation
            });
            dispatch(addDiceAction(diceReroll, myPeerId, dice.rolls[dieRollId].name, dieRollId));
        }
    }, [dice.rollingDice, dice.rolls, dispatch, myPeerId]);
    const onPan = useCallback((_delta: ObjectVector2, position: ObjectVector2) => {
        const rollId = intersectRef.current?.dieRollId;
        if (!rollId || !intersectRef.current) {
            return;
        }
        const intersect = raycastToPlane(position, intersectRef.current.point.y);
        if (intersect) {
            intersect.add(offsetRef.current);
            setDiceState((prevState) => (!prevState[rollId] ? prevState : {
                ...prevState,
                [rollId]: {
                    ...prevState[rollId],
                    position: intersect.clone()
                }
            }));
        }
    }, [raycastToPlane]);
    const onRotate = useCallback((delta: ObjectVector2, currentPos: ObjectVector2) => {
        const rollId = intersectRef.current?.dieRollId;
        if (!rollId || !intersectRef.current) {
            return;
        }
        const intersect = raycastToPlane(currentPos, intersectRef.current.point.y);
        if (intersect) {
            setDiceState((prevState) => {
                if (!prevState[rollId]) {
                    return prevState;
                }
                const position = prevState[rollId].position.clone().sub(offsetRef.current);
                const quadrant14 = (offsetRef.current.x - position.x > offsetRef.current.z - position.z);
                const quadrant12 = (offsetRef.current.x - position.x > position.z - offsetRef.current.z);
                const amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
                const euler = new Euler(0, 2 * Math.PI * amount / width, 0);
                const rotation = prevState[rollId].rotation.clone();
                rotation.y += euler.y;
                offsetRef.current.applyEuler(euler);
                position.add(offsetRef.current);
                return {...prevState, [rollId]: {position, rotation}};
            });
        }
    }, [raycastToPlane, width]);
    const onGestureEnd = useCallback(() => {
        intersectRef.current = undefined;
    }, []);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'diceGestureHandler',
        priority: 5,
        match,
        onMatch,
        onGestureStart,
        onTap,
        onPan,
        onRotate,
        onGestureEnd,
    }), [match, onGestureEnd, onGestureStart, onMatch, onPan, onRotate, onTap]);
    useGestureHandler(gestureHandler);
    
    return !dice || dice.rollIds.length === 0 ? null : (
        <>
            {
                Object.keys(dice.rolls).map((rollId) => (
                    !diceState[rollId] ? null : (
                        <group position={diceState[rollId].position} rotation={diceState[rollId].rotation} key={'dice-for-rollId-' + rollId}>
                            <Physics gravity={[0, -20, 0]} stepSize={1/50} allowSleep={true}>
                                <DiceRollSurface/>
                                {
                                    dice.rolls[rollId].diceIds
                                        .map((dieId) => {
                                            const die = dice.rollingDice[dieId];
                                            return (
                                                <Die key={dieId} seed={dieId}
                                                     type={die.dieType}
                                                     dieColour={die.dieColour}
                                                     fontColour={die.textColour}
                                                     index={die.index}
                                                     result={die.result}
                                                     override={die.definitiveResult && die.result && die.definitiveResult.index !== die.result.index ? die.definitiveResult : undefined}
                                                     initialPosition={die.initialPosition}
                                                     initialRotation={die.initialRotation}
                                                     onResult={(resultIndex, position, rotation) => {
                                                         dispatch(setDieResultAction(dieId, resultIndex, position, rotation));
                                                     }}
                                                     hidden={diceState[rollId].position.y > interestLevelY}
                                                     userData={{dieRollId: rollId, dieId}}
                                                />
                                            );
                                        })
                                }
                            </Physics>
                        </group>
                    )
                ))
            }
        </>
    );
};

export default TabletopDiceLayer;

function DiceRollSurface() {
    const [ref] = usePlane(() => ({mass: 0, rotation: [-Math.PI / 2, 0, 0]}));
    return (<mesh ref={ref as any}/>);
}
