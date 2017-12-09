import React, {Component} from 'react';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import {sizeMe} from 'react-sizeme';
import {connect} from 'react-redux';

import GestureControls from '../container/GestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/OrbitCameraUtils';
import DriveTextureLoader from '../util/DriveTextureLoader';
import {getScenarioFromStore, updateMiniPositionAction} from '../redux/scenarioReducer';

import './MapViewComponent.css';

class MapViewComponent extends Component {

    static MINI_WIDTH = 0.05;
    static MINI_ADJUST = new THREE.Vector3(0, MapViewComponent.MINI_WIDTH, -MapViewComponent.MINI_WIDTH / 2);
    static ROTATION_XZ = new THREE.Euler(-Math.PI/2, 0, 0);

    constructor(props) {
        super(props);
        this.setScene = this.setScene.bind(this);
        this.setCamera = this.setCamera.bind(this);
        this.onGestureStart = this.onGestureStart.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onRotate = this.onRotate.bind(this);
        this.textureLoader = new DriveTextureLoader();
        this.rayCaster = new THREE.Raycaster();
        this.rayPoint = new THREE.Vector2();
        this.offset = new THREE.Vector3();
        this.state = {
            cameraPosition: new THREE.Vector3(0, 10, 10),
            camera: null,
            textures: this.getTexturesFromProps(props)
        };
        this.nonRenderState = {
            selected: null
        }
    }

    componentWillReceiveProps(props) {
        this.setState({
            textures: this.getTexturesFromProps(props)
        });
    }

    getTexturesFromProps(props) {
        let result = {};
        const previous = (this.state && this.state.textures) || {};
        Object.keys(props.scenario.maps).forEach((id) => {
            result[id] = previous[id] || this.textureLoader.loadTexture(props.scenario.maps[id].metadata);
        });
        Object.keys(props.scenario.minis).forEach((id) => {
            result[id] = previous[id] || this.textureLoader.loadTexture(props.scenario.minis[id].metadata);
        });
        return result;
    }

    setScene(scene) {
        this.setState({scene});
    }

    setCamera(camera) {
        this.setState({camera});
    }

    onGestureStart(position) {
        this.nonRenderState.selected = null;
        this.rayPoint.x = 2 * position.x / this.props.size.width - 1;
        this.rayPoint.y = 1 - 2 * position.y / this.props.size.height;
        this.rayCaster.setFromCamera(this.rayPoint, this.state.camera);
        let intersects = this.rayCaster.intersectObjects(this.state.scene.children, true);
        if (intersects.length > 0) {
            let first = intersects[0].object;
            while (first && !first.userDataA) {
                first = first.parent;
            }
            if (first && first.userDataA.mini) {
                this.nonRenderState.selected = first.userDataA;
            }
        }
    }

    panMini(delta, mini) {
        let {position} = this.props.scenario.minis[mini.id];
        this.offset.copy(this.state.camera.position).sub(position);
        const distance = this.offset.length() * Math.tan(this.state.camera.fov);
        const worldDelta = {x: delta.x * distance / this.props.size.width, y: 0, z: delta.y * distance / this.props.size.height};
        position = position.clone().add(worldDelta);
        this.props.dispatch(updateMiniPositionAction(mini.id, position));
    }

    onPan(delta) {
        if (!this.nonRenderState.selected) {
            panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height);
        } else if (this.nonRenderState.selected.mini) {
            this.panMini(delta, this.nonRenderState.selected.mini);
        }
    }

    onZoom(delta) {
        if (!this.nonRenderState.selected) {
            zoomCamera(delta, this.state.camera, 2, 95);
        }
    }

    onRotate(delta) {
        if (!this.nonRenderState.selected) {
            rotateCamera(delta, this.state.camera, this.props.size.width, this.props.size.height);
        }
    }

    renderResources() {
        const width = 1;
        const height = 1.2;
        const radius = 0.1;
        return (
            <resources>
                <shape resourceId='mini'>
                    <moveTo x={0} y={0} />
                    <lineTo x={0} y={height - radius} />
                    <quadraticCurveTo cpX={0} cpY={height} x={radius} y={height} />
                    <lineTo x={width - radius} y={height} />
                    <quadraticCurveTo cpX={width} cpY={height} x={width} y={height - radius} />
                    <lineTo x={width} y={0} />
                    <lineTo x={0} y={0} />
                </shape>
                <shape resourceId='base'>
                    <absArc x={0.5} y={0} radius={0.5} startAngle={0} endAngle={Math.PI * 2} clockwise={false} />
                </shape>
            </resources>
        );
    }

    renderMaps() {
        return Object.keys(this.props.scenario.maps).map((id) => {
            const {metadata, position} = this.props.scenario.maps[id];
            const width = Number(metadata.appProperties.width);
            const height = Number(metadata.appProperties.height);
            return (
                <mesh key={id} position={position} ref={(mesh) => {
                    if (mesh) {
                        mesh.userDataA = {map: metadata}
                    }
                }}>
                    <boxGeometry width={width} depth={height} height={0.01}/>
                    <meshBasicMaterial map={this.state.textures[metadata.id]}/>
                </mesh>
            );
        });
    }

    renderMinis() {
        return Object.keys(this.props.scenario.minis).map((id) => {
            const {metadata, position} = this.props.scenario.minis[id];
            return (
                <group key={id} position={position} ref={(group) => {
                    if (group) {
                        group.userDataA = {mini: metadata}
                    }
                }}>
                    <mesh position={MapViewComponent.MINI_ADJUST}>
                        <extrudeGeometry settings={{amount: MapViewComponent.MINI_WIDTH, bevelEnabled: false}}>
                            <shapeResource resourceId='mini'/>
                        </extrudeGeometry>
                        <meshBasicMaterial map={this.state.textures[metadata.id]}/>
                    </mesh>
                    <mesh rotation={MapViewComponent.ROTATION_XZ}>
                        <extrudeGeometry settings={{amount: MapViewComponent.MINI_WIDTH, bevelEnabled: false}}>
                            <shapeResource resourceId='base'/>
                        </extrudeGeometry>
                        <meshPhongMaterial color='black' />
                    </mesh>
                </group>
            );
        });
    }

    render() {
        const cameraProps = {
            name: 'camera',
            fov: 45,
            aspect: this.props.size.width / this.props.size.height,
            near: 0.1,
            far: 200,
            position: this.state.cameraPosition,
            lookAt: new THREE.Vector3(0, 0, 0)
        };
        return (
            <div className='canvas'>
                <GestureControls
                    onGestureStart={this.onGestureStart}
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onRotate={this.onRotate}
                >
                    <React3 mainCamera='camera' width={this.props.size.width} height={this.props.size.height}
                            clearColor={0x808080}>
                        {this.renderResources()}
                        <scene ref={this.setScene}>
                            <perspectiveCamera {...cameraProps} ref={this.setCamera}/>
                            <ambientLight/>
                            {this.renderMaps()}
                            {this.renderMinis()}
                        </scene>
                    </React3>
                </GestureControls>
            </div>
        );
    }
}

function mapStoreToProps(store) {
    return {
        scenario: getScenarioFromStore(store)
    }
}

export default sizeMe({monitorHeight: true})(connect(mapStoreToProps)(MapViewComponent));