import {DieShapeEnum} from '../util/dieObjectUtils';

export interface DieDefinitionType {
    poolName?: string;
    shape: DieShapeEnum;
    buttonLabel?: string;
    buttonUseBlank?: boolean;
    labelX?: number;
    labelY?: number;
    faceTexts: string[];
    faceTextSplit?: string;
    textMargin?: number;
    faceToValue?: number[];
}

export interface DiceBagReducerType {
    dieType: {[dieName: string]: DieDefinitionType};
    dieTypeNames: string[];
    dicePoolMode: boolean;
}