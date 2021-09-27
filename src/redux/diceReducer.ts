import {createSlice} from '@reduxjs/toolkit';
import {v4} from 'uuid';
import {omit, pickBy, without} from 'lodash';

import {NetworkedPayloadAction} from '../util/types';
import {dieTypeToParams} from '../presentation/dieObject';
import {compareAlphanumeric} from '../util/stringUtils';

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

export interface DiceReducerType {
    rolls: {[rollId: string]: {busy: number, fixedDieIds: string[], peerId: string, name: string, reRollId?: string}};
    rollIds: string[];
    lastRollId: string;
    rollingDice: {[dieId: string] : SingleDieReducerType};
    history: {[rollId: string]: string};
    historyIds: string[];
}

const initialDiceReducerType: DiceReducerType = {
    rolls: {},
    lastRollId: '',
    rollIds: [],
    rollingDice: {},
    history: {},
    historyIds: []
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
                const diceIds = Array.from({length: dice.length}).map(() => (v4()))
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
                    fixedDieIds,
                    peerId: payload.peerId,
                    name: payload.name,
                    reRollId: payload.reRollId
                };
                state.lastRollId = payload.rollId;
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
                state.history[payload.rollId] = getDiceResultString(state, payload.rollId);
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
                    state.history[dieState.rollId] = getDiceResultString(state, dieState.rollId);
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
        }
    }
});

export const {addDiceAction, setDieResultAction, clearDiceAction} = diceReducerSlice.actions;

export default diceReducerSlice.reducer;

function getDiceResultString(dice: DiceReducerType, rollId: string): string {
    const diceIds = Object.keys(dice.rollingDice).filter((dieId) => (dice.rollingDice[dieId].rollId === rollId));
    const diceValues = diceIds.map((dieId) => {
        const rolling = dice.rollingDice[dieId];
        const diceParameters = dieTypeToParams[rolling.dieType];
        const result = (rolling.result && rolling.definitiveResult && rolling.result.index !== rolling.definitiveResult.index)
            ? rolling.definitiveResult : rolling.result
        const face = result?.index;
        return face !== undefined ? diceParameters.faceToValue(face) : undefined;
    });
    const total = diceValues.reduce<number>((total, value) => (total + (value || 0)), 0);
    const resultsPerType = diceIds.reduce((results, dieId, index) => {
        const rolling = dice.rollingDice[dieId];
        const diceParameters = dieTypeToParams[rolling.dieType];
        const fixedValue = (dice.rolls[rollId].fixedDieIds.indexOf(dieId) >= 0);
        const stringValue = diceValues[index] === undefined ? '...' : fixedValue ? `_${diceValues[index]}_` : diceValues[index];
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
    const rolled = (dice.rolls[rollId].fixedDieIds.length > 0) ? 're-rolled' : 'rolled';
    return `${dice.rolls[rollId].name} ${rolled} ${resultStrings.join('; ')}${(diceIds.length === 1) ? '' : ` = **${total}**`}`;
}
