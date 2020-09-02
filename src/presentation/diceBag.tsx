import * as React from 'react';
import {omit} from 'lodash';
import * as PropTypes from 'prop-types';

import InputButton from './inputButton';
import {addDiceAction, clearDiceAction, DiceReducerType} from '../redux/diceReducer';
import {GtoveDispatchProp} from '../redux/mainReducer';
import {MovableWindowContext} from './movableWindow';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {dieTypeToParams} from './dieObject';

import d4 from './images/d4.png';
import d6 from './images/d6.png';
import d8 from './images/d8.png';
import d10 from './images/d10.png';
import d12 from './images/d12.png';
import d20 from './images/d20.png';
import dPercent from './images/d%.png';

import './diceBag.scss';

interface DiceBagProps extends GtoveDispatchProp {
    dice: DiceReducerType;
    userDiceColours: {diceColour: string, textColour: string};
    onClose: () => void;
    myPeerId: string;
    networkHubId?: string;
    connectedUsers: ConnectedUserReducerType;
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
        if (!this.context.windowPoppedOut) {
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
                    this.props.dispatch(addDiceAction(diceColour, textColour, this.props.myPeerId, [dieType]));
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
            this.props.dispatch(addDiceAction(diceColour, textColour, this.props.myPeerId, dicePool));
            this.setState({dicePool: this.context.windowPoppedOut ? {} : undefined});
            this.closeIfNotPoppedOut();
        }
    }

    renderDiceResult() {
        const dice = this.props.dice;
        return (
            <>
                {
                    Object.keys(dice.rolls)
                        .filter((rollId) => (!dice.history[rollId]))
                        .map((rollId) => (
                            <div className='dieResults' key={'results-for-rollId-' + rollId}>
                                {getDiceResultString(dice, rollId, this.props.connectedUsers, this.props.networkHubId)}
                            </div>
                        ))
                }
                {
                    dice.historyIds.map((rollId) => (
                        <div className='dieResults' key={'history-' + rollId}>
                            {dice.history[rollId]}
                        </div>
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

export function getDiceResultString(dice: DiceReducerType, rollId: string, connectedUsers: ConnectedUserReducerType, networkHubId?: string): string {
    const diceIds = Object.keys(dice.rollingDice).filter((dieId) => (dice.rollingDice[dieId].rollId === rollId)).sort();
    const results = diceIds.map((dieId) => {
        const result = dice.rollingDice[dieId].result;
        const face = result === undefined ? undefined : networkHubId ? result[networkHubId] : result.me;
        const diceParameters = dieTypeToParams[dice.rollingDice[dieId].dieType];
        return face !== undefined ? diceParameters.faceToValue(face) : face;
    });
    const name = connectedUsers.users[dice.rolls[rollId].peerId]?.user.displayName || 'Disconnected';
    if (results.length === 1) {
        return `${name} rolled: ${results.map((roll) => (roll === undefined ? '...' : roll.toString()))}`;
    } else {
        const total = results.reduce<number>((total, roll) => (roll === undefined ? total : total + roll), 0);
        return `${name} rolled: ${results.map((roll) => (roll === undefined ? '...' : roll.toString())).join(' + ')} = ${total}`;
    }
}