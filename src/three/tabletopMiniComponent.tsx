import {FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';

import TextureLoaderContainer from '../container/textureLoaderContainer';
import {
    calculateMiniProperties,
    getColourHex,
    GRID_COLOUR,
    MapPathData,
    MovementPathPoint,
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterValues
} from '../util/scenarioUtils';
import {FileMetadata, MiniProperties} from '../util/storage/storageContract';
import {getTextureCornerColour} from '../util/threeUtils';
import TabletopMiniStandeeComponent from './tabletopMiniStandeeComponent';
import TabletopMiniTopDownComponent from './tabletopMiniTopDownComponent';
import TabletopPathComponent from './tabletopPathComponent';

interface TabletopMiniComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    labelColour?: string;
    metadata: FileMetadata<void, MiniProperties>;
    positionObj: ObjectVector3;
    rotationObj: ObjectEuler;
    scaleFactor: number;
    elevation: number;
    polygonOffset: number;
    movementPath?: MovementPathPoint[] | null;
    roundToGrid: boolean;
    highlight: THREE.Color | null;
    opacity: number;
    prone: boolean;
    topDown: boolean;
    hideBase: boolean;
    baseColour?: number;
    mapPathData: MapPathData;
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
        labelColour,
        metadata,
        positionObj,
        rotationObj,
        scaleFactor,
        elevation,
        polygonOffset,
        movementPath,
        roundToGrid,
        highlight,
        opacity,
        prone,
        topDown,
        hideBase,
        baseColour,
        mapPathData,
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
                        labelColour={labelColour}
                        metadata={metadata}
                        positionObj={positionObj}
                        rotationObj={rotationObj}
                        scaleFactor={scaleFactor}
                        elevation={effectiveElevation}
                        polygonOffset={polygonOffset}
                        highlight={highlight}
                        opacity={opacity}
                        prone={prone}
                        topDown={topDown}
                        hideBase={hideBase}
                        baseColour={baseColour}
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
                        labelColour={labelColour}
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
                        piecesRosterColumns={piecesRosterColumns}
                        piecesRosterValues={piecesRosterValues}
                        colour={colour}
                        texture={texture}
                    />
                )
            }
            {
                !movementPath ? null : (
                    <TabletopPathComponent
                        miniId={miniId}
                        positionObj={pathPosition}
                        movementPath={movementPath}
                        roundToGrid={roundToGrid}
                        updateMovedSuffix={updateMovedSuffix}
                        mapPathData={mapPathData}
                    />
                )
            }
        </group>
    )

};

export default TabletopMiniComponent;