import {v4} from 'uuid';
import {Action} from 'redux';
import {NetworkedAction} from '../util/types';

// =========================== Action types and generators

enum DiceReducerActionTypes {
    ADD_DICE_ACTION = 'add-dice-action',
    SET_DIE_RESULT_ACTION = 'set-die-result-action',
    CLEAR_DICE_ACTION = 'clear-dice-action'
}

interface AddDiceActionType extends Action {
    type: DiceReducerActionTypes.ADD_DICE_ACTION;
    diceTypes: string[];
    diceIds: string[];
    diceColour: string[];
    textColour: string[];
    rollId: string;
    peerKey: string;
}

export function addDiceAction(diceColour: string | string[], textColour: string | string[], diceTypes: string[]): AddDiceActionType {
    const diceIds: string[] = [];
    for (let count = 0; count < diceTypes.length; ++count) {
        diceIds.push(v4());
    }
    return {
        type: DiceReducerActionTypes.ADD_DICE_ACTION, diceTypes, diceIds,
        diceColour: Array.isArray(diceColour) ? diceColour : [diceColour],
        textColour: Array.isArray(textColour) ? textColour : [textColour],
        rollId: v4(), peerKey: 'add'
    };
}

interface SetDieResultActionType extends NetworkedAction {
    type: DiceReducerActionTypes.SET_DIE_RESULT_ACTION;
    dieId: string;
    result: number;
    peerKey: string;
}

export function setDieResultAction(dieId: string, result: number): SetDieResultActionType {
    return {type: DiceReducerActionTypes.SET_DIE_RESULT_ACTION, dieId, result, peerKey: 'result' + dieId};
}

interface ClearDiceActionType extends Action {
    type: DiceReducerActionTypes.CLEAR_DICE_ACTION;
    peerKey: string;
}

export function clearDiceAction() {
    return {type: DiceReducerActionTypes.CLEAR_DICE_ACTION, peerKey: 'clear'};
}

type DieReducerActionType = AddDiceActionType | SetDieResultActionType | ClearDiceActionType;

// =========================== Reducers

interface SingleDieReducerType {
    dieType: string;
    index: number;
    result?: {[peedId: string]: number};
    dieColour: string;
    textColour: string;
}

export interface DiceReducerType {
    busy: number;
    rolling: {[id: string] : SingleDieReducerType};
    rollId: string;
}

const initialDiceReducerType = {busy: 0, rolling: {}, rollId: ''};

export default function diceReducer(state: DiceReducerType = initialDiceReducerType, action: DieReducerActionType): DiceReducerType {
    switch (action.type) {
        case DiceReducerActionTypes.ADD_DICE_ACTION:
            const diceColourLength = action.diceColour.length;
            const textColourLength = action.textColour.length;
            return {
                busy: state.busy + action.diceIds.length,
                rolling: {
                    ...action.diceIds.reduce<{[key: string]: SingleDieReducerType}>((allDice, dieId, index) => {
                        allDice[dieId] = {
                            dieType: action.diceTypes[index],
                            index,
                            dieColour: index < diceColourLength ? action.diceColour[index] : action.diceColour[diceColourLength - 1],
                            textColour: index < textColourLength ? action.textColour[index] : action.textColour[textColourLength - 1]
                        };
                        return allDice;
                    }, {})
                },
                rollId: action.rollId
            };
        case DiceReducerActionTypes.SET_DIE_RESULT_ACTION:
            const dieState = state.rolling[action.dieId];
            if (!dieState) {
                // received result for die roll we don't know about - perhaps we joined mid-roll?
                return state;
            }
            return {
                busy: dieState.result === undefined ? state.busy - 1 : state.busy,
                rolling: {
                    ...state.rolling,
                    [action.dieId]: {
                        ...dieState,
                        result: {
                            ...dieState.result,
                            [action.originPeerId || 'me']: action.result
                        }
                    }
                },
                rollId: state.rollId
            };
        case DiceReducerActionTypes.CLEAR_DICE_ACTION:
            return initialDiceReducerType;
        default:
            return state;
    }
}