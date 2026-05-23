import {Fragment, FunctionComponent, memo, useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import MetadataLoaderContainer from '../container/metadataLoaderContainer';
import TabletopMiniGMNote from '../presentation/tabletopMiniGMNote';
import {getMyPeerIdFromStore, getScenarioFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {HIGHLIGHT_COLOUR_ME, HIGHLIGHT_COLOUR_OTHER} from '../util/constants';
import {
    calculatePieceProperties,
    MapPathData,
    MiniType,
    PiecesRosterColumn,
    SnapMiniReturn
} from '../util/scenarioUtils';
import {isMiniMetadata, isTemplateMetadata} from '../util/storage/storageUtils';
import {buildEuler, buildVector3} from '../util/threeUtils';
import TabletopMiniComponent from './tabletopMiniComponent';
import TabletopTemplateComponent from './tabletopTemplateComponent';

export type SnapMiniIdToTabletopType = (miniId: string, absolute?: boolean) => SnapMiniReturn | undefined;

interface TabletopMiniWrapperProps {
    miniId: string;
    polygonOffsetMap: {[miniId: string]: number};
    snapMiniIdToTabletop: SnapMiniIdToTabletopType;
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
                                                                                          snapMiniIdToTabletop,
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
        getScenarioFromStore(store).minis[miniId] as MiniType | undefined
    ), [miniId]);
    const mini = useSelector(selectSpecificMiniFromStore);

    const snappedMini = useMemo(() => (
        !mini ? undefined : snapMiniIdToTabletop(miniId)
    ), [mini, miniId, snapMiniIdToTabletop]);
    const myPeerId = useSelector(getMyPeerIdFromStore);

    // Also render child minis relative to this one
    const positionVector = useMemo(() => {
        const vector = buildVector3(snappedMini?.positionObj);
        vector.y += snappedMini?.elevation ?? 0;
        return vector;
    }, [snappedMini]);
    const rotationEuler = useMemo(() => (
        buildEuler(snappedMini?.rotationObj)
    ), [snappedMini])
    const childMiniIds = attachedMinisMap[miniId];

    return (!mini || !snappedMini || (mini.gmOnly && !gmView)
        || (cameraLookingDown ? snappedMini.positionObj.y > interestLevelY : snappedMini.positionObj.y < interestLevelY)) ? null : (
        <Fragment key={miniId}>
            {
                (isTemplateMetadata(mini.metadata)) ? (
                    <TabletopTemplateComponent
                        miniId={miniId}
                        label={showMiniNames ? mini.name : ''}
                        labelSize={labelSize}
                        labelColour={labelColour}
                        metadata={mini.metadata}
                        positionObj={snappedMini.positionObj}
                        rotationObj={snappedMini.rotationObj}
                        scaleFactor={snappedMini.scaleFactor}
                        elevation={snappedMini.elevation}
                        polygonOffset={polygonOffsetMap[miniId]}
                        highlight={!mini.selectedBy ? null : (mini.selectedBy === myPeerId ? HIGHLIGHT_COLOUR_ME : HIGHLIGHT_COLOUR_OTHER)}
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
                        positionObj={snappedMini.positionObj}
                        rotationObj={snappedMini.rotationObj}
                        scaleFactor={snappedMini.scaleFactor}
                        elevation={snappedMini.elevation}
                        polygonOffset={polygonOffsetMap[miniId]}
                        movementPath={mini.movementPath}
                        roundToGrid={snapToGrid || false}
                        metadata={mini.metadata}
                        highlight={!mini.selectedBy ? null : (mini.selectedBy === myPeerId ? HIGHLIGHT_COLOUR_ME : HIGHLIGHT_COLOUR_OTHER)}
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
                                                     snapMiniIdToTabletop={snapMiniIdToTabletop}
                                                     attachedMinisMap={attachedMinisMap}
                                                     interestLevelY={interestLevelY - positionVector.y + mini.elevation}
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