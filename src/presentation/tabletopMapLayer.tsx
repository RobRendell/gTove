import {FunctionComponent, memo} from 'react';
import {shallowEqual, useSelector} from 'react-redux';

import {getScenarioFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import {GridType} from '../util/storage/storageContract';
import {TabletopBlankGrid} from './tabletopBlankGrid';
import {TabletopMapWrapper} from './tabletopMapWrapper';

function selectMapIdsFromStore(store: ReduxStoreType) {
    return Object.keys(getScenarioFromStore(store).maps);
}

interface TabletopMapLayerProps extends GtoveDispatchProp {
    interestLevelY: number;
    cameraLookingDown: boolean;
    defaultGrid: GridType;
    gmView: boolean;
    snapToGrid: boolean;
    selectedMapId?: string;
}

export const TabletopMapLayer: FunctionComponent<TabletopMapLayerProps> = memo(({dispatch, interestLevelY, cameraLookingDown, defaultGrid, gmView, snapToGrid, selectedMapId}) => {
    const mapIds = useSelector(selectMapIdsFromStore, shallowEqual);

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
});