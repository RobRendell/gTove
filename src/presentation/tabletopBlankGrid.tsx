import {FunctionComponent} from 'react';

import {cartesianToHexCoords} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import TabletopGridComponent from './tabletopGridComponent';
import TabletopMapComponent from './tabletopMapComponent';

interface TabletopBlankGridProps {
    grid: GridType;
}

export const TabletopBlankGrid: FunctionComponent<TabletopBlankGridProps> = ({grid}) => {
    const size = 40.02;
    let dx = 0, dy = 0;
    if (grid === GridType.HEX_HORZ || grid === GridType.HEX_VERT) {
        const {strideX, centreX, strideY, centreY} = cartesianToHexCoords(size / 2, size / 2, grid);
        dx = size / 2 - (1 - centreX) * strideX;
        dy = size / 2 - (1 - centreY) * strideY;
    }
    return (
        <group position={TabletopMapComponent.MAP_OFFSET_DOWN}>
            <TabletopGridComponent width={size} height={size} dx={dx} dy={dy} gridType={grid} colour='#444444' renderOrder={0} />
        </group>
    );
};