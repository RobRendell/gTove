import {FunctionComponent} from 'react';
import {shallowEqual, useSelector} from 'react-redux';

import {getScenarioFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import {GridType} from '../util/storage/storageContract';
import {TabletopBlankGrid} from './tabletopBlankGrid';
import {TabletopMapWrapper} from './tabletopMapWrapper';

interface TabletopMapLayerProps extends GtoveDispatchProp {
    interestLevelY: number;
    cameraLookingDown: boolean;
    defaultGrid: GridType;
    gmView: boolean;
    snapToGrid: boolean;
    selectedMapId?: string;
}

export const TabletopMapLayer: FunctionComponent<TabletopMapLayerProps> = ({dispatch, interestLevelY, cameraLookingDown, defaultGrid, gmView, snapToGrid, selectedMapId}) => {
    const mapIds = useSelector((store: ReduxStoreType) => (
        Object.keys(getScenarioFromStore(store).maps)
    ), shallowEqual);

    return mapIds.length === 0 ? (
        <TabletopBlankGrid grid={defaultGrid} />
    ) : (
        <>
            {
                mapIds.map((mapId) => (
                    <TabletopMapWrapper key={mapId} mapId={mapId} interestLevelY={interestLevelY}
                                        cameraLookingDown={cameraLookingDown}
                                        dispatch={dispatch} gmView={gmView} snapToGrid={snapToGrid}
                                        isSelected={mapId === selectedMapId}
                    />
                ))
            }
        </>
    );
};