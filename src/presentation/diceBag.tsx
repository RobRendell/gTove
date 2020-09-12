import * as React from 'react';
import {omit} from 'lodash';
import * as PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';

import d4 from './images/d4.png';
import d6 from './images/d6.png';
import d8 from './images/d8.png';
import d10 from './images/d10.png';
import d12 from './images/d12.png';
import d20 from './images/d20.png';
import dPercent from './images/d%.png';

import './diceBag.scss';

import InputButton from './inputButton';
import {addDiceAction, clearDiceAction, DiceReducerType} from '../redux/diceReducer';
import {GtoveDispatchProp} from '../redux/mainReducer';
import {MovableWindowContext} from './movableWindow';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {dieTypeToParams} from './dieObject';
import {compareAlphanumeric} from '../util/stringUtils';

interface DiceBagProps extends GtoveDispatchProp {
    dice: DiceReducerType;
    userDiceColours: {diceColour: string, textColour: string};
    onClose: () => void;
    myPeerId: string;
    connectedUsers: ConnectedUserReducerType;
    pinOpen?: boolean;
}

interface DiceBagState {
    dicePool?: {
        [dieType: string]: {
            count: number;
            imgSrc: string;
        }
    };
}

export default class DiceBag extends React.Component<DiceBagProps, DiceBagState> {

    static contextTypes = {
        windowPoppedOut: PropTypes.bool
    };

    context: MovableWindowContext;

    constructor(props: DiceBagProps) {
        super(props);
        this.rollPool = this.rollPool.bind(this);
        this.state = {
        };
    }

    closeIfNotPoppedOut() {
        if (!this.context.windowPoppedOut && !this.props.pinOpen) {
            this.props.onClose();
        }
    }

    adjustDicePool(dieType: string, imgSrc: string, delta = 1) {
        const dicePool = this.state.dicePool!;
        const count = dicePool[dieType] ? dicePool[dieType].count : 0;
        if (count + delta <= 0) {
            this.setState({dicePool: omit(dicePool, dieType)})
        } else {
            this.setState({
                dicePool: {
                    ...dicePool,
                    [dieType]: {
                        imgSrc,
                        count: count + delta
                    }
                }
            });
        }
    }

    private getMyRollId() {
        return Object.keys(this.props.dice.rolls).find((rollId) => (this.props.dice.rolls[rollId].peerId === this.props.myPeerId));
    }

    renderDieButton(dieType: string, imgSrc: string) {
        const myRollId = this.getMyRollId();
        const disabled = (!this.state.dicePool && myRollId !== undefined && this.props.dice.rolls[myRollId].busy > 0);
        return (
            <InputButton type='button' disabled={disabled} onChange={() => {
                if (this.state.dicePool) {
                    this.adjustDicePool(dieType, imgSrc);
                } else {
                    const {diceColour, textColour} = this.props.userDiceColours;
                    const name = this.props.connectedUsers.users[this.props.myPeerId]?.user.displayName;
                    this.props.dispatch(addDiceAction(diceColour, textColour, this.props.myPeerId, [dieType], name));
                    this.closeIfNotPoppedOut();
                }
            }}>
                <img src={imgSrc} alt={dieType}/>
            </InputButton>
        );
    }

    rollPool() {
        if (this.state.dicePool) {
            const dicePool: string[] = [];
            for (let dieType of Object.keys(this.state.dicePool)) {
                const pool = this.state.dicePool[dieType];
                for (let count = 0; count < pool.count; ++count) {
                    dicePool.push(dieType);
                }
            }
            const {diceColour, textColour} = this.props.userDiceColours;
            const name = this.props.connectedUsers.users[this.props.myPeerId]?.user.displayName;
            this.props.dispatch(addDiceAction(diceColour, textColour, this.props.myPeerId, dicePool, name));
            this.setState({dicePool: this.context.windowPoppedOut || this.props.pinOpen ? {} : undefined});
            this.closeIfNotPoppedOut();
        }
    }

    renderDiceResult() {
        const dice = this.props.dice;
        return (
            <>
                {
                    dice.rollIds
                        .filter((rollId) => (!dice.history[rollId]))
                        .map((rollId) => (
                            <ReactMarkdown className='dieResults' key={'results-for-rollId-' + rollId} source={
                                getDiceResultString(dice, rollId)
                            } />
                        ))
                }
                {
                    dice.historyIds.map((rollId) => (
                        <ReactMarkdown className='dieResults' key={'history-' + rollId} source={dice.history[rollId]} />
                    ))
                }
            </>
        )
    }

    render() {
        const dicePool = this.state.dicePool;
        const myRollId = this.getMyRollId();
        const busy = (myRollId !== undefined && this.props.dice.rolls[myRollId].busy > 0);
        return (
            <div className='diceBag'>
                <div className='diceButtons'>
                    {this.renderDieButton('d4', d4)}
                    {this.renderDieButton('d6', d6)}
                    {this.renderDieButton('d8', d8)}
                    {this.renderDieButton('d10', d10)}
                    {this.renderDieButton('d12', d12)}
                    {this.renderDieButton('d20', d20)}
                    <InputButton type='button' disabled={!!this.state.dicePool || busy} onChange={() => {
                        const {diceColour, textColour} = this.props.userDiceColours;
                        this.props.dispatch(addDiceAction(diceColour, textColour, this.props.myPeerId, ['d%', 'd10.0']));
                        this.closeIfNotPoppedOut();
                    }}>
                        <img src={dPercent} alt='d%'/>
                    </InputButton>
                    <div className='diceControls'>
                        <InputButton type='button'
                                     tooltip={dicePool ? 'Roll a single die' : 'Build a dice pool'}
                                     onChange={() => {
                                         this.setState({dicePool: this.state.dicePool ? undefined: {}});
                                     }}>
                            {dicePool ? 'Single' : 'Pool'}
                        </InputButton>
                        <InputButton disabled={busy} type='button'
                                     tooltip='Clear all settled dice from table.  The history of rolls is preserved.' onChange={() => {
                                         this.props.dispatch(clearDiceAction());
                                         this.closeIfNotPoppedOut();
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
                                    <div key={dieType} onClick={() => {this.adjustDicePool(dieType, dicePool[dieType].imgSrc, -1)}}>
                                        <img src={dicePool[dieType].imgSrc} alt={dieType}/>
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
                                    <InputButton type='button' disabled={busy} onChange={this.rollPool}>
                                        Roll!
                                    </InputButton>
                                ) : (
                                    <p>Select dice to roll in a pool together.</p>
                                )
                            }
                        </div>
                    )
                }
                {
                    this.renderDiceResult()
                }
            </div>
        )
    }
}

export function getDiceResultString(dice: DiceReducerType, rollId: string): string {
    const diceIds = Object.keys(dice.rollingDice).filter((dieId) => (dice.rollingDice[dieId].rollId === rollId));
    const diceValues = diceIds.map((dieId) => {
        const rolling = dice.rollingDice[dieId];
        const diceParameters = dieTypeToParams[rolling.dieType];
        const face = rolling.result;
        return face !== undefined ? diceParameters.faceToValue(face) : undefined;
    });
    const total = diceValues.reduce<number>((total, value) => (total + (value || 0)), 0);
    const resultsPerType = diceIds.reduce((results, dieId, index) => {
        const rolling = dice.rollingDice[dieId];
        const diceParameters = dieTypeToParams[rolling.dieType];
        const stringValue = diceValues[index] === undefined ? '...' : diceValues[index];
        const name = diceParameters.dieName || rolling.dieType;
        results[name] = results[name] === undefined ? [stringValue] : [...results[name], stringValue];
        return results;
    }, {});
    const resultTypes = Object.keys(resultsPerType).sort((type1, type2) => (Number(type1.slice(1)) - Number(type2.slice(1))));
    let resultStrings = resultTypes.map((type) => {
        const heading = (type === 'd%' || resultsPerType[type].length === 1) ? type : `${resultsPerType[type].length}${type}`;
        const list = resultsPerType[type].sort((v1: string | number, v2: string | number) => (compareAlphanumeric(v1.toString(), v2.toString())));
        return (
            `**${heading}:** ${list.join(',')}`
        );
    });
    return `${dice.rolls[rollId].name} rolled ${resultStrings.join('; ')}${(diceIds.length === 1) ? '' : ` = **${total}**`}`;
}