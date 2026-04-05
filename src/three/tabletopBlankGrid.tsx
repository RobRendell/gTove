import {FunctionComponent} from 'react';
import {useSelector} from 'react-redux';

import {getTabletopFromStore} from '../redux/mainReducer';
import {cartesianToHexCoords} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import TabletopGridComponent from './tabletopGridComponent';
import TabletopMapComponent from './tabletopMapComponent';

export const TabletopBlankGrid: FunctionComponent = () => {
    const {defaultGrid} = useSelector(getTabletopFromStore);
    
    const size = 40.02;
    let dx = 0, dy = 0;
    if (defaultGrid === GridType.HEX_HORZ || defaultGrid === GridType.HEX_VERT) {
        const {strideX, centreX, strideY, centreY} = cartesianToHexCoords(size / 2, size / 2, defaultGrid);
        dx = size / 2 - (1 - centreX) * strideX;
        dy = size / 2 - (1 - centreY) * strideY;
    }
    return (
        <group position={TabletopMapComponent.MAP_OFFSET_DOWN}>
            <TabletopGridComponent width={size} height={size} dx={dx} dy={dy} gridType={defaultGrid} colour='#444444' renderOrder={0} />
        </group>
    );
};