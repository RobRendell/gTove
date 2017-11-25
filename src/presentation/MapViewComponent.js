import React, {Component} from 'react';
import * as THREE from 'three';
import * as PropTypes from 'prop-types';
import React3 from 'react-three-renderer';
import {sizeMe} from 'react-sizeme';

import GestureControls from '../container/GestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/OrbitCameraUtils';
import DriveTextureLoader from '../util/DriveTextureLoader';

import './MapViewComponent.css';

class MapViewComponent extends Component {

    static propTypes = {
        scenario: PropTypes.object
    };

    constructor(props) {
        super(props);
        this.setCamera = this.setCamera.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onRotate = this.onRotate.bind(this);
        this.textureLoader = new DriveTextureLoader();
        this.state = {
            cameraPosition: new THREE.Vector3(0, 10, 10),
            camera: null,
            position: new THREE.Vector3(0, 0, 0),
            texture: this.getTextureFromProps(props)
        };
    }

    componentWillReceiveProps(props) {
        if (props.scenario &&
            (!this.props.scenario || props.scenario.metadata.id !== this.props.scenario.metadata.id)) {
            this.setState({
                texture: this.getTextureFromProps(props)
            });
        }
    }

    getTextureFromProps(props) {
        if (props.scenario && props.scenario.metadata) {
            return this.textureLoader.load(props.scenario.metadata);
        } else {
            return null;
        }
    }

    setCamera(camera) {
        this.setState({camera});
    }

    onPan(delta) {
        // TODO pan camera only if the whole map is the current focus
        panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height);
    }

    onZoom(delta) {
        // TODO zoom camera only if the whole map is the current focus
        zoomCamera(delta, this.state.camera, 2, 95);
    }

    onRotate(delta) {
        // TODO rotate camera only if the whole map is the current focus
        rotateCamera(delta, this.state.camera, this.props.size.width, this.props.size.height);
    }

    render() {
        const cameraProps = {
            name: 'camera',
            fov: 45,
            aspect: this.props.size.width / this.props.size.height,
            near: 0.1,
            far: 100,
            position: this.state.cameraPosition,
            lookAt: this.state.position
        };
        const width = this.props.scenario ? this.props.scenario.width : 20;
        const depth = this.props.scenario ? this.props.scenario.height : 20;
        return (
            <div className='canvas'>
                <GestureControls
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onRotate={this.onRotate}
                >
                    <React3 mainCamera='camera' width={this.props.size.width} height={this.props.size.height} clearColor={0x808080}>
                        <scene>
                            <perspectiveCamera {...cameraProps} ref={this.setCamera}/>
                            <ambientLight/>
                            <mesh position={this.state.position}>
                                <boxGeometry width={width} depth={depth} height={0.01}/>
                                <meshBasicMaterial map={this.state.texture}/>
                            </mesh>
                        </scene>
                    </React3>
                </GestureControls>
            </div>
        );
    }
}

export default sizeMe({monitorHeight: true})(MapViewComponent);