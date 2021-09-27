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
import dPercent from './images/dPercent.png';

import './diceBag.scss';

import InputButton from './inputButton';
import {addDiceAction, AddDieType, clearDiceAction, DiceReducerType} from '../redux/diceReducer';
import {GtoveDispatchProp} from '../redux/mainReducer';
import {MovableWindowContext} from './movableWindow';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';

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
                    const dice: AddDieType[] = [{dieType, dieColour: diceColour, textColour}];
                    this.props.dispatch(addDiceAction(dice, this.props.myPeerId, name));
                    this.closeIfNotPoppedOut();
                }
            }}>
                <img src={imgSrc} alt={dieType}/>
            </InputButton>
        );
    }

    rollPool() {
        if (this.state.dicePool) {
            const {diceColour, textColour} = this.props.userDiceColours;
            const dicePool: AddDieType[] = [];
            for (let dieType of Object.keys(this.state.dicePool)) {
                const pool = this.state.dicePool[dieType];
                for (let count = 0; count < pool.count; ++count) {
                    dicePool.push({
                        dieType,
                        dieColour: diceColour,
                        textColour
                    });
                }
            }
            const name = this.props.connectedUsers.users[this.props.myPeerId]?.user.displayName;
            this.props.dispatch(addDiceAction(dicePool, this.props.myPeerId, name));
            this.setState({dicePool: this.context.windowPoppedOut || this.props.pinOpen ? {} : undefined});
            this.closeIfNotPoppedOut();
        }
    }

    renderDiceResult() {
        const dice = this.props.dice;
        return (
            dice.historyIds.map((rollId) => (
                <ReactMarkdown className='dieResults' key={'history-' + rollId}>{dice.history[rollId]}</ReactMarkdown>
            ))
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
                        const name = this.props.connectedUsers.users[this.props.myPeerId]?.user.displayName;
                        const dice: AddDieType[] = [
                            {dieType: 'd%', dieColour: diceColour, textColour},
                            {dieType: 'd10.0', dieColour: diceColour, textColour}
                        ]
                        this.props.dispatch(addDiceAction(dice, this.props.myPeerId, name));
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