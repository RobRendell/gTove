import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';

import {buildEuler, buildVector3} from '../util/threeUtils';
import getMapShaderMaterial from '../shaders/mapShader';
import getHighlightShaderMaterial from '../shaders/highlightShader';
import * as constants from '../util/constants';
import {ObjectEuler, ObjectVector3} from '../util/scenarioUtils';
import {DriveMetadata, MapAppProperties} from '../util/googleDriveUtils';

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
            const fogWidth = Number(props.metadata.appProperties.fogWidth);
            const fogHeight = Number(props.metadata.appProperties.fogHeight);
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

    renderMap() {
        const {positionObj, rotationObj, dx, dy, width, height} = this.props.snapMap(this.props.mapId);
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const highlightScale = (!this.props.highlight) ? null : (
            new THREE.Vector3((width + 0.4) / width, 1.2, (height + 0.4) / height)
        );
        return (
            <group position={position} rotation={rotation} ref={(mesh: any) => {
                if (mesh) {
                    mesh.userDataA = {mapId: this.props.mapId}
                }
            }}>
                <mesh>
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