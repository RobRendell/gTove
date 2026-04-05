import './diceBag.scss';

import omit from 'lodash/omit';
import {FunctionComponent, useCallback, useContext, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {useToast} from '../../hooks/useToast';
import {setDicePoolModeAction} from '../../redux/diceBagReducer';
import {addDiceAction, clearDiceAction,} from '../../redux/diceReducer';
import {AddDieType, DiceReducerType} from '../../redux/diceReducerTypes';
import {
    getConnectedUsersFromStore,
    getDiceBagFromStore,
    getMyPeerIdFromStore,
    getTabletopFromStore
} from '../../redux/mainReducer';
import InputButton from '../inputButton';
import {MovableWindowContextObject} from '../movableWindow';
import DiceHistory from './diceHistory';
import {DieButton} from './dieButton';
import DieImage from './dieImage';

export type DicePoolType = {
    [dieType: string]: {
        count: number;
    }
};

interface DiceBagProps {
    dice: DiceReducerType;
    userDiceColours: {diceColour: string, textColour: string};
    onClose: () => void;
}

const DiceBag: FunctionComponent<DiceBagProps> = ({
                                                      dice,
                                                      userDiceColours,
                                                      onClose,
                                                  }) => {
    const myPeerId = useSelector(getMyPeerIdFromStore)!;
    const {users} = useSelector(getConnectedUsersFromStore);
    const diceBag = useSelector(getDiceBagFromStore);
    const toast = useToast();
    const [sortDice, setSortDice] = useState(false);
    const [dicePool, setDicePool] = useState<DicePoolType | undefined>(diceBag.dicePoolMode ? {} : undefined);
    const [pinOpen, setPinOpen] = useState(false);
    const myRollId = useMemo(() => (
        Object.keys(dice.rolls).find((rollId) => (dice.rolls[rollId].peerId === myPeerId))
    ), [dice.rolls, myPeerId]);
    const busy = (myRollId !== undefined && dice.rolls[myRollId].busy > 0);
    const dispatch = useDispatch();
    const tabletop = useSelector(getTabletopFromStore);
    const toggleDicePoolMode = useCallback(() => {
        dispatch(setDicePoolModeAction(!diceBag.dicePoolMode));
        setDicePool(diceBag.dicePoolMode ? undefined : {});
    }, [diceBag.dicePoolMode, dispatch]);
    const adjustDicePool = useCallback((dieType: string, delta = 1) => {
        setDicePool((dicePool) => {
            if (tabletop.dicePoolLimit !== undefined && tabletop.dicePoolLimit !== null) {
                const total = Object.keys(dicePool ?? {}).reduce<number>((total, dieType) => (
                    total + (dicePool?.[dieType]?.count ?? 0)
                ), delta);
                if (total > tabletop.dicePoolLimit) {
                    toast('The dice pool is already at the maximum size for this tabletop.');
                    return dicePool;
                }
            }
            const count = dicePool?.[dieType]?.count ?? 0;
            const {poolName} = diceBag.dieType[dieType];
            return (count + delta <= 0) ? omit(dicePool, dieType) : {
                ...dicePool,
                [dieType]: {
                    count: poolName ? 1 : count + delta
                }
            };
        });
    }, [diceBag.dieType, tabletop.dicePoolLimit, toast]);
    const windowPoppedOut = useContext(MovableWindowContextObject);
    const closeIfAppropriate = useCallback(() => {
        if (!windowPoppedOut && !pinOpen) {
            onClose();
        }
    }, [onClose, pinOpen, windowPoppedOut]);
    const rollDice = useCallback((dicePool: DicePoolType) => {
        const {diceColour: dieColour, textColour} = userDiceColours;
        const poolToRoll: AddDieType[] = [];
        for (let dieType of Object.keys(dicePool)) {
            const pool = dicePool[dieType];
            const {poolName} = diceBag.dieType[dieType];
            if (poolName) {
                poolToRoll.push({dieType, dieColour, textColour});
                for (let otherName of diceBag.dieTypeNames) {
                    if (otherName !== dieType && diceBag.dieType[otherName].poolName === poolName) {
                        poolToRoll.push({dieType: otherName, dieColour, textColour});
                    }
                }
            } else {
                for (let count = 0; count < pool.count; ++count) {
                    poolToRoll.push({dieType, dieColour, textColour});
                }
            }
        }
        const name = users[myPeerId]?.user.displayName;
        dispatch(addDiceAction(poolToRoll, myPeerId, name));
        setDicePool(diceBag.dicePoolMode ? {} : undefined);
        closeIfAppropriate();
    }, [userDiceColours, users, myPeerId, dispatch, closeIfAppropriate, diceBag]);
    const onSelectDie = useCallback((dieType: string) => {
        if (dicePool) {
            adjustDicePool(dieType);
        } else {
            rollDice({[dieType]: {count: 1}})
        }
    }, [adjustDicePool, dicePool, rollDice]);
    const onRollDicePool = useCallback(() => {
        if (dicePool) {
            rollDice(dicePool);
        }
    }, [dicePool, rollDice]);
    return (
        <div className='diceBag'>
            <div className='topPanel'>
                <div className='diceControls'>
                    <InputButton type='checkbox'
                                 disabled={windowPoppedOut}
                                 selected={pinOpen || windowPoppedOut}
                                 tooltip='Turn on to prevent this window automatically closing when dice are rolled or cleared'
                                 onChange={() => {
                                     setPinOpen((pinOpen) => (!pinOpen));
                                 }}>
                        Keep dice bag open
                    </InputButton>
                    <InputButton type='checkbox'
                                 selected={sortDice}
                                 tooltip='If on, dice pool rolls are shown sorted from lowest to highest.'
                                 onChange={() => {
                                     setSortDice((sortDice) => (!sortDice));
                                 }}>
                        Sort dice rolls
                    </InputButton>
                    <InputButton disabled={busy} type='button'
                                 tooltip='Clear all settled dice from the tabletop.  The history of rolls is preserved.'
                                 onChange={() => {
                                     dispatch(clearDiceAction());
                                     closeIfAppropriate();
                                 }}>
                        Clear Dice on Tabletop
                    </InputButton>
                </div>
                <div className='diceButtons'>
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
                    <InputButton className='dicePoolToggleButton'
                                 type='checkbox'
                                 toggle={true}
                                 selected={dicePool !== undefined}
                                 tooltip='Toggles whether to roll a single die, or build a pool of dice.'
                                 onChange={toggleDicePoolMode}>
                        {dicePool ? 'Cancel Dice\u00A0Pool' : 'Build Dice\u00A0Pool'}
                    </InputButton>
                </div>
                {
                    !dicePool ? null : (
                        <div className='dicePool'>
                            {
                                Object.keys(dicePool).map((dieType) => (
                                    <div key={dieType} className='diceInPool' onClick={() => {
                                        adjustDicePool(dieType, -1)
                                    }}>
                                        <DieImage dieType={dieType} diceBag={diceBag}/>
                                        {
                                            dicePool[dieType].count === 1 ? null : (
                                                <span className='dieCount'>
                                                    &times; {dicePool[dieType].count}
                                                </span>
                                            )
                                        }
                                    </div>
                                ))
                            }
                            {
                                Object.keys(dicePool).length > 0 ? null : (
                                    <p className='selectDiceText'>Select dice to roll in a pool together.</p>
                                )
                            }
                            <div className='dicePoolButtonRow'>
                                <InputButton type='button' disabled={busy || Object.keys(dicePool).length === 0}
                                             onChange={onRollDicePool}
                                >
                                    Roll!
                                </InputButton>
                            </div>
                        </div>
                    )
                }
                <hr/>
            </div>
            <div className='bottomPanel'>
                <DiceHistory dice={dice} sortDice={sortDice} busy={busy} rollPool={rollDice} />
            </div>
        </div>
    );
};

export default DiceBag;