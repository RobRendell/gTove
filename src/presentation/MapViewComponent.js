import React, {Component} from 'react';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import {sizeMe} from 'react-sizeme';
import {connect} from 'react-redux';

import GestureControls from '../container/GestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/OrbitCameraUtils';
import DriveTextureLoader from '../util/DriveTextureLoader';
import {getScenarioFromStore, updateMiniPositionAction} from '../redux/scenarioReducer';
import {cacheTextureAction, getAllTexturesFromStore} from '../redux/textureReducer';

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
        this.plane = new THREE.Plane();
        this.state = {
            cameraPosition: new THREE.Vector3(0, 10, 10),
            cameraLookAt: new THREE.Vector3(0, 0, 0),
            camera: null,
            selected: null,
            dragOffset: null,
            defaultDragY: null
        };
    }

    componentWillMount() {
        this.ensureTexturesFromProps(this.props);
    }

    componentWillReceiveProps(props) {
        this.ensureTexturesFromProps(props);
    }

    ensureTexturesFromProps(props) {
        [props.scenario.maps, props.scenario.minis].forEach((models) => {
            Object.keys(models).forEach((id) => {
                if (!props.texture[id]) {
                    this.textureLoader.loadTexture(models[id].metadata, (texture) => {
                        this.props.dispatch(cacheTextureAction(id, texture));
                    });
                }
            });
        });
    }

    setScene(scene) {
        this.setState({scene});
    }

    setCamera(camera) {
        this.setState({camera});
    }

    rayCastFromScreen(position) {
        this.rayPoint.x = 2 * position.x / this.props.size.width - 1;
        this.rayPoint.y = 1 - 2 * position.y / this.props.size.height;
        this.rayCaster.setFromCamera(this.rayPoint, this.state.camera);
        return this.rayCaster.intersectObjects(this.state.scene.children, true);
    }

    onGestureStart(position) {
        let selected = null;
        let intersects = this.rayCastFromScreen(position);
        if (intersects.length > 0) {
            let first = intersects[0].object;
            while (first && !first.userDataA) {
                first = first.parent;
            }
            if (first && first.userDataA.mini) {
                selected = first.userDataA;
            }
        }
        if (selected) {
            let {position} = this.props.scenario.minis[selected.mini.id];
            this.offset.copy(position).sub(intersects[0].point);
            const dragOffset = {...this.offset};
            this.setState({selected, dragOffset, defaultDragY: intersects[0].point.y});
        } else {
            this.setState({selected});
        }
    }

    panMini(position, mini) {
        let mapPosition = this.rayCastFromScreen(position).reduce((map, intersect) => {
            return map || (intersect.object.userDataA && intersect.object.userDataA.map && this.props.scenario.maps[intersect.object.userDataA.map.id].position);
        }, null);
        // If the ray intersects with a map, drag over the map - otherwise drag over starting plane.
        let dragY = mapPosition ? (mapPosition.y - this.state.dragOffset.y) : this.state.defaultDragY;
        this.plane.setComponents(0, -1, 0, dragY);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset);
            this.props.dispatch(updateMiniPositionAction(mini.id, this.offset.clone()));
        }
    }

    onPan(delta, position) {
        if (!this.state.selected) {
            this.setState(panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        } else if (this.state.selected.mini) {
            this.panMini(position, this.state.selected.mini);
        }
    }

    onZoom(delta) {
        if (!this.state.selected) {
            this.setState(zoomCamera(delta, this.state.camera, 2, 95));
        }
    }

    onRotate(delta) {
        if (!this.state.selected) {
            this.setState(rotateCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
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
                    <meshBasicMaterial map={this.props.texture[metadata.id]}/>
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
                        <meshBasicMaterial map={this.props.texture[metadata.id]}/>
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
            lookAt: this.state.cameraLookAt
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
                            clearColor={0x808080} forceManualRender onManualRenderTriggerCreated={(trigger) => {trigger()}}>
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
        scenario: getScenarioFromStore(store),
        texture: getAllTexturesFromStore(store)
    }
}

export default sizeMe({monitorHeight: true})(connect(mapStoreToProps)(MapViewComponent));