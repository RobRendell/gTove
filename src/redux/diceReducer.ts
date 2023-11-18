import {createSlice} from '@reduxjs/toolkit';
import {v4} from 'uuid';
import {omit, pick, pickBy, without} from 'lodash';

import {NetworkedPayloadAction} from '../util/types';
import diceBagReducer, {DiceBagReducerType} from './diceBagReducer';

export interface DieResult {
    index: number;
    position: [number, number, number];
    rotation: [number, number, number];
}

interface SingleDieReducerType {
    dieType: string;
    index: number;
    rollId: string;
    dieColour: string;
    textColour: string;
    result?: DieResult;
    definitiveResult?: DieResult;
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];
}

interface DieRollType {
    busy: number;
    diceIds: string[];
    fixedDieIds: string[];
    peerId: string;
    name: string;
    reRollId?: string;
}

export type DiceRollHistory = {
    timestamp?: number;
    name: string;
    reroll: boolean;
    results: {[type: string]: (undefined | { face: string, value: number })[]};
    total?: number
};

export interface DiceReducerType {
    rolls: {[rollId: string]: DieRollType};
    rollIds: string[];
    rollingDice: {[dieId: string] : SingleDieReducerType};
    history: {[rollId: string]: DiceRollHistory};
    historyIds: string[];
    diceBag: DiceBagReducerType;
}

const initialDiceReducerType: DiceReducerType = {
    rolls: {},
    rollIds: [],
    rollingDice: {},
    history: {},
    historyIds: [],
    diceBag: diceBagReducer(undefined, {type: '@@init'})
};

export interface AddDieType {
    dieType: string;
    dieColour: string;
    textColour: string;
    fixedResult?: DieResult;
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];
}

interface AddDiceActionPayloadType {
    dice: AddDieType[];
    diceIds: string[];
    peerId: string;
    name: string;
    rollId: string;
    reRollId?: string;
}

interface SetDieResultActionPayloadType {
    dieId: string;
    resultIndex: number;
    position: [number, number, number];
    rotation: [number, number, number];
}

const diceReducerSlice = createSlice({
    name: 'diceReducer',
    initialState: initialDiceReducerType,
    reducers: {
        addDiceAction: {
            prepare: (dice: AddDieType[], peerId: string, name = 'Disconnected', reRollId?: string) => {
                const rollId = v4();
                const diceIds = dice.map(() => (v4()));
                return {
                    meta: {peerKey: 'add-dice-' + rollId},
                    payload: {dice, diceIds, peerId, name, rollId, reRollId}
                };
            },
            reducer: (state, action: NetworkedPayloadAction<AddDiceActionPayloadType>) => {
                const payload = action.payload;
                const removeRollIds = state.rollIds.filter((rollId) => (state.rolls[rollId].peerId === payload.peerId && state.rolls[rollId].busy <= 0));
                state.rolls = omit(state.rolls, removeRollIds);
                const fixedDieIds = payload.diceIds.filter((_dieId, index) => (payload.dice[index].fixedResult !== undefined));
                state.rolls[payload.rollId] = {
                    busy: payload.dice.length - fixedDieIds.length,
                    diceIds: payload.diceIds,
                    fixedDieIds,
                    peerId: payload.peerId,
                    name: payload.name,
                    reRollId: payload.reRollId
                };
                state.rollIds = [payload.rollId, ...without(state.rollIds, ...removeRollIds)];
                state.rollingDice = pickBy(state.rollingDice, (value) => (removeRollIds.indexOf(value.rollId) < 0));
                payload.diceIds.forEach((dieId, index) => {
                    const die = payload.dice[index];
                    state.rollingDice[dieId] = {
                        dieType: die.dieType,
                        index,
                        rollId: payload.rollId,
                        dieColour: die.dieColour,
                        textColour: die.textColour,
                        result: die.fixedResult,
                        initialPosition: die.initialPosition,
                        initialRotation: die.initialRotation
                    };
                });
                state.historyIds = [payload.rollId, ...state.historyIds];
                state.history[payload.rollId] = getDiceRollHistory(state, payload.rollId);
            }
        },
        setDieResultAction: {
            prepare: (dieId: string, resultIndex: number, position: [number, number, number], rotation: [number, number, number]) => ({
                meta: {peerKey: `result-${dieId}-${Date.now()}`},
                payload: {dieId, resultIndex, position, rotation}
            }),
            reducer: (state, action: NetworkedPayloadAction<SetDieResultActionPayloadType>) => {
                const payload = action.payload;
                const dieState = state.rollingDice[payload.dieId];
                // Check that we have the die roll - we may have joined mid-roll, so missed the addDiceAction.
                if (dieState) {
                    if (action.meta.fromGM) {
                        // Result from the GM
                        dieState.definitiveResult = {index: payload.resultIndex, position: payload.position, rotation: payload.rotation};
                    } else if (!action.meta.originPeerId) {
                        // Result from my local client
                        const lessBusy = (dieState.result === undefined);
                        dieState.result = {index: payload.resultIndex, position: payload.position, rotation: payload.rotation};
                        if (lessBusy) {
                            state.rolls[dieState.rollId].busy--;
                        }
                    } else {
                        return;
                    }
                    state.history[dieState.rollId] = getDiceRollHistory(state, dieState.rollId);
                }
            }
        },
        clearDiceAction: (state) => {
            const finishedRollIds = state.rollIds.filter((rollId) => (state.rolls[rollId].busy <= 0));
            const finishedDiceIds = Object.keys(state.rollingDice).filter((dieId) => (
                state.rolls[state.rollingDice[dieId].rollId].busy <= 0
            ));
            state.rolls = omit(state.rolls, finishedRollIds);
            state.rollIds = without(state.rollIds, ...finishedRollIds);
            state.rollingDice = omit(state.rollingDice, finishedDiceIds);
        },
        clearDiceHistoryAction: (state) => {
            // Discard the history of any rolls that aren't currently in progress
            state.historyIds = state.historyIds.filter((rollId) => (state.rolls[rollId] && state.rolls[rollId].busy > 0));
            state.history = pick(state.history, state.historyIds);
        }
    },
    extraReducers: (builder) => {
        builder.addDefaultCase((state, action) => {
            state.diceBag = diceBagReducer(state.diceBag, action);
        });
    }
});

export const {addDiceAction, setDieResultAction, clearDiceAction, clearDiceHistoryAction} = diceReducerSlice.actions;

export default diceReducerSlice.reducer;

function getDiceRollHistory(dice: DiceReducerType, rollId: string): DiceRollHistory {
    const diceRoll = dice.rolls[rollId];
    return diceRoll.diceIds.reduce<DiceRollHistory>((history, dieId) => {
        const rolling = dice.rollingDice[dieId];
        const diceParameters = dice.diceBag.dieType[rolling.dieType];
        const rollResult = (rolling.result && rolling.definitiveResult && rolling.result.index !== rolling.definitiveResult.index)
            ? rolling.definitiveResult : rolling.result
        const face = rollResult?.index;
        const name = diceParameters.poolName || rolling.dieType;
        history.results[name] = history.results[name] || [];
        if (face === undefined) {
            history.results[name].push(undefined);
        } else {
            const value = diceParameters.faceToValue ? diceParameters.faceToValue[face - 1] : face;
            const fixedValue = (diceRoll.fixedDieIds.indexOf(dieId) >= 0);
            history.results[name].push({
                face: fixedValue ? `_${face}_` : face.toString(),
                value
            });
            if (diceRoll.diceIds.length > 1) {
                history.total = (history.total || 0) + value;
            }
        }
        return history;
    }, {
        timestamp: Date.now(),
        name: diceRoll.name,
        reroll: diceRoll.fixedDieIds.length > 0,
        results: {}
    });
}
