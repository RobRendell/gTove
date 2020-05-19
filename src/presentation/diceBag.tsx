import * as React from 'react';
import {omit} from 'lodash';

import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import InputButton from './inputButton';
import {addDiceAction, clearDiceAction, DiceReducerType} from '../redux/diceReducer';
import {GtoveDispatchProp} from '../redux/mainReducer';

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
    onClose: () => void;
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

    constructor(props: DiceBagProps) {
        super(props);
        this.rollPool = this.rollPool.bind(this);
        this.state = {};
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

    renderDieButton(dieType: string, imgSrc: string) {
        const disabled = (!this.state.dicePool && this.props.dice.busy > 0);
        return (
            <InputButton type='button' disabled={disabled} onChange={() => {
                if (this.state.dicePool) {
                    this.adjustDicePool(dieType, imgSrc);
                } else {
                    this.props.dispatch(addDiceAction(dieType));
                    this.props.onClose();
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
            this.props.dispatch(addDiceAction(...dicePool));
            this.setState({dicePool: undefined});
            this.props.onClose();
        }
    }

    render() {
        const dicePool = this.state.dicePool;
        return (
            <OnClickOutsideWrapper onClickOutside={this.props.onClose}>
                <div className='diceBag'>
                    <div className='diceButtons'>
                        {this.renderDieButton('d4', d4)}
                        {this.renderDieButton('d6', d6)}
                        {this.renderDieButton('d8', d8)}
                        {this.renderDieButton('d10', d10)}
                        {this.renderDieButton('d12', d12)}
                        {this.renderDieButton('d20', d20)}
                        <InputButton type='button' disabled={!!this.state.dicePool || this.props.dice.busy > 0} onChange={() => {
                            this.props.dispatch(addDiceAction('d%', 'd10.0'));
                            this.props.onClose();
                        }}>
                            <img src={dPercent} alt='d%'/>
                        </InputButton>
                        <div className='diceControls'>
                            <InputButton type='button'
                                         tooltip={dicePool ? 'Roll single dice' : 'Build a dice pool'}
                                         onChange={() => {
                                             this.setState({dicePool: this.state.dicePool ? undefined: {}});
                                         }}>
                                Pool
                            </InputButton>
                            <InputButton disabled={this.props.dice.busy > 0} type='button'
                                         tooltip='Clear dice from table' onChange={() => {
                                             this.props.dispatch(clearDiceAction()); this.props.onClose();
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
                                        <InputButton type='button' disabled={this.props.dice.busy > 0} onChange={this.rollPool}>
                                            Roll!
                                        </InputButton>
                                    ) : (
                                        <p>Select dice to roll in a pool together.</p>
                                    )
                                }
                            </div>
                        )
                    }
                </div>
            </OnClickOutsideWrapper>
        )
    }
}