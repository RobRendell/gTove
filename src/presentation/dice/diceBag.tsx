import {omit} from 'lodash';
import {useDispatch, useSelector} from 'react-redux';
import {FunctionComponent, useCallback, useContext, useMemo, useState} from 'react';

import './diceBag.scss';

import InputButton from '../inputButton';
import {
    addDiceAction,
    AddDieType,
    clearDiceAction,
    DiceReducerType,
} from '../../redux/diceReducer';
import {
    getConnectedUsersFromStore,
    getDiceBagFromStore,
    getMyPeerIdFromStore
} from '../../redux/mainReducer';
import {MovableWindowContextObject} from '../movableWindow';
import {DieButton} from './dieButton';
import DieImage from './dieImage';
import DiceResult from './diceResult';

type DicePoolType = undefined | {
    [dieType: string]: {
        count: number;
    }
};

interface DiceBagProps {
    dice: DiceReducerType;
    userDiceColours: {diceColour: string, textColour: string};
    onClose: () => void;
    pinOpen?: boolean;
}

const DiceBag: FunctionComponent<DiceBagProps> = ({
                                                          dice,
                                                          userDiceColours,
                                                          onClose,
                                                          pinOpen
                                                      }) => {
    const myPeerId = useSelector(getMyPeerIdFromStore)!;
    const {users} = useSelector(getConnectedUsersFromStore);
    const diceBag = useSelector(getDiceBagFromStore);
    const [sortDice, setSortDice] = useState(false);
    const [dicePool, setDicePool] = useState<DicePoolType>();
    const myRollId = useMemo(() => (
        Object.keys(dice.rolls).find((rollId) => (dice.rolls[rollId].peerId === myPeerId))
    ), [dice.rolls, myPeerId]);
    const busy = (myRollId !== undefined && dice.rolls[myRollId].busy > 0);
    const dispatch = useDispatch();
    const adjustDicePool = useCallback((dieType: string, delta = 1) => {
        setDicePool((dicePool) => {
            const count = dicePool?.[dieType]?.count ?? 0;
            return (count + delta <= 0) ? omit(dicePool, dieType) : {
                ...dicePool,
                [dieType]: {
                    count: count + delta
                }
            };
        });
    }, []);
    const windowPoppedOut = useContext(MovableWindowContextObject);
    const closeIfAppropriate = useCallback(() => {
        if (!windowPoppedOut && !pinOpen) {
            onClose();
        }
    }, [onClose, pinOpen, windowPoppedOut]);
    const onSelectDie = useCallback((dieType: string, poolName?: string) => {
        if (dicePool) {
            adjustDicePool(dieType);
        } else {
            const {diceColour: dieColour, textColour} = userDiceColours;
            const name = users[myPeerId]?.user.displayName;
            const dice: AddDieType[] = [{dieType, dieColour, textColour}];
            if (poolName) {
                for (let otherName of diceBag.dieTypeNames) {
                    if (otherName !== dieType && diceBag.dieType[otherName].poolName === poolName) {
                        dice.push({dieType: otherName, dieColour, textColour});
                    }
                }
            }
            dispatch(addDiceAction(dice, myPeerId, name));
            closeIfAppropriate();
        }
    }, [adjustDicePool, closeIfAppropriate, users, diceBag, dicePool, dispatch, myPeerId, userDiceColours]);
    const rollPool = useCallback(() => {
        if (dicePool) {
            const {diceColour, textColour} = userDiceColours;
            const poolToRoll: AddDieType[] = [];
            for (let dieType of Object.keys(dicePool)) {
                const pool = dicePool[dieType];
                for (let count = 0; count < pool.count; ++count) {
                    poolToRoll.push({
                        dieType,
                        dieColour: diceColour,
                        textColour
                    });
                }
            }
            const name = users[myPeerId]?.user.displayName;
            dispatch(addDiceAction(poolToRoll, myPeerId, name));
            setDicePool(() => (windowPoppedOut || pinOpen ? {} : undefined));
            closeIfAppropriate();
        }
    }, [closeIfAppropriate, users, dicePool, dispatch, myPeerId, pinOpen, userDiceColours, windowPoppedOut]);
    return (
        <div className='diceBag'>
            <div>
                {
                    diceBag.dieTypeNames.map((dieName) => (
                        <DieButton key={dieName}
                                   dieType={dieName}
                                   busy={busy}
                                   dicePoolMode={dicePool !== undefined}
                                   diceBag={diceBag}
                                   onSelectDie={onSelectDie}
                        />
                    ))
                }
                <div className='diceControls'>
                    <InputButton type='button'
                                 tooltip={dicePool ? 'Roll a single die' : 'Build a dice pool'}
                                 onChange={() => {
                                     setDicePool((dicePool) => (dicePool ? undefined : {}));
                                 }}>
                        {dicePool ? 'Single' : 'Pool'}
                    </InputButton>
                    <InputButton disabled={busy} type='button'
                                 tooltip='Clear all settled dice from table.  The history of rolls is preserved.'
                                 onChange={() => {
                                     dispatch(clearDiceAction());
                                     closeIfAppropriate();
                                 }}>
                        Clear
                    </InputButton>
                </div>
            </div>
            {
                !dicePool ? null : (
                    <div className='dicePool'>
                        {
                            Object.keys(dicePool).map((dieType) => (
                                <div key={dieType} onClick={() => {
                                    adjustDicePool(dieType, -1)
                                }}>
                                    <DieImage dieType={dieType} diceBag={diceBag}/>
                                    {
                                        dicePool[dieType].count === 1 ? null : (
                                            <span>
                                                &times; {dicePool[dieType].count}
                                            </span>
                                        )
                                    }
                                </div>
                            ))
                        }
                        {
                            Object.keys(dicePool).length > 0 ? (
                                <InputButton type='button' disabled={busy} onChange={rollPool}>
                                    Roll!
                                </InputButton>
                            ) : (
                                <p>Select dice to roll in a pool together.</p>
                            )
                        }
                    </div>
                )
            }
            <DiceResult dice={dice} sortDice={sortDice} setSortDice={setSortDice} />
        </div>
    );
};

export default DiceBag;