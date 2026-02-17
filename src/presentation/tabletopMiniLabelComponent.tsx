import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';

import {MINI_HEIGHT} from '../util/constants';
import {PiecesRosterColumn, PiecesRosterValues} from '../util/scenarioUtils';
import RosterColumnValuesLabel from './rosterColumnValuesLabel';
import {RENDER_ORDER_ADJUST} from './tabletopMiniComponent';

interface TabletopMiniLabelComponentProps {
    prone: boolean;
    topDown: boolean;
    labelSize: number;
    labelColour?: string;
    piecesRosterColumns: PiecesRosterColumn[];
    piecesRosterValues: PiecesRosterValues;
    label: string;
    miniScale: THREE.Vector3;
    renderOrder: number;
}

const TabletopMiniLabelComponent: FunctionComponent<TabletopMiniLabelComponentProps> = (
    {
        prone, topDown, labelSize, labelColour,
        piecesRosterColumns, piecesRosterValues,
        label, miniScale, renderOrder
    }
) => {
    const position = useMemo(() => {
        const position = prone ? new THREE.Vector3(0, 0.5, -MINI_HEIGHT) :
            topDown ? new THREE.Vector3(0, 0.05, 0) :
                new THREE.Vector3(0, MINI_HEIGHT, 0);
        const offset = labelSize / 2 / miniScale.z;
        if (!topDown) {
            position.y += offset;
        }
        return position;
    }, [prone, topDown, labelSize, miniScale]);
    const paddingBottom = useMemo(() => (
        !topDown ? 0 : 0.5 * (miniScale?.x ?? 1)
    ), [miniScale?.x, topDown]);
    return (
        <RosterColumnValuesLabel label={label} maxWidth={800} labelSize={labelSize} labelColour={labelColour}
                                 position={position} inverseScale={miniScale}
                                 renderOrder={renderOrder + position.y + RENDER_ORDER_ADJUST}
                                 piecesRosterColumns={piecesRosterColumns}
                                 piecesRosterValues={piecesRosterValues}
                                 paddingBottom={paddingBottom}
        />
    );
};

export default TabletopMiniLabelComponent;