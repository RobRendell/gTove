import {Line} from '@react-three/drei';
import {FunctionComponent, useEffect, useMemo, useState} from 'react';
import {Color, LinearFilter, Texture, Vector3, VideoTexture} from 'three';

import TextureLoaderContainer from '../container/textureLoaderContainer';
import {GtoveDispatchProp} from '../redux/mainReducerTypes';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import MapShaderMaterial from '../shaders/mapShaderMaterial';
import {MAP_OFFSET_DOWN, MAP_OFFSET_UP} from '../util/constants';
import {calculateMapProperties, MapPaintLayer, SnapMapResult} from '../util/scenarioUtils';
import {FileMetadata, GridType, MapProperties} from '../util/storage/storageContract';
import {castMapProperties} from '../util/storage/storageUtils';
import {buildEuler, buildVector3} from '../util/threeUtils';
import PaintSurface from './paintSurface';
import TabletopGridComponent from './tabletopGridComponent';

interface TabletopMapComponentProps extends GtoveDispatchProp {
    mapId: string;
    metadata: FileMetadata<void, MapProperties>;
    snapMap: () => SnapMapResult;
    gmView: boolean;
    highlight: Color | null;
    opacity: number;
    fogBitmap?: number[];
    paintLayers: MapPaintLayer[];
    transparent: boolean;
    transparentFog?: boolean;
    dropShadowDistance?: number;
    cameraLookingDown: boolean;
}

const TabletopMapComponent: FunctionComponent<TabletopMapComponentProps> = ({
                                                                                mapId,
                                                                                metadata,
                                                                                snapMap,
                                                                                gmView,
                                                                                highlight,
                                                                                opacity,
                                                                                fogBitmap,
                                                                                paintLayers,
                                                                                transparent,
                                                                                transparentFog,
                                                                                dropShadowDistance,
                                                                                cameraLookingDown,
                                                                                dispatch
                                                                            }) => {

    const [texture, setTexture] = useState<undefined | Texture | VideoTexture>();
    const [fogOfWar, setFogOfWar] = useState<undefined | Texture>();
    const [paintTexture, setPaintTexture] = useState<undefined | Texture>();
    const [fogSize, setFogSize] = useState({width: 0, height: 0});

    const mapProperties = useMemo(() => (
        !metadata.properties ? undefined : castMapProperties(metadata.properties)
    ), [metadata.properties]);

    useEffect(() => {
        if (mapProperties) {
            const {fogWidth, fogHeight} = mapProperties;
            setFogSize({width: fogWidth, height: fogHeight});
        }
    }, [mapProperties]);
    
    const mapHasNoGrid = useMemo(() => (
        mapProperties?.gridType === GridType.NONE
    ), [mapProperties]);

    useEffect(() => {
        setFogOfWar((prev) => {
            if (mapHasNoGrid || fogSize.width === 0 || fogSize.height === 0) {
                return undefined;
            }
            if (!prev || prev.image.width !== fogSize.width || prev.image.height !== fogSize.height) {
                const fogOfWar = new Texture(new ImageData(fogSize.width, fogSize.height));
                fogOfWar.generateMipmaps = false;
                fogOfWar.minFilter = LinearFilter;
                return fogOfWar;
            }
            return prev;
        });
    }, [fogSize.height, fogSize.width, mapHasNoGrid]);

    useEffect(() => () => {
        fogOfWar?.dispose();
    }, [fogOfWar]);
    
    useEffect(() => {
        const data: Uint8ClampedArray = fogOfWar?.image['data'] as Uint8ClampedArray;
        if (fogOfWar && data) {
            const numTiles = fogOfWar.image.height * fogOfWar.image.width;
            for (let index = 0, offset = 3; index < numTiles; index++, offset += 4) {
                const cover = (!fogBitmap || ((index >> 5) < fogBitmap.length && ((fogBitmap[index >> 5] || 0) & (1 << (index & 0x1f))) !== 0)) ? 255 : 0;
                if (data[offset] !== cover) {
                    data.set([cover], offset);
                    fogOfWar.needsUpdate = true;
                }
            }
        }
    }, [fogBitmap, fogOfWar]);

    const {position, rotation, dx, dy, width, height, highlightScale} = useMemo(() => {
        const {positionObj, rotationObj, dx, dy, width, height} = snapMap();
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const highlightScale = (!highlight) ? undefined : (
            new Vector3((width + 0.4) / width, 1.2, (height + 0.4) / height)
        );
        return {position, rotation, dx, dy, width, height, highlightScale};
    }, [highlight, snapMap]);
    
    const dropShadow = useMemo(() => (
        (dropShadowDistance === undefined) ? null : (
            <>
                <mesh position={new Vector3(0, -dropShadowDistance, 0)}>
                    <boxGeometry attach='geometry' args={[width, 0.005, height]}/>
                    <MapShaderMaterial texture={texture} opacity={0.5} transparent={transparent}
                                       mapWidth={width} mapHeight={height} gmView={gmView}
                                       dx={dx} dy={dy} paintTexture={paintTexture}
                                       gridType={mapProperties?.gridType ?? GridType.NONE}
                    />
                </mesh>
                <Line points={[[width / 2, 0, height / 2], [width / 2, -dropShadowDistance, height / 2]]} color={0} lineWidth={1} gapSize={0.4} dashSize={0.4} dashed={true}/>
                <Line points={[[-width / 2, 0, height / 2], [-width / 2, -dropShadowDistance, height / 2]]} color={0} lineWidth={1} gapSize={0.4} dashSize={0.4} dashed={true}/>
                <Line points={[[width / 2, 0, -height / 2], [width / 2, -dropShadowDistance, -height / 2]]} color={0} lineWidth={1} gapSize={0.4} dashSize={0.4} dashed={true}/>
                <Line points={[[-width / 2, 0, -height / 2], [-width / 2, -dropShadowDistance, -height / 2]]} color={0} lineWidth={1} gapSize={0.4} dashSize={0.4} dashed={true}/>
            </>
        )
    ), [dropShadowDistance, dx, dy, gmView, height, mapProperties?.gridType, paintTexture, texture, transparent, width]);

    const {showGrid, gridType, gridColour} = useMemo(() => {
        return (mapProperties === undefined || texture === null)
            // If properties or texture are missing, force the grid on.
            ? {showGrid: true, gridType: GridType.SQUARE, gridColour: '#000000'}
            : mapProperties;
    }, [mapProperties, texture]);

    return (
        <group position={position} rotation={rotation} userData={{mapId}}>
            <TextureLoaderContainer metadata={metadata} setTexture={setTexture}
                                    calculateProperties={calculateMapProperties}
            />
            {
                (showGrid && gridType !== GridType.NONE) ? (
                    <TabletopGridComponent width={width} height={height} dx={dx} dy={dy} gridType={gridType}
                                           colour={gridColour || '#000000'} renderOrder={position.y + 0.01} />
                ) : null
            }
            <PaintSurface dispatch={dispatch} mapId={mapId}
                          position={position} rotation={rotation} width={width} height={height}
                          paintTexture={paintTexture} setPaintTexture={setPaintTexture}
                          paintLayers={paintLayers}
            />
            <mesh position={cameraLookingDown ? MAP_OFFSET_DOWN : MAP_OFFSET_UP} renderOrder={position.y}>
                <boxGeometry attach='geometry' args={[width, 0.005, height]}/>
                <MapShaderMaterial texture={texture} opacity={opacity}
                                   transparent={transparent} transparentFog={transparentFog}
                                   mapWidth={width} mapHeight={height} gmView={gmView}
                                   fogOfWar={fogOfWar} dx={dx} dy={dy}
                                   paintTexture={paintTexture}
                                   gridType={mapProperties?.gridType ?? GridType.NONE}
                />
            </mesh>
            {
                (highlight) ? (
                    <mesh scale={highlightScale} renderOrder={position.y}>
                        <boxGeometry attach='geometry' args={[width, 0.01, height]}/>
                        <HighlightShaderMaterial colour={highlight} intensityFactor={0.7} />
                    </mesh>
                ) : null
            }
            {dropShadow}
        </group>
    );

};

export default TabletopMapComponent;