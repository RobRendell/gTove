import {FunctionComponent, useCallback, useMemo} from 'react';
import {useSelector, useStore} from 'react-redux';

import MetadataLoaderContainer from '../container/metadataLoaderContainer';
import {getMyPeerIdFromStore, getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import {calculateMapProperties, MapType, snapMap, SnapMapResult} from '../util/scenarioUtils';
import {castMapProperties} from '../util/storage/storageUtils';
import TabletopMapComponent from './tabletopMapComponent';
import TabletopViewComponent from './tabletopViewComponent';

interface TabletopMapWrapperProps extends GtoveDispatchProp {
    mapId: string;
    interestLevelY: number;
    cameraLookingDown: boolean;
    gmView: boolean;
    snapToGrid: boolean;
    isSelected: boolean;
}

export const TabletopMapWrapper: FunctionComponent<TabletopMapWrapperProps> = ({
                                                                                   dispatch,
                                                                                   mapId,
                                                                                   interestLevelY,
                                                                                   cameraLookingDown,
                                                                                   gmView,
                                                                                   snapToGrid,
                                                                                   isSelected
                                                                               }) => {
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const selectSpecificMiniFromStore = useCallback((store: ReduxStoreType) => (
        getScenarioFromStore(store).maps[mapId]
    ), [mapId]);
    const map = useSelector(selectSpecificMiniFromStore);
    const {paintState} = useSelector(getTabletopStateFromStore);
    const mapHidden = useMemo(() => (
        (map.gmOnly && !gmView)
        || (cameraLookingDown ? map.position.y > interestLevelY : map.position.y < interestLevelY)
    ), [cameraLookingDown, gmView, interestLevelY, map.gmOnly, map.position.y]);
    // The snapThisMap function will change whenever the map position or rotation changes, but that's actually useful,
    // it's the only thing triggering a re-render of the TabletopMapComponent when it's dragged.
    const snapThisMap = useCallback(() => (
        snapMap(snapToGrid && map.selectedBy !== null, castMapProperties(map.metadata.properties), map.position, map.rotation)
    ), [map.metadata.properties, map.position, map.rotation, map.selectedBy, snapToGrid]);
    // We don't want to trigger a re-render on every change of every map, so pull the maps from the store only on demand
    // (when the map is selected and snapThisMap changes)
    const store = useStore();
    const dropShadowDistance = useMemo(() => (
        !isSelected ? undefined : getDropShadowDistance(mapId, getScenarioFromStore(store.getState()).maps,
            snapThisMap, cameraLookingDown)
    ), [cameraLookingDown, isSelected, mapId, snapThisMap, store])

    return mapHidden ? null
        : !map.metadata.properties ? (
            <MetadataLoaderContainer key={'loader-' + mapId} tabletopId={mapId} metadata={map.metadata}
                                     calculateProperties={calculateMapProperties}
            />
        ) : (
            <TabletopMapComponent
                dispatch={dispatch}
                key={mapId}
                name={map.name}
                mapId={mapId}
                metadata={map.metadata}
                snapMap={snapThisMap}
                fogBitmap={map.fogOfWar}
                gmView={gmView}
                highlight={!map.selectedBy ? null : (map.selectedBy === myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                opacity={map.gmOnly ? 0.5 : 1.0}
                paintState={paintState}
                paintLayers={map.paintLayers}
                transparent={map.transparent}
                dropShadowDistance={dropShadowDistance}
                cameraLookingDown={cameraLookingDown}
            />
        );

}

function getDropShadowDistance(mapId: string, maps: {[mapId: string]: MapType}, snapMap: () => SnapMapResult, cameraLookingDown: boolean): number | undefined {
    let shadowY: number | undefined = undefined;
    const map = maps[mapId];
    const properties = castMapProperties(map.metadata?.properties);
    const {positionObj} = snapMap();
    const west = positionObj.x - properties.width / 2;
    const east = positionObj.x + properties.width / 2;
    const north = positionObj.z - properties.height / 2;
    const south = positionObj.z + properties.height / 2;
    for (let otherMapId of Object.keys(maps)) {
        if (otherMapId === mapId) {
            continue;
        }
        const otherMap = maps[otherMapId];
        if ((cameraLookingDown && otherMap.position.y < positionObj.y && (shadowY === undefined || otherMap.position.y > shadowY))
            || (!cameraLookingDown && otherMap.position.y > positionObj.y && (shadowY === undefined || otherMap.position.y < shadowY))
        ) {
            const otherProperties = castMapProperties(otherMap.metadata?.properties);
            if (otherMap.position.x + otherProperties.width / 2 >= west
                && otherMap.position.x - otherProperties.width / 2 <= east
                && otherMap.position.z + otherProperties.height / 2 >= north
                && otherMap.position.z - otherProperties.height / 2 <= south) {
                shadowY = otherMap.position.y;
            }
        }
    }
    return (shadowY === undefined) ? undefined : (positionObj.y - shadowY);
}