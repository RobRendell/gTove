import React, {Component} from 'react';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import {sizeMe} from 'react-sizeme';
import {connect} from 'react-redux';

import GestureControls from '../container/GestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/OrbitCameraUtils';
import DriveTextureLoader from '../util/DriveTextureLoader';
import {
    getScenarioFromStore, updateMapPositionAction, updateMapRotationAction, updateMiniElevationAction,
    updateMiniPositionAction,
    updateMiniRotationAction
} from '../redux/scenarioReducer';
import {cacheTextureAction, getAllTexturesFromStore} from '../redux/textureReducer';

import './MapViewComponent.css';

class MapViewComponent extends Component {

    static MINI_THICKNESS = 0.05;
    static MINI_WIDTH = 1;
    static MINI_HEIGHT = 1.2;
    static ARROW_SIZE = 0.1;
    static MINI_ADJUST = new THREE.Vector3(0, MapViewComponent.MINI_THICKNESS, -MapViewComponent.MINI_THICKNESS / 2);
    static ROTATION_XZ = new THREE.Euler(-Math.PI / 2, 0, 0);
    static ORIGIN = new THREE.Vector3();
    static UP = new THREE.Vector3(0, 1, 0);
    static DOWN = new THREE.Vector3(0, -1, 0);

    static HIGHLIGHT_SCALE_VECTOR = new THREE.Vector3(1, 1, 1).multiplyScalar(1.1);
    static OUTLINE_SHADER = {
        uniforms: {
            c: {type: 'f', value: 0.7},
            glowColor: {type: 'c', value: new THREE.Color(0xffff00)},
            viewVector: {type: 'v3', value: new THREE.Vector3()}
        },
        vertex_shader: `
            uniform vec3 viewVector;
            uniform float c;
            varying float intensity;
            void main() {
                vec3 vNormal = normalize(normalMatrix * normal);
                vec3 vNormel = normalize(normalMatrix * viewVector);
                intensity = (c - dot(vNormal, vNormel))*(c - dot(vNormal, vNormel));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragment_shader: `
            uniform vec3 glowColor;
            varying float intensity;
            void main() {
                vec3 glow = glowColor * intensity;
                gl_FragColor = vec4(glow, 1.0);
            }
        `
    };
    static HIGHLIGHT_MATERIAL = (
        <shaderMaterial
            uniforms={MapViewComponent.OUTLINE_SHADER.uniforms}
            vertexShader={MapViewComponent.OUTLINE_SHADER.vertex_shader}
            fragmentShader={MapViewComponent.OUTLINE_SHADER.fragment_shader}
            blending={THREE.AdditiveBlending}
            transparent
        />
    );
    static MINIATURE_SHADER = {
        vertex_shader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
                vUv = uv;
                vNormal = normal;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragment_shader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            uniform bool textureReady;
            uniform sampler2D texture1;
            void main() {
                if (!textureReady) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                } else if (vUv.x < 0.0 || vUv.x >= 1.0 || vUv.y < 0.0 || vUv.y >= 1.0) {
                    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
                } else {
                    vec4 pix = texture2D(texture1, vUv);
                    if (vNormal.z < 0.0) {
                        float grey = (pix.x + pix.y + pix.z)/3.0;
                        pix = vec4(grey, grey, grey, 1.0);
                    }
                    gl_FragColor = pix;
                }
            }
        `
    };


    constructor(props) {
        super(props);
        this.setScene = this.setScene.bind(this);
        this.setCamera = this.setCamera.bind(this);
        this.onGestureStart = this.onGestureStart.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.onTap = this.onTap.bind(this);
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
                const metadata = models[id].metadata;
                if (props.texture[metadata.id] === undefined) {
                    this.props.dispatch(cacheTextureAction(metadata.id, null));
                    this.textureLoader.loadTexture(metadata, (texture) => {
                        this.props.dispatch(cacheTextureAction(metadata.id, texture));
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

    rayCastForFirstUserDataField(position, field) {
        let intersects = this.rayCastFromScreen(position);
        return intersects.reduce((selected, intersect) => {
            if (selected) {
                return selected;
            } else {
                selected = intersect.object;
                while (selected && !(selected.userDataA && selected.userDataA[field])) {
                    selected = selected.parent;
                }
                return selected ? {[field]: selected.userDataA[field], point: intersect.point} : null;
            }
        }, null);
    }

    panMini(position, id) {
        const selected = this.rayCastForFirstUserDataField(position, 'mapId');
        // If the ray intersects with a map, drag over the map - otherwise drag over starting plane.
        const dragY = selected ? (this.props.scenario.maps[selected.mapId].position.y - this.state.dragOffset.y) : this.state.defaultDragY;
        this.plane.setComponents(0, -1, 0, dragY);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset);
            this.props.dispatch(updateMiniPositionAction(id, this.offset.clone()));
        }
    }

    panMap(position, id) {
        const dragY = this.props.scenario.maps[id].position.y;
        this.plane.setComponents(0, -1, 0, dragY);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset);
            this.props.dispatch(updateMapPositionAction(id, this.offset.clone()));
        }
    }

    rotateMini(delta, id) {
        const {rotation} = this.props.scenario.minis[id];
        let newRotation = rotation.clone();
        // rotating across whole screen goes 360 degrees around
        newRotation.y += 2 * Math.PI * delta.x / this.props.size.width;
        this.props.dispatch(updateMiniRotationAction(id, newRotation));
    }

    rotateMap(delta, id) {
        const {rotation} = this.props.scenario.maps[id];
        let newRotation = rotation.clone();
        // rotating across whole screen goes 360 degrees around
        newRotation.y += 2 * Math.PI * delta.x / this.props.size.width;
        this.props.dispatch(updateMapRotationAction(id, newRotation));
    }

    elevateMini(delta, id) {
        const {elevation} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniElevationAction(id, elevation - delta.y / 20));
    }

    elevateMap(delta, mapId) {
        this.offset.copy(this.props.scenario.maps[mapId].position).add({x: 0, y: -delta.y / 20, z: 0});
        this.props.dispatch(updateMapPositionAction(mapId, this.offset.clone()));
    }

    onGestureStart(position) {
        if (!this.state.selected) {
            let selected = this.rayCastForFirstUserDataField(position, 'miniId');
            if (selected) {
                let {position} = this.props.scenario.minis[selected.miniId];
                this.offset.copy(position).sub(selected.point);
                const dragOffset = {...this.offset};
                this.setState({selected, dragOffset, defaultDragY: selected.point.y});
            }
        } else if (this.state.selected.mapId) {
            // reset dragOffset to the new offset
            const mapId = this.state.selected.mapId;
            let {position: mapPosition} = this.props.scenario.maps[mapId];
            const dragY = mapPosition.y;
            this.plane.setComponents(0, -1, 0, dragY);
            this.rayCastFromScreen(position);
            if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
                this.offset.sub(mapPosition);
                const dragOffset = {x: -this.offset.x, y: 0, z: -this.offset.z};
                this.setState({dragOffset});
            }
        }
    }

    onGestureEnd() {
        this.setState({selected: null});
    }

    onTap(position) {
        let selected = this.rayCastForFirstUserDataField(position, 'mapId');
        if (selected) {
            let {position} = this.props.scenario.maps[selected.mapId];
            this.offset.copy(position).sub(selected.point);
            const dragOffset = {...this.offset, y: 0};
            this.setState({selected, dragOffset});
        }
    }

    onPan(delta, position) {
        if (!this.state.selected) {
            this.setState(panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        } else if (this.state.selected.miniId) {
            this.panMini(position, this.state.selected.miniId);
        } else if (this.state.selected.mapId) {
            this.panMap(position, this.state.selected.mapId);
        }
    }

    onZoom(delta) {
        if (!this.state.selected) {
            this.setState(zoomCamera(delta, this.state.camera, 2, 95));
        } else if (this.state.selected.miniId) {
            this.elevateMini(delta, this.state.selected.miniId);
        } else if (this.state.selected.mapId) {
            this.elevateMap(delta, this.state.selected.mapId);
        }
    }

    onRotate(delta) {
        if (!this.state.selected) {
            this.setState(rotateCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        } else if (this.state.selected.miniId) {
            this.rotateMini(delta, this.state.selected.miniId);
        } else if (this.state.selected.mapId) {
            this.rotateMap(delta, this.state.selected.mapId);
        }
    }

    renderResources() {
        const width = MapViewComponent.MINI_WIDTH;
        const height = MapViewComponent.MINI_HEIGHT;
        const radius = width/10;
        return (
            <resources>
                <shape resourceId='mini'>
                    <moveTo x={-width / 2} y={0}/>
                    <lineTo x={-width / 2} y={height - radius}/>
                    <quadraticCurveTo cpX={-width / 2} cpY={height} x={radius - width / 2} y={height}/>
                    <lineTo x={width / 2 - radius} y={height}/>
                    <quadraticCurveTo cpX={width / 2} cpY={height} x={width / 2} y={height - radius}/>
                    <lineTo x={width / 2} y={0}/>
                    <lineTo x={-width / 2} y={0}/>
                </shape>
                <shape resourceId='base'>
                    <absArc x={0} y={0} radius={width / 2} startAngle={0} endAngle={Math.PI * 2} clockwise={false}/>
                </shape>
            </resources>
        );
    }

    renderMaps() {
        return Object.keys(this.props.scenario.maps).map((id) => {
            const {metadata, position, rotation} = this.props.scenario.maps[id];
            const width = Number(metadata.appProperties.width);
            const height = Number(metadata.appProperties.height);
            return (
                <group key={id} position={position} rotation={rotation} ref={(mesh) => {
                    if (mesh) {
                        mesh.userDataA = {mapId: id}
                    }
                }}>
                    <mesh>
                        <boxGeometry width={width} depth={height} height={0.01}/>
                        <meshBasicMaterial map={this.props.texture[metadata.id]}/>
                    </mesh>
                    {
                        (this.state.selected && this.state.selected.mapId === id) ? (
                            <mesh scale={MapViewComponent.HIGHLIGHT_SCALE_VECTOR}>
                                <boxGeometry width={width} depth={height} height={0.01}/>
                                {MapViewComponent.HIGHLIGHT_MATERIAL}
                            </mesh>
                        ) : null
                    }
                </group>
            );
        });
    }

    renderMinis() {
        const miniAspectRatio = MapViewComponent.MINI_WIDTH / MapViewComponent.MINI_HEIGHT;
        return Object.keys(this.props.scenario.minis).map((id) => {
            const {metadata, position, rotation, elevation} = this.props.scenario.minis[id];
            const width = Number(metadata.appProperties.width);
            const height = Number(metadata.appProperties.height);
            const aspectRatio = width / height;
            const rangeU = (aspectRatio > miniAspectRatio ? MapViewComponent.MINI_WIDTH : aspectRatio / MapViewComponent.MINI_HEIGHT);
            const offU = 0.5;
            const rangeV = (aspectRatio > miniAspectRatio ? MapViewComponent.MINI_WIDTH / aspectRatio : MapViewComponent.MINI_HEIGHT);
            const offV = (1 - MapViewComponent.MINI_HEIGHT / rangeV) / 2;
            let offset = MapViewComponent.MINI_ADJUST.clone();
            const arrowDir = elevation > MapViewComponent.ARROW_SIZE ?
                MapViewComponent.UP :
                (elevation < -MapViewComponent.MINI_HEIGHT - MapViewComponent.ARROW_SIZE ? MapViewComponent.DOWN : null);
            const arrowLength = elevation > 0 ?
                elevation + MapViewComponent.MINI_THICKNESS :
                (-elevation - MapViewComponent.MINI_HEIGHT - MapViewComponent.MINI_THICKNESS);
            if (arrowDir) {
                offset.y += elevation;
            }
            return (
                <group key={id} position={position} rotation={rotation} ref={(group) => {
                    if (group) {
                        group.userDataA = {miniId: id}
                    }
                }}>
                    <mesh position={offset}>
                        <extrudeGeometry
                            settings={{amount: MapViewComponent.MINI_THICKNESS, bevelEnabled: false, extrudeMaterial: 1}}
                            UVGenerator={{
                                generateTopUV: (geometry, vertices, indexA, indexB, indexC) => {
                                    let result = THREE.ExtrudeGeometry.WorldUVGenerator.generateTopUV(geometry, vertices, indexA, indexB, indexC);
                                    return result.map((uv) => (
                                        new THREE.Vector2(offU + uv.x / rangeU, offV + uv.y / rangeV)
                                    ));
                                },
                                generateSideWallUV: () => ([
                                    new THREE.Vector2(0, 0),
                                    new THREE.Vector2(0, 0),
                                    new THREE.Vector2(0, 0),
                                    new THREE.Vector2(0, 0)
                                ])
                            }}
                        >
                            <shapeResource resourceId='mini'/>
                        </extrudeGeometry>
                        <shaderMaterial
                            vertexShader={MapViewComponent.MINIATURE_SHADER.vertex_shader}
                            fragmentShader={MapViewComponent.MINIATURE_SHADER.fragment_shader}
                        >
                            <uniforms>
                                <uniform type='b' name='textureReady' value={this.props.texture[metadata.id] !== null} />
                                <uniform type='t' name='texture1' value={this.props.texture[metadata.id]} />
                            </uniforms>
                        </shaderMaterial>
                    </mesh>
                    <mesh rotation={MapViewComponent.ROTATION_XZ}>
                        <extrudeGeometry settings={{amount: MapViewComponent.MINI_THICKNESS, bevelEnabled: false}}>
                            <shapeResource resourceId='base'/>
                        </extrudeGeometry>
                        <meshPhongMaterial color='black'/>
                    </mesh>
                    {
                        arrowDir ? (
                            <arrowHelper
                                origin={MapViewComponent.ORIGIN}
                                dir={arrowDir}
                                length={arrowLength}
                                headLength={MapViewComponent.ARROW_SIZE}
                                headWidth={MapViewComponent.ARROW_SIZE}
                            />
                        ) : null
                    }
                    {
                        (this.state.selected && this.state.selected.miniId === id) ? (
                            <group scale={MapViewComponent.HIGHLIGHT_SCALE_VECTOR}>
                                <mesh position={offset}>
                                    <extrudeGeometry settings={{amount: MapViewComponent.MINI_THICKNESS, bevelEnabled: false}}>
                                        <shapeResource resourceId='mini'/>
                                    </extrudeGeometry>
                                    {MapViewComponent.HIGHLIGHT_MATERIAL}
                                </mesh>
                                <mesh rotation={MapViewComponent.ROTATION_XZ}>
                                    <extrudeGeometry settings={{amount: MapViewComponent.MINI_THICKNESS, bevelEnabled: false}}>
                                        <shapeResource resourceId='base'/>
                                    </extrudeGeometry>
                                    {MapViewComponent.HIGHLIGHT_MATERIAL}
                                </mesh>
                            </group>
                        ) : null
                    }
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
        MapViewComponent.OUTLINE_SHADER.uniforms.viewVector.value = this.state.cameraPosition;
        return (
            <div className='canvas'>
                <GestureControls
                    onGestureStart={this.onGestureStart}
                    onGestureEnd={this.onGestureEnd}
                    onTap={this.onTap}
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onRotate={this.onRotate}
                >
                    <React3 mainCamera='camera' width={this.props.size.width} height={this.props.size.height}
                            clearColor={0x808080} forceManualRender onManualRenderTriggerCreated={(trigger) => {
                        trigger()
                    }}>
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