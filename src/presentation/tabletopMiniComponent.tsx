import {FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';

import {getTextureCornerColour} from '../util/threeUtils';
import TabletopMiniTopDownComponent from './tabletopMiniTopDownComponent';
import TabletopMiniStandeeComponent from './tabletopMiniStandeeComponent';
import {FileMetadata, GridType, MiniProperties} from '../util/storage/storageContract';
import {
    calculateMiniProperties,
    DistanceMode,
    DistanceRound,
    generateMovementPath,
    getColourHex,
    GRID_COLOUR,
    MapType,
    MovementPathPoint,
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterValues
} from '../util/scenarioUtils';
import TabletopPathComponent from './tabletopPathComponent';
import TextureLoaderContainer from '../container/textureLoaderContainer';

interface TabletopMiniComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    metadata: FileMetadata<void, MiniProperties>;
    positionObj: ObjectVector3;
    rotationObj: ObjectEuler;
    scaleFactor: number;
    elevation: number;
    movementPath?: MovementPathPoint[];
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    roundToGrid: boolean;
    highlight: THREE.Color | null;
    opacity: number;
    prone: boolean;
    topDown: boolean;
    hideBase: boolean;
    baseColour?: number;
    cameraInverseQuat?: THREE.Quaternion;
    defaultGridType: GridType;
    maps: {[mapId: string]: MapType};
    piecesRosterColumns: PiecesRosterColumn[];
    piecesRosterValues: PiecesRosterValues;
}

export const MINI_THICKNESS = 0.05;
export const MINI_CORNER_RADIUS_PERCENT = 10;
export const RENDER_ORDER_ADJUST = 0.1;

export const STANDEE_ADJUST_UPRIGHT = new THREE.Vector3(0, 0, -MINI_THICKNESS / 2);
export const STANDEE_ADJUST_PRONE = new THREE.Vector3(0, 0, 0);

const TabletopMiniComponent: FunctionComponent<TabletopMiniComponentProps> = (
    {
        miniId,
        label,
        labelSize,
        metadata,
        positionObj,
        rotationObj,
        scaleFactor,
        elevation,
        movementPath,
        distanceMode,
        distanceRound,
        gridScale,
        gridUnit,
        roundToGrid,
        highlight,
        opacity,
        prone,
        topDown,
        hideBase,
        baseColour,
        cameraInverseQuat,
        defaultGridType,
        maps,
        piecesRosterColumns,
        piecesRosterValues
    }
) => {

    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [movedSuffix, setMovedSuffix] = useState('');

    // Effect to clear movedSuffix if movementPath becomes undefined
    useEffect(() => {
        if (!movementPath) {
            setMovedSuffix('');
        }
    }, [movementPath]);

    const colour = useMemo(() => (
        (metadata?.properties?.colour)
            ? new THREE.Color(getColourHex(metadata.properties.colour as GRID_COLOUR))
            : getTextureCornerColour(texture)
    ), [metadata, texture]);

    const pathPoints = useMemo(() => (
        movementPath ? generateMovementPath(movementPath, maps, defaultGridType) : undefined
    ), [movementPath, maps, defaultGridType]);

    const effectiveElevation = useMemo(() => (
        (elevation < MINI_THICKNESS / 2) ? 0 : elevation
    ), [elevation]);

    const pathPosition = useMemo(() => (
        effectiveElevation ? {...positionObj, y: positionObj.y + effectiveElevation} : positionObj
    ), [effectiveElevation, positionObj]);

    const updateMovedSuffix = useCallback((movedSuffix: string) => {
        setMovedSuffix(movedSuffix ? ` (moved ${movedSuffix})` : '');
    }, []);

    return (
        <group>
            <TextureLoaderContainer metadata={metadata} setTexture={setTexture}
                                    calculateProperties={calculateMiniProperties}
            />
            {
                !metadata?.properties ? null : (topDown && !prone) ? (
                    <TabletopMiniTopDownComponent
                        miniId={miniId}
                        label={label + movedSuffix}
                        labelSize={labelSize}
                        metadata={metadata}
                        positionObj={positionObj}
                        rotationObj={rotationObj}
                        scaleFactor={scaleFactor}
                        elevation={effectiveElevation}
                        highlight={highlight}
                        opacity={opacity}
                        prone={prone}
                        topDown={topDown}
                        hideBase={hideBase}
                        baseColour={baseColour}
                        cameraInverseQuat={cameraInverseQuat}
                        piecesRosterColumns={piecesRosterColumns}
                        piecesRosterValues={piecesRosterValues}
                        colour={colour}
                        texture={texture}
                    />
                ) : (
                    <TabletopMiniStandeeComponent
                        miniId={miniId}
                        label={label + movedSuffix}
                        labelSize={labelSize}
                        metadata={metadata}
                        positionObj={positionObj}
                        rotationObj={rotationObj}
                        scaleFactor={scaleFactor}
                        elevation={effectiveElevation}
                        highlight={highlight}
                        opacity={opacity}
                        prone={prone}
                        topDown={topDown}
                        hideBase={hideBase}
                        baseColour={baseColour}
                        cameraInverseQuat={cameraInverseQuat}
                        piecesRosterColumns={piecesRosterColumns}
                        piecesRosterValues={piecesRosterValues}
                        colour={colour}
                        texture={texture}
                    />
                )
            }
            {
                !pathPoints ? null : (
                    <TabletopPathComponent
                        miniId={miniId}
                        positionObj={pathPosition}
                        movementPath={pathPoints}
                        distanceMode={distanceMode}
                        distanceRound={distanceRound}
                        gridScale={gridScale}
                        gridUnit={gridUnit}
                        roundToGrid={roundToGrid}
                        updateMovedSuffix={updateMovedSuffix}
                    />
                )
            }
        </group>
    )

};

export default TabletopMiniComponent;