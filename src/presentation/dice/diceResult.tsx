import {FunctionComponent} from 'react';
import ReactMarkdown from 'react-markdown';
import {useDispatch} from 'react-redux';

import InputButton from '../inputButton';
import {clearDiceHistoryAction, DiceReducerType, DiceRollHistory} from '../../redux/diceReducer';
import {compareAlphanumeric} from '../../util/stringUtils';

interface DiceResultProps {
    dice: DiceReducerType;
    sortDice: boolean;
    setSortDice: (sortDice: boolean) => void;
}

const DiceResult: FunctionComponent<DiceResultProps> = ({dice, sortDice, setSortDice}) => {
    const dispatch = useDispatch();
    return dice.historyIds.length === 0 ? null : (
        <div className='diceHistory'>
            <hr/>
            <InputButton type='button' onChange={() => {
                dispatch(clearDiceHistoryAction());
            }}>Clear History</InputButton>
            {
                sortDice ? 'Dice results are sorted' : 'Dice results are unsorted'
            }
            <InputButton type='button' onChange={() => {
                setSortDice(!sortDice);
            }}>Toggle sorting</InputButton>
            {
                dice.historyIds.map((rollId) => (
                    <ReactMarkdown className='dieResults' key={'history-' + rollId}>
                        {getDiceResultString(dice.history[rollId], sortDice)}
                    </ReactMarkdown>
                ))
            }
        </div>
    )
};

export default DiceResult;

function getDiceResultString(history: DiceRollHistory, sort = true): string {
    const {results, total, reroll, name} = history;
    const resultTypes = Object.keys(results).sort((type1, type2) => (Number(type1.slice(1)) - Number(type2.slice(1))));
    let resultStrings = resultTypes.map((type) => {
        const heading = (type === 'd%' || results[type].length === 1) ? type : `${results[type].length}${type}`;
        const list = sort
            ? results[type].slice().sort((a, b) => (
                a === undefined ? -1 : b === undefined ? 1 : compareAlphanumeric(a.value.toString(), b.value.toString())
            ))
            : results[type];
        return (
            `**${heading}:** ${list.map((dieResult) => (dieResult?.face || '...')).join(',')}`
        );
    });
    const rolled = reroll ? 're-rolled' : 'rolled';
    return `${name} ${rolled} ${resultStrings.join('; ')}${(total === undefined) ? '' : ` = **${total}**`}`;
}