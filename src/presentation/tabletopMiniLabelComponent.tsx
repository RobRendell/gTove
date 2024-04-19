import {FunctionComponent, useMemo} from 'react';

import {reverseEuler} from '../util/threeUtils';
import RosterColumnValuesLabel from './rosterColumnValuesLabel';
import * as THREE from 'three';
import {MINI_HEIGHT} from '../util/constants';
import {PiecesRosterColumn, PiecesRosterValues} from '../util/scenarioUtils';
import {RENDER_ORDER_ADJUST} from './tabletopMiniComponent';

interface TabletopMiniLabelComponentProps {
    prone: boolean;
    topDown: boolean;
    labelSize: number;
    cameraInverseQuat?: THREE.Quaternion;
    piecesRosterColumns: PiecesRosterColumn[];
    piecesRosterValues: PiecesRosterValues;
    label: string;
    miniScale: THREE.Vector3;
    rotation: THREE.Euler;
    renderOrder: number;
}

const TabletopMiniLabelComponent: FunctionComponent<TabletopMiniLabelComponentProps> = (
    {
        prone, topDown, labelSize, cameraInverseQuat,
        piecesRosterColumns, piecesRosterValues,
        label, miniScale, rotation, renderOrder
    }
) => {
    const position = useMemo(() => {
        const position = prone ? new THREE.Vector3(0, 0.5, -MINI_HEIGHT) :
            topDown ? new THREE.Vector3(0, 0, -0.5) :
                new THREE.Vector3(0, MINI_HEIGHT, 0);
        const offset = labelSize / 2 / miniScale.z;
        if (topDown) {
            position.z -= offset;
            if (!prone && cameraInverseQuat) {
                // Rotate the label so it's always above the mini.  This involves cancelling out the mini's local rotation,
                // and also rotating by the camera's inverse rotation around the Y axis (supplied as a prop).
                position.applyEuler(reverseEuler(rotation)).applyQuaternion(cameraInverseQuat);
            }
        } else {
            position.y += offset;
        }
        return position;
    }, [prone, topDown, labelSize, miniScale, rotation, cameraInverseQuat]);
    return (
        <RosterColumnValuesLabel label={label} maxWidth={800}
                                 labelSize={labelSize} position={position} inverseScale={miniScale}
                                 rotation={rotation} renderOrder={renderOrder + position.y + RENDER_ORDER_ADJUST}
                                 piecesRosterColumns={piecesRosterColumns}
                                 piecesRosterValues={piecesRosterValues}
        />
    );
};

export default TabletopMiniLabelComponent;