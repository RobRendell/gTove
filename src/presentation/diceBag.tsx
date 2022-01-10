import * as React from 'react';
import {omit} from 'lodash';
import * as PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import {connect} from 'react-redux';

import d4 from './images/d4.png';
import d6 from './images/d6.png';
import d8 from './images/d8.png';
import d10 from './images/d10.png';
import d12 from './images/d12.png';
import d20 from './images/d20.png';
import blankD4 from './images/blank_d4.png';
import blankD6 from './images/blank_d6.png';
import blankD8 from './images/blank_d8.png';
import blankD10 from './images/blank_d10.png';
import blankD12 from './images/blank_d12.png';
import blankD20 from './images/blank_d20.png';

import './diceBag.scss';

import {DieShapeEnum} from '../util/dieObjectUtils';
import InputButton from './inputButton';
import {addDiceAction, AddDieType, clearDiceAction, DiceReducerType} from '../redux/diceReducer';
import {getDiceBagFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {MovableWindowContext} from './movableWindow';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {DiceBagReducerType} from '../redux/diceBagReducer';

const shapeToImage = {
    [DieShapeEnum.d4]: [d4, blankD4],
    [DieShapeEnum.d6]: [d6, blankD6],
    [DieShapeEnum.d8]: [d8, blankD8],
    [DieShapeEnum.d10]: [d10, blankD10],
    [DieShapeEnum.d12]: [d12, blankD12],
    [DieShapeEnum.d20]: [d20, blankD20]
}

interface DiceBagProps extends GtoveDispatchProp {
    dice: DiceReducerType;
    userDiceColours: {diceColour: string, textColour: string};
    onClose: () => void;
    myPeerId: string;
    connectedUsers: ConnectedUserReducerType;
    pinOpen?: boolean;
    diceBag: DiceBagReducerType;
}

interface DiceBagState {
    dicePool?: {
        [dieType: string]: {
            count: number;
        }
    };
}

class DiceBag extends React.Component<DiceBagProps, DiceBagState> {

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

    adjustDicePool(dieType: string, delta = 1) {
        const dicePool = this.state.dicePool!;
        const count = dicePool[dieType] ? dicePool[dieType].count : 0;
        if (count + delta <= 0) {
            this.setState({dicePool: omit(dicePool, dieType)})
        } else {
            this.setState({
                dicePool: {
                    ...dicePool,
                    [dieType]: {
                        count: count + delta
                    }
                }
            });
        }
    }

    private getMyRollId() {
        return Object.keys(this.props.dice.rolls).find((rollId) => (this.props.dice.rolls[rollId].peerId === this.props.myPeerId));
    }

    private renderDieImage(dieType: string) {
        const {shape, buttonLabel, buttonUseBlank, labelX, labelY} = this.props.diceBag.dieType[dieType];
        const index = buttonUseBlank ? 1 : 0;
        const src = shapeToImage[shape][index];
        return (
            <div className='dieImage'>
                <img src={src} alt={dieType}/>
                {
                    buttonLabel === undefined ? null : (
                        <span className='dieButtonLabel' style={{
                            left: (labelX === undefined ? 50 : labelX) + '%',
                            top: (labelY === undefined ? 50 : labelY) + '%'
                        }}>{buttonLabel}</span>
                    )
                }
            </div>
        );
    }

    renderDieButton(dieType: string) {
        const {poolName} = this.props.diceBag.dieType[dieType];
        if (poolName !== undefined && dieType !== poolName) {
            return null;
        }
        const myRollId = this.getMyRollId();
        const disabled = ((!this.state.dicePool && myRollId !== undefined && this.props.dice.rolls[myRollId].busy > 0)
            || (this.state.dicePool && poolName !== undefined));
        return (
            <InputButton key={'dieButton-' + dieType} type='button' disabled={disabled} onChange={() => {
                if (this.state.dicePool) {
                    this.adjustDicePool(dieType);
                } else {
                    const {diceColour: dieColour, textColour} = this.props.userDiceColours;
                    const name = this.props.connectedUsers.users[this.props.myPeerId]?.user.displayName;
                    const dice: AddDieType[] = [{dieType, dieColour, textColour}];
                    if (poolName) {
                        for (let otherName of this.props.diceBag.dieTypeNames) {
                            if (otherName !== dieType && this.props.diceBag.dieType[otherName].poolName === poolName) {
                                dice.push({dieType: otherName, dieColour, textColour});
                            }
                        }
                    }
                    this.props.dispatch(addDiceAction(dice, this.props.myPeerId, name));
                    this.closeIfNotPoppedOut();
                }
            }}>
                {this.renderDieImage(dieType)}
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
                    {
                        this.props.diceBag.dieTypeNames.map((dieName) => (
                            this.renderDieButton(dieName))
                        )
                    }
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
                                    <div key={dieType} onClick={() => {this.adjustDicePool(dieType, -1)}}>
                                        {this.renderDieImage(dieType)}
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

function mapStoreToProps(store: ReduxStoreType) {
    return {
        diceBag: getDiceBagFromStore(store)
    }
}

export default connect(mapStoreToProps)(DiceBag);