import {FunctionComponent, useState} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';

import {
    getPiecesRosterDisplayValue,
    isNameColumn,
    PiecesRosterColumn,
    PiecesRosterValues
} from '../util/scenarioUtils';
import LabelSprite from './labelSprite';
import {reverseEuler} from '../util/threeUtils';

interface RosterColumnValuesLabelProps {
    label: string;
    labelSize: number;
    renderOrder: number;
    piecesRosterColumns: PiecesRosterColumn[];
    piecesRosterValues: PiecesRosterValues;
    position: THREE.Vector3;
    inverseScale?: THREE.Vector3;
    maxWidth?: number;
    rotation?: THREE.Euler;
}

const POSITION_OFFSET = new THREE.Vector3(0, 1, 0);

const RosterColumnValuesLabel: FunctionComponent<RosterColumnValuesLabelProps> =
    ({label, labelSize, renderOrder, piecesRosterColumns, piecesRosterValues, position, inverseScale, maxWidth, rotation}) => {
        const [numLines, setNumLines] = useState<{[id: string]: number}>({});
        const {camera} = useThree();
        if (piecesRosterColumns.length === 0) {
            return null;
        }
        const offset = POSITION_OFFSET.clone().applyQuaternion(camera.quaternion);
        if (rotation) {
            offset.applyEuler(reverseEuler(rotation));
        }
        if (inverseScale) {
            offset.x /= inverseScale.x;
            offset.y /= inverseScale.y;
            offset.z /= inverseScale.z;
        }
        let totalDistance = 0;
        return (
            <>
                {
                    piecesRosterColumns.map((column) => {
                        const text = isNameColumn(column) ? label : getPiecesRosterDisplayValue(column, piecesRosterValues);
                        if (!text.trim()) {
                            return null;
                        }
                        const distance = labelSize * (numLines[column.id] ? numLines[column.id] : 1);
                        const labelPosition = position.clone().addScaledVector(offset, totalDistance);
                        totalDistance += distance;
                        return (
                            <LabelSprite key={column.id} label={text} labelSize={labelSize} position={labelPosition}
                                         renderOrder={renderOrder + labelPosition.y}
                                         inverseScale={inverseScale} maxWidth={maxWidth}
                                         onLineHeightChange={(height) => {
                                             setNumLines((numLines) => {
                                                 if (numLines[column.id] !== height) {
                                                     return {...numLines, [column.id]: height};
                                                 } else {
                                                     return numLines;
                                                 }
                                             });
                                         }}
                            />
                        );
                    })
                }
            </>
        )
    };

export default RosterColumnValuesLabel;