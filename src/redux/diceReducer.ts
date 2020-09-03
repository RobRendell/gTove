import {v4} from 'uuid';
import {Action} from 'redux';
import {omit} from 'lodash';

import {GToveThunk, NetworkedAction} from '../util/types';
import {getDiceResultString} from '../presentation/diceBag';
import {getConnectedUsersFromStore, getDiceFromStore, ReduxStoreType} from './mainReducer';

// =========================== Action types and generators

enum DiceReducerActionTypes {
    ADD_DICE_ACTION = 'add-dice-action',
    SET_DIE_RESULT_ACTION = 'set-die-result-action',
    ADD_DICE_HISTORY_ACTION = 'add-dice-history-action',
    CLEAR_DICE_ACTION = 'clear-dice-action'
}

interface AddDiceActionType extends NetworkedAction {
    type: DiceReducerActionTypes.ADD_DICE_ACTION;
    diceTypes: string[];
    diceIds: string[];
    diceColour: string[];
    textColour: string[];
    peerId: string;
    rollId: string;
    peerKey: string;
}

function internalAddDiceAction(diceColour: string | string[], textColour: string | string[], peerId: string, diceTypes: string[]): AddDiceActionType {
    const diceIds: string[] = [];
    for (let count = 0; count < diceTypes.length; ++count) {
        diceIds.push(v4());
    }
    const rollId = v4();
    return {
        type: DiceReducerActionTypes.ADD_DICE_ACTION, diceTypes, diceIds,
        diceColour: Array.isArray(diceColour) ? diceColour : [diceColour],
        textColour: Array.isArray(textColour) ? textColour : [textColour],
        peerId, rollId, peerKey: 'add-dice-' + rollId
    };
}

interface SetDieResultActionType extends Action {
    type: DiceReducerActionTypes.SET_DIE_RESULT_ACTION;
    dieId: string;
    result: number;
}

export function setDieResultAction(dieId: string, result: number): SetDieResultActionType {
    return {type: DiceReducerActionTypes.SET_DIE_RESULT_ACTION, dieId, result};
}

interface AddDiceHistoryActionType extends Action {
    type: DiceReducerActionTypes.ADD_DICE_HISTORY_ACTION;
    rollId: string;
    text: string;
}

function addDiceHistoryAction(rollId: string, text: string): AddDiceHistoryActionType {
    return {type: DiceReducerActionTypes.ADD_DICE_HISTORY_ACTION, rollId, text}
}

interface ClearDiceActionType extends Action {
    type: DiceReducerActionTypes.CLEAR_DICE_ACTION;
    peerKey: string;
}

function internalClearDiceAction(): ClearDiceActionType {
    return {type: DiceReducerActionTypes.CLEAR_DICE_ACTION, peerKey: 'clear'};
}

type DieReducerActionType = AddDiceActionType | SetDieResultActionType | AddDiceHistoryActionType | ClearDiceActionType;

function archiveRollsToHistory<T>(state: ReduxStoreType, dispatch: (action: T | AddDiceHistoryActionType) => T | AddDiceHistoryActionType, peerId?: string) {
    const connectedUsers = getConnectedUsersFromStore(state);
    const dice = getDiceFromStore(state);
    for (let rollId of Object.keys(dice.rolls)) {
        if (dice.rolls[rollId].busy === 0 && (peerId === undefined || peerId === dice.rolls[rollId].peerId)) {
            dispatch(addDiceHistoryAction(rollId, getDiceResultString(dice, rollId, connectedUsers)));
        }
    }
}

export const addDiceAction: (diceColour: string | string[], textColour: string | string[], peerId: string, diceTypes: string[]) => GToveThunk<DieReducerActionType>
    = (diceColour, textColour, peerId, diceTypes) => (dispatch, getState) => {
        archiveRollsToHistory(getState(), dispatch, peerId);
        dispatch(internalAddDiceAction(diceColour, textColour, peerId, diceTypes));
    };

export const clearDiceAction: () => GToveThunk<DieReducerActionType>
    = () => (dispatch, getState) => {
        archiveRollsToHistory(getState(), dispatch);
        dispatch(internalClearDiceAction());
    };

// =========================== Reducers

interface SingleDieReducerType {
    dieType: string;
    index: number;
    rollId: string;
    dieColour: string;
    textColour: string;
    result?: number;
}

export interface DiceReducerType {
    rolls: {[rollId: string]: {busy: number, peerId: string}};
    lastRollId: string;
    rollingDice: {[dieId: string] : SingleDieReducerType};
    history: {[rollId: string]: string};
    historyIds: string[];
}

const initialDiceReducerType: DiceReducerType = {
    rolls: {},
    lastRollId: '',
    rollingDice: {},
    history: {},
    historyIds: []
};

export default function diceReducer(state = initialDiceReducerType, action: DieReducerActionType): DiceReducerType {
    switch (action.type) {
        case DiceReducerActionTypes.ADD_DICE_ACTION:
            const diceColourLength = action.diceColour.length;
            const textColourLength = action.textColour.length;
            const previousRollId = Object.keys(state.rolls).find((rollId) => (state.rolls[rollId].peerId === action.peerId));
            return {
                ...state,
                rolls: {
                    ...(previousRollId ? omit(state.rolls, previousRollId) : state.rolls),
                    [action.rollId]: {
                        busy: action.diceIds.length,
                        peerId: action.peerId
                    }
                },
                lastRollId: action.rollId,
                rollingDice: {
                    ...omit(state.rollingDice, Object.keys(state.rollingDice).filter((dieId) => (state.rollingDice[dieId].rollId === previousRollId))),
                    ...action.diceIds.reduce<{[key: string]: SingleDieReducerType}>((allDice, dieId, index) => {
                        allDice[dieId] = {
                            dieType: action.diceTypes[index],
                            index,
                            rollId: action.rollId,
                            dieColour: index < diceColourLength ? action.diceColour[index] : action.diceColour[diceColourLength - 1],
                            textColour: index < textColourLength ? action.textColour[index] : action.textColour[textColourLength - 1]
                        };
                        return allDice;
                    }, {})
                }
            };
        case DiceReducerActionTypes.SET_DIE_RESULT_ACTION:
            const dieState = state.rollingDice[action.dieId];
            if (!dieState) {
                // received result for die roll we don't know about - perhaps we joined mid-roll?
                return state;
            }
            return {
                ...state,
                rolls: {
                    ...state.rolls,
                    [dieState.rollId]: {
                        ...state.rolls[dieState.rollId],
                        busy: dieState.result === undefined ? state.rolls[dieState.rollId].busy - 1 : state.rolls[dieState.rollId].busy
                    }
                },
                rollingDice: {
                    ...state.rollingDice,
                    [action.dieId]: {
                        ...dieState,
                        result: action.result
                    }
                }
            };
        case DiceReducerActionTypes.ADD_DICE_HISTORY_ACTION:
            return {
                ...state,
                history: {
                    ...state.history,
                    [action.rollId]: action.text
                },
                historyIds: [action.rollId, ...state.historyIds]
            };
        case DiceReducerActionTypes.CLEAR_DICE_ACTION:
            const finishedRollIds = Object.keys(state.rolls).filter((rollId) => (state.rolls[rollId].busy === 0));
            const finishedDiceIds = Object.keys(state.rollingDice).filter((dieId) => (finishedRollIds.indexOf(state.rollingDice[dieId].rollId) >= 0));
            return {
                ...state,
                rolls: omit(state.rolls, finishedRollIds),
                rollingDice: omit(state.rollingDice, finishedDiceIds)
            };
        default:
            return state;
    }
}