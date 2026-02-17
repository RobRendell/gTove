import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import isEqual from 'lodash/isEqual';
import {FunctionComponent, memo, useCallback, useMemo} from 'react';
import {shallowEqual, useSelector, useStore} from 'react-redux';

import {getScenarioFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    DistanceMode,
    DistanceRound,
    getGridTypeOfMap,
    MapPathData,
    PiecesRosterColumn,
    snapMini,
    TabletopType
} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {SnapMiniToTabletopType, TabletopMiniWrapper} from './tabletopMiniWrapper';

function selectMapPathDataFromStore(state: ReduxStoreType) {
    const maps = getScenarioFromStore(state).maps;
    return Object.fromEntries(
        Object.keys(maps).map((mapId) => ([mapId, {
            gridType: maps[mapId].metadata.properties?.gridType || GridType.NONE,
            rotation: maps[mapId].rotation.y
        }]))
    ) satisfies MapPathData
}

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
    const {rootMiniIds, attachedMinisMap} = useSelector(rootMinisAndAttachedMinisMapSelector);
    // Project out just the data from all maps needed to render the paths.
    const mapPathData = useSelector(selectMapPathDataFromStore, isEqual);

    // To reduce z-fighting, give every mini a different (tiny) vertical offset.
    const deltaY = useMemo(() => (
        rootMiniIds.length === 0 ? 0 : (0.01 / rootMiniIds.length)
    ), [rootMiniIds.length]);

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
    const getMapIdProperties = useCallback((mapId?: string) => {
        const onMapProperties = !mapId ? undefined : getScenarioFromStore(store.getState()).maps[mapId]?.metadata.properties;
        return {
            distanceMode: onMapProperties?.distanceMode ?? tabletop.distanceMode ?? DistanceMode.STRAIGHT,
            distanceRound: onMapProperties?.distanceRound ?? tabletop.distanceRound ?? DistanceRound.ROUND_OFF,
            gridScale: onMapProperties?.gridScale ?? tabletop.gridScale,
            gridUnit: onMapProperties?.gridUnit ?? tabletop.gridUnit
        }
    }, [store, tabletop.distanceMode, tabletop.distanceRound, tabletop.gridScale, tabletop.gridUnit]);

    return (
        <>
            {
                rootMiniIds.map((miniId, index) => (
                    <TabletopMiniWrapper key={miniId} miniId={miniId} yOffset={deltaY * index}
                                         snapMiniToTabletop={snapMiniToTabletop} attachedMinisMap={attachedMinisMap}
                                         getMapIdProperties={getMapIdProperties} interestLevelY={interestLevelY}
                                         cameraLookingDown={cameraLookingDown} topDown={topDown}
                                         gmView={gmView} showMiniNames={showMiniNames}
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

// This custom selector uses the memoized output of the above two selectors to ensure the output selector doesn't get
// re-evaluated unless those values actually change (so it ignores changes to the minis slice which just update e.g. a
// mini's name or position). The output selector calculates the miniIds that are not attached to any others (the
// rootMiniIds) and a map from miniIds to arrays of any attached minis, allowing us to efficiently render the minis in a
// THREE.js object tree, with attached minis as child objects of their parent.
const rootMinisAndAttachedMinisMapSelector = createSelector(
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
        })
        return {rootMiniIds, attachedMinisMap};
    }
);