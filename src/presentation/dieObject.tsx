import * as React from 'react';
import {useMemo} from 'react';
import * as THREE from 'three';
import {buildDieGeometry, buildDieMaterials, DieShapeEnum, isDieShapeResultFaceInverted} from '../util/dieObjectUtils';

export interface DieObjectProps {
    type: string;
    size?: number;
    fontColour?: string;
    dieColour?: string;
    dieRef?: any;
    hidden?: boolean;
    userData?: any;
    highlightFace?: number;
}

interface DieObjectParameters {
    shape: DieShapeEnum;
    faceTexts: string[];
    textMargin?: number;
    dieName?: string;
    faceToValue: (face: number) => number;
    geometry?: THREE.BufferGeometry;
}

function identity(face: number) {
    return face;
}

export const dieTypeToParams: {[type: string]: DieObjectParameters} = {
    'd4': {
        shape: DieShapeEnum.d4,
        faceTexts: ['2,4,3', '1,3,4', '2,1,4', '1,2,3'],
        faceToValue: identity
    },
    'd6': {
        shape: DieShapeEnum.d6,
        faceTexts: ['1', '2', '3', '4', '5', '6'],
        faceToValue: identity
    },
    'd8': {
        shape: DieShapeEnum.d8,
        faceTexts: ['1', '2', '3', '4', '5', '6', '7', '8'],
        faceToValue: identity
    },
    'd10': {
        shape: DieShapeEnum.d10,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10'],
        faceToValue: identity
    },
    'd12': {
        shape: DieShapeEnum.d12,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10', '11', '12'],
        faceToValue: identity
    },
    'd20': {
        shape: DieShapeEnum.d20,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10',
            '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
        faceToValue: identity
    },
    'd%': {
        shape: DieShapeEnum.d10,
        faceTexts: ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'],
        textMargin: 1.5,
        faceToValue: (face) => (10 * (face - 1))
    },
    'd10.0': {
        shape: DieShapeEnum.d10,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '0'],
        faceToValue: (face) => (face % 10),
        dieName: 'd%'
    }
};

export function isDieTypeResultFaceInverted(type: string) {
    const params = dieTypeToParams[type];
    if (!params) {
        throw new Error('Unknown die type ' + type);
    }
    return isDieShapeResultFaceInverted(params.shape);
}

export default function DieObject(props: DieObjectProps): React.ReactElement | null {

    const size = props.size || 1;
    const fontColour = props.fontColour || 'white';
    const dieColour = props.dieColour || 'black';
    const highlightFace = props.highlightFace;

    const params = dieTypeToParams[props.type];
    if (!params) {
        throw new Error('Unknown die type ' + props.type);
    }

    const geometry = useMemo(() => (
        buildDieGeometry(params.shape)
    ), [params.shape]);

    const fadeFontColour = useMemo(() => {
        // Ensure fontColour is in hex format, then add alpha.
        const colour = new THREE.Color(fontColour);
        return '#' + colour.getHexString() + '33';
    }, [fontColour]);

    const material = useMemo(() => (
        buildDieMaterials(params.shape, params.faceTexts, dieColour, fontColour, params.textMargin, fadeFontColour, highlightFace)
    ), [params.shape, params.faceTexts, params.textMargin, dieColour, fontColour, fadeFontColour, highlightFace]);

    return (
        <mesh geometry={geometry} material={material} ref={props.dieRef} scale={size} visible={!props.hidden} userData={props.userData} />
    );
};
