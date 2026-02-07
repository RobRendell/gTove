import {FunctionComponent, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import './diceHistory.scss';

import InputButton from '../inputButton';
import {clearDiceHistoryAction} from '../../redux/diceReducer';
import DiceResult from './diceResult';
import {DicePoolType} from './diceBag';
import {DiceReducerType} from '../../redux/diceReducerTypes';

interface DiceResultProps {
    dice: DiceReducerType;
    sortDice: boolean;
    busy: boolean;
    rollPool: (dicePool: DicePoolType) => void;
}

const DiceHistory: FunctionComponent<DiceResultProps> = ({dice, sortDice, busy, rollPool}) => {
    const dispatch = useDispatch();
    const onClearHistory = useCallback(() => {
        dispatch(clearDiceHistoryAction());
    }, [dispatch]);
    return dice.historyIds.length === 0 ? null : (
        <div className='diceHistory'>
            <InputButton type='button' onChange={onClearHistory}>Clear Roll History</InputButton>
            {
                dice.historyIds.map((rollId) => (
                    <DiceResult key={'history-' + rollId} history={dice.history[rollId]} sortDice={sortDice} busy={busy}
                                rollPool={rollPool}
                    />
                ))
            }
        </div>
    )
};

export default DiceHistory;