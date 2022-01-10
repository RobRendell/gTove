import * as React from 'react';
import {useMemo} from 'react';
import * as THREE from 'three';
import {useSelector} from 'react-redux';

import {buildDieGeometry, buildDieMaterials} from '../util/dieObjectUtils';
import {getDiceBagFromStore} from '../redux/mainReducer';

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

export default function DieObject(props: DieObjectProps): React.ReactElement | null {

    const size = props.size || 1;
    const fontColour = props.fontColour || 'white';
    const dieColour = props.dieColour || 'black';
    const highlightFace = props.highlightFace;

    const diceBag = useSelector(getDiceBagFromStore);
    const dieParameters = diceBag.dieType[props.type];
    if (!dieParameters) {
        throw new Error('Unknown die type ' + props.type);
    }

    const geometry = useMemo(() => (
        buildDieGeometry(dieParameters.shape)
    ), [dieParameters.shape]);

    const fadeFontColour = useMemo(() => {
        // Ensure fontColour is in hex format, then add alpha.
        const colour = new THREE.Color(fontColour);
        return '#' + colour.getHexString() + '33';
    }, [fontColour]);

    const material = useMemo(() => (
        buildDieMaterials(dieParameters.shape, dieParameters.faceTexts, dieColour, fontColour, dieParameters.faceTextSplit, dieParameters.textMargin, fadeFontColour, highlightFace)
    ), [dieParameters.shape, dieParameters.faceTexts, dieParameters.textMargin, dieColour, fontColour, dieParameters.faceTextSplit, fadeFontColour, highlightFace]);

    return (
        <mesh geometry={geometry} material={material} ref={props.dieRef} scale={size} visible={!props.hidden} userData={props.userData} />
    );
};
