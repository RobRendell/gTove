import {DiceBagReducerType} from './diceBagReducerTypes';

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
    spin?: number;
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
    results: {[type: string]: (undefined | {face: string, value: number})[]};
    total?: number
};

export interface DiceReducerType {
    rolls: {[rollId: string]: DieRollType};
    rollIds: string[];
    rollingDice: {[dieId: string]: SingleDieReducerType};
    history: {[rollId: string]: DiceRollHistory};
    historyIds: string[];
    diceBag: DiceBagReducerType;
}

export interface AddDieType {
    dieType: string;
    dieColour: string;
    textColour: string;
    fixedResult?: DieResult;
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];
    spin?: number;
}

export interface AddDiceActionPayloadType {
    dice: AddDieType[];
    diceIds: string[];
    peerId: string;
    name: string;
    rollId: string;
    reRollId?: string;
}

export interface SetDieResultActionPayloadType {
    dieId: string;
    resultIndex: number;
    position: [number, number, number];
    rotation: [number, number, number];
}