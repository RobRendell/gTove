import './diceHistory.scss';

import {FunctionComponent, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {clearDiceHistoryAction} from '../../redux/diceReducer';
import {DiceReducerType} from '../../redux/diceReducerTypes';
import InputButton from '../inputButton';
import {DicePoolType} from './diceBag';
import DiceResult from './diceResult';

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