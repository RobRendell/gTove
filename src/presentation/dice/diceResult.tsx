import {FunctionComponent, useCallback, useMemo} from 'react';
import ReactMarkdown from 'react-markdown';

import './diceResult.scss';

import {compareAlphanumeric} from '../../util/stringUtils';
import InputButton from '../inputButton';
import {DicePoolType} from './diceBag';
import {DiceRollHistory} from '../../redux/diceReducerTypes';

interface DiceResultProps {
    history: DiceRollHistory;
    busy: boolean;
    sortDice: boolean;
    rollPool: (dicePool: DicePoolType) => void;
}

const DiceResult: FunctionComponent<DiceResultProps> = ({history, busy, sortDice, rollPool}) => {
    const dicePool: DicePoolType = useMemo(() => (
        Object.fromEntries(
            Object.keys(history.results).map((dieType) => ([
                dieType,
                {count: history.results[dieType].length}
            ]))
        )
    ), [history]);
    const dicePoolText = useMemo(() => (
        Object.keys(dicePool)
            .map((dieType) => ((dicePool[dieType].count === 1 || dieType === 'd%') ? dieType : `${dicePool[dieType].count}${dieType}`))
            .join('+')
    ), [dicePool]);
    const reRollPool = useCallback(() => {
        rollPool(dicePool);
    }, [rollPool, dicePool]);
    return (
        <div className='diceResult'>
            <ReactMarkdown>{getDiceResultString(history, sortDice)}</ReactMarkdown>
            {
                dicePool === undefined ? null : (
                    <InputButton type='button' className='rerollButton' onChange={reRollPool}
                                 disabled={busy} tooltip={`Roll ${dicePoolText} again`}
                    >
                        {dicePoolText}
                    </InputButton>
                )
            }
        </div>
    );
}

export default DiceResult;


function getDiceResultString(history: DiceRollHistory, sort = true): string {
    const {timestamp, results, total, reroll, name} = history;
    const resultTypes = Object.keys(results).sort((type1, type2) => (Number(type1.slice(1)) - Number(type2.slice(1))));
    let resultStrings = resultTypes.map((type) => {
        const heading = (type === 'd%' || results[type].length === 1) ? type : `${results[type].length}${type}`;
        const list = sort
            ? results[type].slice().sort((a, b) => (
                a === undefined ? -1 : b === undefined ? 1 : compareAlphanumeric(a.value.toString(), b.value.toString())
            ))
            : results[type];
        return (
            `**${heading}:** ${list.map((dieResult) => (dieResult?.value ?? '...')).join(', ')}`
        );
    });
    const rolled = reroll ? 're-rolled' : 'rolled';
    const todayDateString = new Date().toDateString();
    const rollDate = new Date(timestamp ?? 0);
    const timePrefix = (!timestamp) ? 'Unknown time'
        : (rollDate.toDateString() === todayDateString) ? rollDate.toLocaleTimeString()
            : rollDate.toLocaleString();
    return `[${timePrefix}]: ${name} ${rolled} ${resultStrings.join('; ')}${(total === undefined) ? '' : ` = **${total}**`}`;
}