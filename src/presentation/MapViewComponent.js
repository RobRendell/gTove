import React, {Component} from 'react';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import {sizeMe} from 'react-sizeme';

import '../style/mapView.css';
import UserControls from '../container/UserControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/OrbitCameraUtils';

class MapViewComponent extends Component {

    constructor(props) {
        super(props);
        this.setCamera = this.setCamera.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onRotate = this.onRotate.bind(this);
        this.state = {
            cameraPosition: new THREE.Vector3(0, 10, 10),
            camera: null,
            position: new THREE.Vector3(0, 0, 0),
            texture: new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/RCA_Indian_Head_test_pattern.JPG/640px-RCA_Indian_Head_test_pattern.JPG')
        };
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
        return (
            <div className='canvas'>
                <UserControls
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onRotate={this.onRotate}
                >
                    <React3 mainCamera='camera' width={this.props.size.width} height={this.props.size.height} clearColor={0x808080}>
                        <scene>
                            <perspectiveCamera {...cameraProps} ref={this.setCamera}/>
                            <ambientLight/>
                            <mesh position={this.state.position}>
                                <boxGeometry width={20} depth={20} height={0.1}/>
                                <meshBasicMaterial map={this.state.texture}/>
                            </mesh>
                        </scene>
                    </React3>
                </UserControls>
            </div>
        );
    }
}

export default sizeMe({monitorHeight: true})(MapViewComponent);