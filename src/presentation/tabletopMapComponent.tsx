import * as React from 'react';
import * as THREE from 'three';
import {Line} from '@react-three/drei';
import memoizeOne from 'memoize-one';

import {buildEuler, buildVector3} from '../util/threeUtils';
import MapShaderMaterial from '../shaders/mapShaderMaterial';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import {
    calculateMapProperties,
    mapMetadataHasNoGrid,
    MapPaintLayer,
    ObjectEuler,
    ObjectVector3
} from '../util/scenarioUtils';
import { FileMetadata, GridType, MapProperties } from '../util/storage/storageContract';
import { castMapProperties } from '../util/storage/storageUtils';
import TabletopGridComponent from './tabletopGridComponent';
import {PaintState} from './paintTools';
import PaintSurface from './paintSurface';
import {GtoveDispatchProp} from '../redux/mainReducer';
import TextureLoaderContainer from '../container/textureLoaderContainer';

interface TabletopMapComponentProps extends GtoveDispatchProp {
    mapId: string;
    name: string;
    metadata: FileMetadata<void, MapProperties>;
    snapMap: (mapId: string) => {positionObj: ObjectVector3, rotationObj: ObjectEuler, dx: number, dy: number, width: number, height: number};
    gmView: boolean;
    highlight: THREE.Color | null;
    opacity: number;
    fogBitmap?: number[];
    paintState: PaintState;
    paintLayers: MapPaintLayer[];
    transparent: boolean;
    dropShadowDistance?: number;
    cameraLookingDown: boolean;
}

interface TabletopMapComponentState {
    texture: THREE.Texture | null;
    fogOfWar?: THREE.Texture;
    fogWidth: number;
    fogHeight: number;
    paintTexture?: THREE.Texture;
}

export default class TabletopMapComponent extends React.Component<TabletopMapComponentProps, TabletopMapComponentState> {

    static MAP_OFFSET_DOWN = new THREE.Vector3(0, -0.01, 0);
    static MAP_OFFSET_UP = new THREE.Vector3(0, 0.01, 0);

    constructor(props: TabletopMapComponentProps) {
        super(props);
        this.setPaintTexture = this.setPaintTexture.bind(this);
        this.setTexture = this.setTexture.bind(this);
        this.renderDropShadow = memoizeOne(this.renderDropShadow.bind(this));
        this.state = {
            texture: null,
            fogOfWar: undefined,
            fogWidth: 0,
            fogHeight: 0
        }
    }

    componentDidMount() {
        this.updateStateFromProps();
    }

    UNSAFE_componentWillReceiveProps(props: TabletopMapComponentProps) {
        this.updateStateFromProps(props);
    }

    setTexture(texture: THREE.Texture | THREE.VideoTexture) {
        this.setState({texture});
    }

    updateStateFromProps(props: TabletopMapComponentProps = this.props) {
        if (props.metadata.properties) {
            const {fogWidth, fogHeight} = props.metadata.properties;
            this.setState({fogWidth, fogHeight}, () => {
                if (mapMetadataHasNoGrid(props.metadata) || fogWidth === 0 || fogHeight === 0) {
                    this.setState({fogOfWar: undefined});
                } else {
                    let fogOfWar;
                    if (!this.state.fogOfWar || this.state.fogOfWar.image.width !== this.state.fogWidth || this.state.fogOfWar.image.height !== this.state.fogHeight) {
                        fogOfWar = new THREE.Texture(new ImageData(this.state.fogWidth, this.state.fogHeight) as any);
                        fogOfWar.generateMipmaps = false;
                        fogOfWar.minFilter = THREE.LinearFilter;
                    }
                    if (fogOfWar) {
                        this.setState({fogOfWar}, () => {
                            this.updateFogOfWarTexture(props);
                        });
                    } else {
                        this.updateFogOfWarTexture(props);
                    }
                }
            });
        }
    }

    updateFogOfWarTexture(props: TabletopMapComponentProps) {
        const texture = this.state.fogOfWar;
        if (texture) {
            const numTiles = texture.image.height * texture.image.width;
            for (let index = 0, offset = 3; index < numTiles; index++, offset += 4) {
                const cover = (!props.fogBitmap || ((index >> 5) < props.fogBitmap.length && ((props.fogBitmap[index >> 5] || 0) & (1 << (index & 0x1f))) !== 0)) ? 255 : 0;
                const data: Uint8ClampedArray = texture.image['data'] as Uint8ClampedArray;
                if (data[offset] !== cover) {
                    data.set([cover], offset);
                    texture.needsUpdate = true;
                }
            }
        }
    }

    setPaintTexture(paintTexture?: THREE.Texture) {
        this.setState({paintTexture});
    }

    renderDropShadow(width: number, height: number, dx: number, dy: number, dropShadowDistance?: number) {
        return (dropShadowDistance === undefined) ? null : (
            <>
                <mesh position={new THREE.Vector3(0, -dropShadowDistance, 0)}>
                    <boxGeometry attach='geometry' args={[width, 0.005, height]}/>
                    <MapShaderMaterial texture={this.state.texture} opacity={0.5} transparent={this.props.transparent}
                                       mapWidth={width} mapHeight={height} gmView={this.props.gmView}
                                       fogOfWar={this.state.fogOfWar} dx={dx} dy={dy}
                                       paintTexture={this.state.paintTexture}
                                       gridType={this.props.metadata.properties?.gridType ?? GridType.NONE}
                    />
                </mesh>
                <Line points={[[width / 2, 0, height / 2], [width / 2, -dropShadowDistance, height / 2]]} color='black' gapSize={0.4} dashSize={0.4} dashed={true}/>
                <Line points={[[-width / 2, 0, height / 2], [-width / 2, -dropShadowDistance, height / 2]]} color='black' gapSize={0.4} dashSize={0.4} dashed={true}/>
                <Line points={[[width / 2, 0, -height / 2], [width / 2, -dropShadowDistance, -height / 2]]} color='black' gapSize={0.4} dashSize={0.4} dashed={true}/>
                <Line points={[[-width / 2, 0, -height / 2], [-width / 2, -dropShadowDistance, -height / 2]]} color='black' gapSize={0.4} dashSize={0.4} dashed={true}/>
            </>
        )
    }

    render() {
        const {positionObj, rotationObj, dx, dy, width, height} = this.props.snapMap(this.props.mapId);
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const highlightScale = (!this.props.highlight) ? undefined : (
            new THREE.Vector3((width + 0.4) / width, 1.2, (height + 0.4) / height)
        );
        const properties = castMapProperties(this.props.metadata?.properties);
        let {showGrid, gridType, gridColour} = properties;
        if (this.props.metadata?.properties === undefined || this.state.texture === null) {
            // If properties or texture are missing, force the grid on.
            showGrid = true;
            gridType = (gridType === GridType.NONE) ? GridType.SQUARE : gridType;
            gridColour = '#000000';
        }
        return (
            <group position={position} rotation={rotation} userData={{mapId: this.props.mapId}}>
                <TextureLoaderContainer metadata={this.props.metadata} setTexture={this.setTexture}
                                        calculateProperties={calculateMapProperties}
                />
                {
                    (showGrid && gridType !== GridType.NONE) ? (
                        <TabletopGridComponent width={width} height={height} dx={dx} dy={dy} gridType={gridType}
                                               colour={gridColour || '#000000'} renderOrder={position.y + 0.01} />
                    ) : null
                }
                <PaintSurface dispatch={this.props.dispatch} mapId={this.props.mapId}
                              paintState={this.props.paintState} position={position} rotation={rotation}
                              width={width} height={height} active={this.props.paintState.toolMapId === this.props.mapId}
                              paintTexture={this.state.paintTexture} setPaintTexture={this.setPaintTexture}
                              paintLayers={this.props.paintLayers}
                />
                <mesh position={this.props.cameraLookingDown ? TabletopMapComponent.MAP_OFFSET_DOWN : TabletopMapComponent.MAP_OFFSET_UP} renderOrder={position.y}>
                    <boxGeometry attach='geometry' args={[width, 0.005, height]}/>
                    <MapShaderMaterial texture={this.state.texture} opacity={this.props.opacity} transparent={this.props.transparent}
                                       mapWidth={width} mapHeight={height} gmView={this.props.gmView}
                                       fogOfWar={this.state.fogOfWar} dx={dx} dy={dy}
                                       paintTexture={this.state.paintTexture}
                                       gridType={this.props.metadata.properties?.gridType ?? GridType.NONE}
                    />
                </mesh>
                {
                    (this.props.highlight) ? (
                        <mesh scale={highlightScale} renderOrder={position.y}>
                            <boxGeometry attach='geometry' args={[width, 0.01, height]}/>
                            <HighlightShaderMaterial colour={this.props.highlight} intensityFactor={0.7} />
                        </mesh>
                    ) : null
                }
                {this.renderDropShadow(width, height, dx, dy, this.props.dropShadowDistance)}
            </group>
        );
    }
}