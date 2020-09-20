import * as React from 'react';
import * as THREE from 'three';
import {BoxGeometry, Group, Mesh} from 'react-three-fiber/components';

import {buildEuler, buildVector3} from '../util/threeUtils';
import MapShaderMaterial from '../shaders/mapShaderMaterial';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import {MapPaintLayer, ObjectEuler, ObjectVector3} from '../util/scenarioUtils';
import {castMapProperties, DriveMetadata, GridType, MapProperties} from '../util/googleDriveUtils';
import TabletopGridComponent from './tabletopGridComponent';
import {PaintState} from './paintTools';
import PaintSurface from './paintSurface';
import {GtoveDispatchProp} from '../redux/mainReducer';

interface TabletopMapComponentProps extends GtoveDispatchProp {
    mapId: string;
    name: string;
    metadata: DriveMetadata<void, MapProperties>;
    snapMap: (mapId: string) => {positionObj: ObjectVector3, rotationObj: ObjectEuler, dx: number, dy: number, width: number, height: number};
    texture: THREE.Texture | null;
    transparentFog: boolean;
    highlight: THREE.Color | null;
    opacity: number;
    fogBitmap?: number[];
    paintState: PaintState;
    paintLayers: MapPaintLayer[];
    transparent: boolean;
}

interface TabletopMapComponentState {
    fogOfWar?: THREE.Texture;
    fogWidth: number;
    fogHeight: number;
    paintTexture?: THREE.Texture;
}

export default class TabletopMapComponent extends React.Component<TabletopMapComponentProps, TabletopMapComponentState> {

    static MAP_OFFSET = new THREE.Vector3(0, -0.01, 0);

    constructor(props: TabletopMapComponentProps) {
        super(props);
        this.setPaintTexture = this.setPaintTexture.bind(this);
        this.state = {
            fogOfWar: undefined,
            fogWidth: 0,
            fogHeight: 0
        }
    }

    UNSAFE_componentWillMount() {
        this.updateStateFromProps();
    }

    UNSAFE_componentWillReceiveProps(props: TabletopMapComponentProps) {
        this.updateStateFromProps(props);
    }

    updateStateFromProps(props: TabletopMapComponentProps = this.props) {
        if (props.metadata.properties) {
            const {fogWidth, fogHeight, gridType} = castMapProperties(props.metadata.properties);
            this.setState({fogWidth, fogHeight}, () => {
                if (gridType === GridType.NONE) {
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

    renderMap() {
        const {positionObj, rotationObj, dx, dy, width, height} = this.props.snapMap(this.props.mapId);
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const highlightScale = (!this.props.highlight) ? undefined : (
            new THREE.Vector3((width + 0.4) / width, 1.2, (height + 0.4) / height)
        );
        const properties = castMapProperties(this.props.metadata.properties);
        const {showGrid, gridType, gridColour} = properties;
        return (
            <Group position={position} rotation={rotation} userData={{mapId: this.props.mapId}}>
                {
                    gridType === GridType.NONE || !showGrid ? null : (
                        <TabletopGridComponent width={width} height={height} dx={dx} dy={dy} gridType={gridType} colour={gridColour || '#000000'} />
                    )
                }
                <PaintSurface dispatch={this.props.dispatch} mapId={this.props.mapId}
                              paintState={this.props.paintState} position={position} rotation={rotation}
                              width={width} height={height} active={this.props.paintState.toolMapId === this.props.mapId}
                              paintTexture={this.state.paintTexture} setPaintTexture={this.setPaintTexture}
                              paintLayers={this.props.paintLayers}
                />
                <Mesh position={TabletopMapComponent.MAP_OFFSET} renderOrder={position.y}>
                    <BoxGeometry attach='geometry' args={[width, 0.005, height]}/>
                    <MapShaderMaterial texture={this.props.texture} opacity={this.props.opacity} transparent={this.props.transparent}
                                       mapWidth={width} mapHeight={height} transparentFog={this.props.transparentFog}
                                       fogOfWar={this.state.fogOfWar} dx={dx} dy={dy}
                                       paintTexture={this.state.paintTexture} gridType={this.props.metadata.properties.gridType}
                    />
                </Mesh>
                {
                    (this.props.highlight) ? (
                        <Mesh scale={highlightScale} renderOrder={position.y}>
                            <BoxGeometry attach='geometry' args={[width, 0.01, height]}/>
                            <HighlightShaderMaterial colour={this.props.highlight} intensityFactor={0.7} />
                        </Mesh>
                    ) : null
                }
            </Group>
        );
    }

    render() {
        return (this.props.metadata && this.props.metadata.properties) ? this.renderMap() : null;
    }
}