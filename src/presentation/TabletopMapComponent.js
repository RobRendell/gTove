import React, {Component} from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';

import {buildEuler, buildVector3} from '../util/threeUtils';
import getMapShaderMaterial from '../shaders/mapShader';
import getHighlightShaderMaterial from '../shaders/highlightShader';
import * as constants from '../util/constants';

export default class TabletopMapComponent extends Component {

    static propTypes = {
        mapId: PropTypes.string.isRequired,
        snapMap: PropTypes.func.isRequired,
        texture: PropTypes.object,
        gridColour: PropTypes.string.isRequired,
        fogBitmap: PropTypes.arrayOf(PropTypes.number),
        fogWidth: PropTypes.number.isRequired,
        fogHeight: PropTypes.number.isRequired,
        transparentFog: PropTypes.bool.isRequired,
        selected: PropTypes.bool.isRequired,
        gmOnly: PropTypes.bool.isRequired
    };

    constructor(props) {
        super(props);
        this.state = {
            fogOfWar: null
        }
    }

    componentWillMount() {
        this.updateStateFromProps(this.props);
    }

    componentWillReceiveProps(props) {
        this.updateStateFromProps(props);
    }

    updateStateFromProps(props) {
        if (props.gridColour === constants.GRID_NONE) {
            this.setState({fogOfWar: null});
        } else {
            let fogOfWar;
            if (!this.state.fogOfWar || this.state.fogOfWar.image.width !== props.fogWidth || this.state.fogOfWar.image.height !== props.fogHeight) {
                fogOfWar = new THREE.Texture(new ImageData(props.fogWidth, props.fogHeight));
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
    }

    updateFogOfWarTexture(props) {
        const texture = this.state.fogOfWar;
        const numTiles = texture.image.height * texture.image.width;
        for (let index = 0, offset = 3; index < numTiles; index++, offset += 4) {
            const cover = (!props.fogBitmap || ((index >> 5) < props.fogBitmap.length && ((props.fogBitmap[index >> 5] || 0) & (1 << (index & 0x1f))) !== 0)) ? 255 : 0;
            if (texture.image.data[offset] !== cover) {
                texture.image.data.set([cover], offset);
                texture.needsUpdate = true;
            }
        }
    }

    render() {
        const {positionObj, rotationObj, dx, dy, width, height} = this.props.snapMap(this.props.mapId);
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const highlightScale = (!this.props.selected) ? null : (
            new THREE.Vector3((width + 0.4) / width, 1.2, (height + 0.4) / height)
        );
        return (
            <group position={position} rotation={rotation} ref={(mesh) => {
                if (mesh) {
                    mesh.userDataA = {mapId: this.props.mapId}
                }
            }}>
                <mesh>
                    <boxGeometry width={width} depth={height} height={0.01}/>
                    {getMapShaderMaterial(this.props.texture, this.props.gmOnly ? 0.5 : 1.0, width, height, this.props.transparentFog, this.state.fogOfWar, dx, dy)}
                </mesh>
                {
                    (this.props.selected) ? (
                        <mesh scale={highlightScale}>
                            <boxGeometry width={width} depth={height} height={0.01}/>
                            {getHighlightShaderMaterial()}
                        </mesh>
                    ) : null
                }
            </group>
        );

    }
}