import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';

import {buildEuler, buildVector3} from '../util/threeUtils';
import getMapShaderMaterial from '../shaders/mapShader';
import getHighlightShaderMaterial from '../shaders/highlightShader';
import * as constants from '../util/constants';
import {ObjectEuler, ObjectVector3} from '../util/scenarioUtils';
import {castMapAppProperties, DriveMetadata, MapAppProperties} from '../util/googleDriveUtils';

interface TabletopMapComponentProps {
    mapId: string;
    name: string;
    metadata: DriveMetadata<MapAppProperties>;
    snapMap: (mapId: string) => {positionObj: ObjectVector3, rotationObj: ObjectEuler, dx: number, dy: number, width: number, height: number};
    texture: THREE.Texture | null;
    transparentFog: boolean;
    highlight: THREE.Color | null;
    opacity: number;
    fogBitmap?: number[];
}

interface TabletopMapComponentState {
    fogOfWar?: THREE.Texture;
    gridColour: string;
    fogWidth: number;
    fogHeight: number;
}

export default class TabletopMapComponent extends React.Component<TabletopMapComponentProps, TabletopMapComponentState> {

    static propTypes = {
        mapId: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        metadata: PropTypes.object.isRequired,
        snapMap: PropTypes.func.isRequired,
        texture: PropTypes.object,
        transparentFog: PropTypes.bool.isRequired,
        highlight: PropTypes.object,
        opacity: PropTypes.number.isRequired,
        fogBitmap: PropTypes.arrayOf(PropTypes.number)
    };

    static MAP_OFFSET = new THREE.Vector3(0, -0.01, 0);

    constructor(props: TabletopMapComponentProps) {
        super(props);
        this.state = {
            fogOfWar: undefined,
            gridColour: constants.GRID_NONE,
            fogWidth: 0,
            fogHeight: 0
        }
    }

    componentWillMount() {
        this.updateStateFromProps();
    }

    componentWillReceiveProps(props: TabletopMapComponentProps) {
        this.updateStateFromProps(props);
    }

    updateStateFromProps(props: TabletopMapComponentProps = this.props) {
        if (props.metadata.appProperties) {
            const {fogWidth, fogHeight} = castMapAppProperties(props.metadata.appProperties);
            const gridColour = fogWidth ? props.metadata.appProperties.gridColour : constants.GRID_NONE;
            this.setState({gridColour, fogWidth, fogHeight}, () => {
                if (this.state.gridColour === constants.GRID_NONE) {
                    this.setState({fogOfWar: undefined});
                } else {
                    let fogOfWar;
                    if (!this.state.fogOfWar || this.state.fogOfWar.image.width !== this.state.fogWidth || this.state.fogOfWar.image.height !== this.state.fogHeight) {
                        fogOfWar = new THREE.Texture(new ImageData(this.state.fogWidth, this.state.fogHeight));
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

    renderGrid(width: number, height: number, dx: number, dy: number) {
        const verticies = [];
        for (let x = -width/2 + dx; x < width/2; x++) {
            verticies.push(new THREE.Vector3(x, 0, -height/2), new THREE.Vector3(x, 0, height/2));
        }
        for (let z = -height/2 + dy; z < height/2; z++) {
            verticies.push(new THREE.Vector3(-width/2, 0, z), new THREE.Vector3(width/2, 0, z));
        }
        return (
            <lineSegments>
                <lineBasicMaterial color={this.state.gridColour} linewidth={1}/>
                <geometry vertices={verticies}/>
            </lineSegments>
        );
    }

    renderMap() {
        const {positionObj, rotationObj, dx, dy, width, height} = this.props.snapMap(this.props.mapId);
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const highlightScale = (!this.props.highlight) ? null : (
            new THREE.Vector3((width + 0.4) / width, 1.2, (height + 0.4) / height)
        );
        const {showGrid} = castMapAppProperties(this.props.metadata.appProperties);
        return (
            <group position={position} rotation={rotation} ref={(mesh: any) => {
                if (mesh) {
                    mesh.userDataA = {mapId: this.props.mapId}
                }
            }}>
                {(this.state.gridColour !== constants.GRID_NONE && showGrid) ? this.renderGrid(width, height, dx, dy) : null}
                <mesh position={TabletopMapComponent.MAP_OFFSET}>
                    <boxGeometry width={width} depth={height} height={0}/>
                    {getMapShaderMaterial(this.props.texture, this.props.opacity, width, height, this.props.transparentFog, this.state.fogOfWar, dx, dy)}
                </mesh>
                {
                    (this.props.highlight) ? (
                        <mesh scale={highlightScale}>
                            <boxGeometry width={width} depth={height} height={0.01}/>
                            {getHighlightShaderMaterial(this.props.highlight, 0.7)}
                        </mesh>
                    ) : null
                }
            </group>
        );
    }

    render() {
        return (this.props.metadata && this.props.metadata.appProperties) ? this.renderMap() : null;
    }
}