import {Fragment, FunctionComponent, memo, useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import MetadataLoaderContainer from '../container/metadataLoaderContainer';
import {getMyPeerIdFromStore, getScenarioFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    calculatePieceProperties,
    MapPathData,
    MiniType,
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    SnapMiniReturn
} from '../util/scenarioUtils';
import {isMiniMetadata, isTemplateMetadata} from '../util/storage/storageUtils';
import {buildEuler, buildVector3} from '../util/threeUtils';
import TabletopMiniComponent from './tabletopMiniComponent';
import TabletopMiniGMNote from './tabletopMiniGMNote';
import TabletopTemplateComponent from './tabletopTemplateComponent';
import TabletopViewComponent from './tabletopViewComponent';

export type SnapMiniToTabletopType = (positionObj: ObjectVector3, elevation: number, rotationObj: ObjectEuler, scale: number, selectedBy: string | null, onMapId?: string) => SnapMiniReturn;

interface TabletopMiniWrapperProps {
    miniId: string;
    polygonOffsetMap: {[miniId: string]: number};
    snapMiniToTabletop: SnapMiniToTabletopType;
    attachedMinisMap: {[miniId: string]: string[]};
    interestLevelY: number;
    cameraLookingDown: boolean;
    topDown: boolean;
    gmView: boolean;
    showMiniNames: boolean;
    nearColumns: PiecesRosterColumn[];
    simpleNearColumns: PiecesRosterColumn[];
    labelSize: number;
    labelColour?: string;
    snapToGrid?: boolean;
    mapPathData: MapPathData;
}

export const TabletopMiniWrapper: FunctionComponent<TabletopMiniWrapperProps> = memo(({
                                                                                          miniId,
                                                                                          polygonOffsetMap,
                                                                                          snapMiniToTabletop,
                                                                                          attachedMinisMap,
                                                                                          interestLevelY,
                                                                                          cameraLookingDown,
                                                                                          topDown,
                                                                                          gmView,
                                                                                          showMiniNames,
                                                                                          nearColumns,
                                                                                          simpleNearColumns,
                                                                                          labelSize,
                                                                                          labelColour,
                                                                                          snapToGrid,
                                                                                          mapPathData
                                                                                      }) => {
    const selectSpecificMiniFromStore = useCallback((store: ReduxStoreType) => (
        getScenarioFromStore(store).minis[miniId]
    ), [miniId]);
    const mini: MiniType | undefined = useSelector(selectSpecificMiniFromStore);
    const {positionObj, rotationObj, scaleFactor, elevation} = useMemo(() => (
        snapMiniToTabletop(mini.position, mini.elevation, mini.rotation, mini.scale, mini.selectedBy, mini.onMapId)
    ), [mini.elevation, mini.onMapId, mini.position, mini.rotation, mini.scale, mini.selectedBy, snapMiniToTabletop]);
    const myPeerId = useSelector(getMyPeerIdFromStore);

    // Also render child minis relative to this one
    const positionVector = useMemo(() => {
        const vector = buildVector3(positionObj);
        vector.y += elevation;
        return vector;
    }, [elevation, positionObj]);
    const rotationEuler = useMemo(() => (
        buildEuler(rotationObj)
    ), [rotationObj])
    const childMiniIds = attachedMinisMap[miniId];

    return ((mini.gmOnly && !gmView) || (cameraLookingDown ? positionObj.y > interestLevelY : positionObj.y < interestLevelY)) ? null : (
        <Fragment key={miniId}>
            {
                (isTemplateMetadata(mini.metadata)) ? (
                    <TabletopTemplateComponent
                        miniId={miniId}
                        label={showMiniNames ? mini.name : ''}
                        labelSize={labelSize}
                        labelColour={labelColour}
                        metadata={mini.metadata}
                        positionObj={positionObj}
                        rotationObj={rotationObj}
                        scaleFactor={scaleFactor}
                        elevation={elevation}
                        polygonOffset={polygonOffsetMap[miniId]}
                        highlight={!mini.selectedBy ? null : (mini.selectedBy === myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                        wireframe={mini.gmOnly}
                        movementPath={mini.movementPath}
                        roundToGrid={snapToGrid || false}
                        piecesRosterColumns={mini.piecesRosterSimple ? simpleNearColumns : nearColumns}
                        piecesRosterValues={{...mini.piecesRosterValues, ...mini.piecesRosterGMValues}}
                        mapPathData={mapPathData}
                    />
                ) : (isMiniMetadata(mini.metadata)) ? (
                    <TabletopMiniComponent
                        label={showMiniNames ? mini.name : ''}
                        labelSize={labelSize}
                        labelColour={labelColour}
                        miniId={miniId}
                        positionObj={positionObj}
                        rotationObj={rotationObj}
                        scaleFactor={scaleFactor}
                        elevation={elevation}
                        polygonOffset={polygonOffsetMap[miniId]}
                        movementPath={mini.movementPath}
                        roundToGrid={snapToGrid || false}
                        metadata={mini.metadata}
                        highlight={!mini.selectedBy ? null : (mini.selectedBy === myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                        opacity={mini.gmOnly ? 0.5 : 1.0}
                        prone={mini.prone || false}
                        topDown={topDown || mini.flat || false}
                        hideBase={mini.hideBase || false}
                        baseColour={mini.baseColour}
                        piecesRosterColumns={mini.piecesRosterSimple ? simpleNearColumns : nearColumns}
                        piecesRosterValues={{...mini.piecesRosterValues, ...mini.piecesRosterGMValues}}
                        mapPathData={mapPathData}
                    />
                ) : (
                    <MetadataLoaderContainer key={'loader-' + miniId} tabletopId={miniId}
                                             metadata={mini.metadata}
                                             calculateProperties={calculatePieceProperties}
                    />
                )
            }
            <TabletopMiniGMNote miniId={miniId} positionVector={positionVector} gmNoteMarkdown={mini?.gmNoteMarkdown} />
            {
                !childMiniIds ? null : (
                    <group position={positionVector} rotation={rotationEuler}>
                        {
                            childMiniIds.map((miniId) => (
                                <TabletopMiniWrapper key={miniId}
                                                     miniId={miniId}
                                                     polygonOffsetMap={polygonOffsetMap}
                                                     snapMiniToTabletop={snapMiniToTabletop}
                                                     attachedMinisMap={attachedMinisMap}
                                                     interestLevelY={interestLevelY}
                                                     cameraLookingDown={cameraLookingDown}
                                                     topDown={topDown}
                                                     gmView={gmView}
                                                     showMiniNames={showMiniNames}
                                                     nearColumns={nearColumns}
                                                     simpleNearColumns={simpleNearColumns}
                                                     labelSize={labelSize}
                                                     labelColour={labelColour}
                                                     snapToGrid={snapToGrid}
                                                     mapPathData={mapPathData}
                                />
                            ))
                        }
                    </group>
                )
            }

        </Fragment>
    )
});