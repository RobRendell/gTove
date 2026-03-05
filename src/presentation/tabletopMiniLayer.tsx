import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import {FunctionComponent, memo, useCallback} from 'react';
import {shallowEqual, useSelector, useStore} from 'react-redux';

import {useMapPathData} from '../hooks/useMapPathData';
import {getScenarioFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {getGridTypeOfMap, PiecesRosterColumn, snapMini, TabletopType} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {SnapMiniToTabletopType, TabletopMiniWrapper} from './tabletopMiniWrapper';

interface TabletopMiniLayerProps {
    defaultGrid: GridType;
    snapToGrid: boolean;
    adjustingScale: boolean;
    showMiniNames: boolean;
    interestLevelY: number;
    cameraLookingDown: boolean;
    topDown: boolean;
    gmView: boolean;
    nearColumns: PiecesRosterColumn[];
    simpleNearColumns: PiecesRosterColumn[];
    tabletop: TabletopType;
    labelSize: number;
}

export const TabletopMiniLayer: FunctionComponent<TabletopMiniLayerProps> = memo(({
                                                                                      defaultGrid,
                                                                                      snapToGrid,
                                                                                      adjustingScale,
                                                                                      showMiniNames,
                                                                                      interestLevelY,
                                                                                      cameraLookingDown,
                                                                                      topDown,
                                                                                      gmView,
                                                                                      nearColumns,
                                                                                      simpleNearColumns,
                                                                                      tabletop,
                                                                                      labelSize
                                                                                  }) => {
    const {rootMiniIds, attachedMinisMap, polygonOffsetMap} = useSelector(rootMinisAndAttachedMinisMapSelector);
    const mapPathData = useMapPathData();

    // Create some functions which use data from the store, but don't change referentially when the store data changes.
    // TODO when tabletopViewComponent is functional, consider defining these there and passing them as props, instead
    //  of this component requiring props for defaultGrid, adjustingScale and tabletop
    const store = useStore();
    const getGridTypeOfMapId = useCallback((mapId?: string) => (
        !mapId ? defaultGrid
            : getGridTypeOfMap(getScenarioFromStore(store.getState()).maps[mapId], defaultGrid)
    ), [defaultGrid, store]);
    const snapMiniToTabletop = useCallback<SnapMiniToTabletopType>((positionObj, elevation, rotationObj, scale, selectedBy, onMapId) => {
        const snapped = snapMini(snapToGrid && !!selectedBy, getGridTypeOfMapId(onMapId), scale, positionObj, elevation, rotationObj);
        if (!adjustingScale) {
            // Don't actually snap scaleFactor unless we're actually adjusting scale.
            snapped.scaleFactor = scale;
        }
        return snapped;
    }, [adjustingScale, getGridTypeOfMapId, snapToGrid]);

    return (
        <>
            {
                rootMiniIds.map((miniId) => (
                    <TabletopMiniWrapper key={miniId} miniId={miniId} polygonOffsetMap={polygonOffsetMap}
                                         snapMiniToTabletop={snapMiniToTabletop} attachedMinisMap={attachedMinisMap}
                                         interestLevelY={interestLevelY} cameraLookingDown={cameraLookingDown}
                                         topDown={topDown} gmView={gmView} showMiniNames={showMiniNames}
                                         nearColumns={nearColumns} simpleNearColumns={simpleNearColumns}
                                         labelSize={labelSize} labelColour={tabletop.labelColour}
                                         snapToGrid={snapToGrid} mapPathData={mapPathData}
                    />
                ))
            }
        </>
    );
});

// This selector only emits a new array if mini IDs are added or removed
const selectMiniIds = createSelector(
    [(state: ReduxStoreType) => getScenarioFromStore(state).minis],
    (minis) => Object.keys(minis),
    {
        memoize: lruMemoize,
        memoizeOptions: {resultEqualityCheck: shallowEqual}
    }
);

// This selector only emits a new array if an attachment relationships change
const selectAttachmentIds = createSelector(
    [(state: ReduxStoreType) => getScenarioFromStore(state).minis],
    (minis) => Object.values(minis).map(m => m.attachMiniId),
    {
        memoize: lruMemoize,
        memoizeOptions: {resultEqualityCheck: shallowEqual}
    }
);

// To reduce z-fighting, give every mini a different (tiny) polygon offset.
const POLYGON_OFFSET = -0.025;

// This selector returns the miniIds that are not attached to any others (rootMiniIds) and a map from miniIds to arrays
// of any attached minis (attachedMinisMap), allowing us to efficiently render the minis in a THREE.js object tree, with
// attached minis as child objects of their parent. Also return a map of unique polygonOffset values for each mini.
const rootMinisAndAttachedMinisMapSelector = createSelector(
    // The memoized output of the below two input selectors ensures the output selector isn't re-evaluated unless the
    // input values actually change (i.e. the combined selector will not trigger a re-render for irrelevant changes to
    // the minis slice such as updates to a mini's name or position, and will just return its memoized result if the
    // calling component is otherwise re-rendered).
    [selectMiniIds, selectAttachmentIds],
    (miniIds, attachedMiniIds) => {
        const rootMiniIds: string[] = [];
        const attachedMinisMap: {[miniId: string]: string[]} = {};
        attachedMiniIds.forEach((attachMiniId, index) => {
            const miniId = miniIds[index];
            if (!attachMiniId) {
                rootMiniIds.push(miniId);
            } else {
                if (!attachedMinisMap[attachMiniId]) {
                    attachedMinisMap[attachMiniId] = [miniId];
                } else {
                    attachedMinisMap[attachMiniId].push(miniId);
                }
            }
        });
        const polygonOffsetMap = Object.fromEntries(
            miniIds.map((miniId, index) => ([miniId, index * POLYGON_OFFSET]))
        );
        return {rootMiniIds, attachedMinisMap, polygonOffsetMap};
    }
);