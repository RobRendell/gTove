import React, {Component} from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import sizeMe from 'react-sizeme';
import {connect} from 'react-redux';
import {clamp} from 'lodash';

import GestureControls from '../container/GestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/OrbitCameraUtils';
import {
    getScenarioFromStore, updateMapFogOfWarAction, updateMapPositionAction, updateMapRotationAction,
    updateMiniElevationAction, updateMiniPositionAction, updateMiniRotationAction, updateMiniScaleAction
} from '../redux/scenarioReducer';
import {cacheTextureAction, getAllTexturesFromStore} from '../redux/textureReducer';
import TabletopMapComponent from './TabletopMapComponent';
import TabletopMiniComponent from './TabletopMiniComponent';
import {buildEuler} from '../util/threeUtils';

import './TabletopViewComponent.css';

class TabletopViewComponent extends Component {

    static propTypes = {
        selectMiniOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
        selectMapOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
        fogOfWarOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
        transparentFog: PropTypes.bool.isRequired,
        fogOfWarMode: PropTypes.bool.isRequired,
        snapToGrid: PropTypes.bool.isRequired,
        readOnly: PropTypes.bool,
        playerView: PropTypes.bool
    };

    static defaultProps = {
        readOnly: false,
        playerView: false
    };

    static contextTypes = {
        textureLoader: PropTypes.object
    };

    static DIR_EAST = new THREE.Vector3(1, 0, 0);
    static DIR_WEST = new THREE.Vector3(-1, 0, 0);
    static DIR_NORTH = new THREE.Vector3(0, 0, 1);
    static DIR_SOUTH = new THREE.Vector3(0, 0, -1);

    static FOG_RECT_HEIGHT_ADJUST = 0.02;
    static FOG_RECT_DRAG_BORDER = 30;

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
        this.autoPanForFogOfWarRect = this.autoPanForFogOfWarRect.bind(this);
        this.snapMap = this.snapMap.bind(this);
        this.snapMini = this.snapMini.bind(this);
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
            defaultDragY: null,
            menuSelected: null,
            fogWidth: {},
            fogHeight: {},
            usingDragHandle: false
        };
    }

    componentWillMount() {
        this.updateStateFromProps(this.props);
    }

    componentWillReceiveProps(props) {
        this.updateStateFromProps(props);
    }

    updateStateFromProps(props) {
        [props.scenario.maps, props.scenario.minis].forEach((models) => {
            Object.keys(models).forEach((id) => {
                const metadata = models[id].metadata;
                if (metadata && props.texture[metadata.id] === undefined) {
                    this.props.dispatch(cacheTextureAction(metadata.id, null));
                    this.context.textureLoader.loadTexture(metadata, (texture) => {
                        this.props.dispatch(cacheTextureAction(metadata.id, texture));
                    });
                }
            });
        });
        const {fogWidth, fogHeight} = Object.keys(props.scenario.maps).reduce((result, mapId) => {
            const appProperties = props.scenario.maps[mapId].metadata.appProperties;
            const mapWidth = Number(appProperties.width);
            const mapHeight = Number(appProperties.height);
            const gridSize = Number(appProperties.gridSize);
            const gridOffsetX = (1 + Number(appProperties.gridOffsetX) / gridSize) % 1;
            const gridOffsetY = (1 + Number(appProperties.gridOffsetY) / gridSize) % 1;
            const fogWidth = Math.ceil(mapWidth + 1 - gridOffsetX);
            const fogHeight = Math.ceil(mapHeight + 1 - gridOffsetY);
            if (fogWidth !== this.state.fogWidth[mapId] || fogHeight !== this.state.fogHeight[mapId]) {
                result.fogWidth = {...result.fogWidth, [mapId]: fogWidth};
                result.fogHeight = {...result.fogHeight, [mapId]: fogHeight};
            }
            return result;
        }, {});
        if (fogWidth) {
            this.setState({fogWidth, fogHeight});
        }
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

    findAncestorWithUserDataFields(object, fields) {
        const reduceFields = (result, field) => (result || (object.userDataA[field] && field));
        while (object) {
            let matchingField = object.userDataA && fields.reduce(reduceFields, null);
            if (matchingField) {
                return [object, matchingField];
            } else {
                object = object.parent;
            }
        }
        return [];
    }

    rayCastForFirstUserDataFields(position, fields, intersects = this.rayCastFromScreen(position)) {
        if (!Array.isArray(fields)) {
            fields = [fields];
        }
        return intersects.reduce((selected, intersect) => {
            if (selected) {
                return selected;
            } else {
                let [object, field] = this.findAncestorWithUserDataFields(intersect.object, fields);
                return object ? {[field]: object.userDataA[field], point: intersect.point, position} : null;
            }
        }, null);
    }

    panMini(position, id) {
        const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
        // If the ray intersects with a map, drag over the map - otherwise drag over starting plane.
        const dragY = selected ? (this.props.scenario.maps[selected.mapId].position.y - this.state.dragOffset.y) : this.state.defaultDragY;
        this.plane.setComponents(0, -1, 0, dragY);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset);
            this.props.dispatch(updateMiniPositionAction(id, this.offset));
        }
    }

    panMap(position, id) {
        const dragY = this.props.scenario.maps[id].position.y;
        this.plane.setComponents(0, -1, 0, dragY);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset);
            this.props.dispatch(updateMapPositionAction(id, this.offset));
        }
    }

    rotateMini(delta, id) {
        let rotation = buildEuler(this.props.scenario.minis[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * delta.x / this.props.size.width;
        this.props.dispatch(updateMiniRotationAction(id, rotation));
    }

    rotateMap(delta, id) {
        let rotation = buildEuler(this.props.scenario.maps[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * delta.x / this.props.size.width;
        this.props.dispatch(updateMapRotationAction(id, rotation));
    }

    elevateMini(delta, id) {
        const {elevation} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniElevationAction(id, elevation - delta.y / 20));
    }

    scaleMini(delta, id) {
        const {scale} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniScaleAction(id, Math.max(0.25, scale - delta.y / 20)));
    }

    elevateMap(delta, mapId) {
        this.offset.copy(this.props.scenario.maps[mapId].position).add({x: 0, y: -delta.y / 20, z: 0});
        this.props.dispatch(updateMapPositionAction(mapId, this.offset));
    }

    autoPanForFogOfWarRect() {
        if (!this.state.fogOfWarRect) {
            clearInterval(this.state.autoPanInterval);
            this.setState({autoPanInterval: null});
            return;
        }
        let delta = {x: 0, y: 0};
        const dragBorder = Math.min(TabletopViewComponent.FOG_RECT_DRAG_BORDER, this.props.size.width / 10, this.props.size.height / 10);
        const {position} = this.state.fogOfWarRect;
        if (position.x < dragBorder) {
            delta.x = dragBorder - position.x;
        } else if (position.x >= this.props.size.width - dragBorder) {
            delta.x = this.props.size.width - dragBorder - position.x;
        }
        if (position.y < dragBorder) {
            delta.y = dragBorder - position.y;
        } else if (position.y >= this.props.size.height - dragBorder) {
            delta.y = this.props.size.height - dragBorder - position.y;
        }
        if (delta.x || delta.y) {
            this.setState(panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        }
    }

    dragFogOfWarRect(position, startPos) {
        let fogOfWarRect = this.state.fogOfWarRect;
        if (!fogOfWarRect) {
            const selected = this.rayCastForFirstUserDataFields(startPos, 'mapId');
            if (selected) {
                const dragY = this.props.scenario.maps[selected.mapId].position.y;
                const map = this.props.scenario.maps[selected.mapId];
                this.plane.setComponents(0, -1, 0, dragY + TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST);
                if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
                    fogOfWarRect = {mapId: selected.mapId, startPos: this.offset.clone(), colour: map.metadata.appProperties.gridColour || 'black'};
                }
            }
            if (!fogOfWarRect) {
                return;
            } else {
                this.setState({autoPanInterval: setInterval(this.autoPanForFogOfWarRect, 100)});
            }
        }
        const mapY = this.props.scenario.maps[fogOfWarRect.mapId].position.y;
        this.plane.setComponents(0, -1, 0, mapY + TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.setState({fogOfWarRect: {...fogOfWarRect, endPos: this.offset.clone(), position, showButtons: false}});
        }
    }

    onGestureStart(position) {
        this.setState({menuSelected: null});
        const selected = this.rayCastForFirstUserDataFields(position, ['miniId', 'mapId']);
        if (this.state.selected && this.state.selected.mapId &&
            selected && this.state.selected.mapId === selected.mapId) {
            // reset dragOffset to the new offset
            const {position} = this.props.scenario.maps[this.state.selected.mapId];
            this.offset.copy(selected.point).sub(position);
            const dragOffset = {x: -this.offset.x, y: 0, z: -this.offset.z};
            this.setState({dragOffset});
        } else if (selected && selected.miniId && !this.props.fogOfWarMode) {
            const {position} = this.props.scenario.minis[selected.miniId];
            this.offset.copy(position).sub(selected.point);
            const dragOffset = {...this.offset};
            this.state.selected && this.state.selected.finish && this.state.selected.finish();
            this.setState({selected, dragOffset, defaultDragY: selected.point.y});
        } else {
            this.state.selected && this.state.selected.finish && this.state.selected.finish();
            this.setState({selected: null});
        }
    }

    onGestureEnd() {
        if (this.props.snapToGrid && this.state.selected) {
            if (this.state.selected.mapId) {
                const {positionObj, rotationObj} = this.snapMap(this.state.selected.mapId);
                this.props.dispatch(updateMapPositionAction(this.state.selected.mapId, positionObj, false));
                this.props.dispatch(updateMapRotationAction(this.state.selected.mapId, rotationObj, false));
            } else {
                const {positionObj, rotationObj, scaleFactor, elevation} = this.snapMini(this.state.selected.miniId);
                this.props.dispatch(updateMiniPositionAction(this.state.selected.miniId, positionObj, false));
                this.props.dispatch(updateMiniRotationAction(this.state.selected.miniId, rotationObj, false));
                this.props.dispatch(updateMiniElevationAction(this.state.selected.miniId, elevation, false));
                this.props.dispatch(updateMiniScaleAction(this.state.selected.miniId, scaleFactor, false));
            }
        }
        const fogOfWarRect = this.state.fogOfWarRect ? {
            ...this.state.fogOfWarRect,
            showButtons: true
        } : null;
        const selected = (this.state.selected && this.state.selected.mapId) ? this.state.selected : null;
        !selected && this.state.selected && this.state.selected.finish && this.state.selected.finish();
        this.setState({selected, usingDragHandle: false, fogOfWarRect});
    }

    onTap(position) {
        if (this.state.usingDragHandle) {
            // show menu
            this.setState({
                menuSelected: {
                    buttons: this.props.fogOfWarOptions,
                    selected: {position},
                    id: 0
                }
            });
        } else if (this.props.fogOfWarMode) {
            const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
            if (selected) {
                this.changeFogOfWarBitmask(null, {mapId: selected.mapId, startPos: selected.point, endPos: selected.point});
            }
        } else {
            const selected = this.rayCastForFirstUserDataFields(position, ['mapId', 'miniId']);
            if (selected) {
                const id = selected.miniId || selected.mapId;
                const buttons = ((selected.miniId) ? this.props.selectMiniOptions : this.props.selectMapOptions);
                this.state.selected && this.state.selected.finish && this.state.selected.finish();
                this.setState({menuSelected: {buttons, selected, id}, selected: null});
            } else {
                this.state.selected && this.state.selected.finish && this.state.selected.finish();
                this.setState({selected: null});
            }
        }
    }

    onPan(delta, position, startPos) {
        if (this.props.fogOfWarMode && !this.state.usingDragHandle) {
            this.dragFogOfWarRect(position, startPos);
        } else if (!this.state.selected) {
            this.setState(panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
        } else if (this.state.selected.miniId && !this.state.selected.scale) {
            this.panMini(position, this.state.selected.miniId);
        } else if (this.state.selected.mapId) {
            this.panMap(position, this.state.selected.mapId);
        }
    }

    onZoom(delta) {
        if (!this.state.selected) {
            this.setState(zoomCamera(delta, this.state.camera, 2, 95));
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
        } else if (this.state.selected.miniId) {
            if (this.state.selected.scale) {
                this.scaleMini(delta, this.state.selected.miniId);
            } else {
                this.elevateMini(delta, this.state.selected.miniId);
            }
        } else if (this.state.selected.mapId) {
            this.elevateMap(delta, this.state.selected.mapId);
        }
    }

    onRotate(delta) {
        if (!this.state.selected) {
            this.setState(rotateCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
        } else if (this.state.selected.miniId && !this.state.selected.scale) {
            this.rotateMini(delta, this.state.selected.miniId);
        } else if (this.state.selected.mapId) {
            this.rotateMap(delta, this.state.selected.mapId);
        }
    }

    snapMap(mapId) {
        const {metadata, position: positionObj, rotation: rotationObj, snapping} = this.props.scenario.maps[mapId];
        const dx = (1 + Number(metadata.appProperties.gridOffsetX) / Number(metadata.appProperties.gridSize)) % 1;
        const dy = (1 + Number(metadata.appProperties.gridOffsetY) / Number(metadata.appProperties.gridSize)) % 1;
        const width = Number(metadata.appProperties.width);
        const height = Number(metadata.appProperties.height);
        if (this.props.snapToGrid && snapping) {
            const rotationSnap = Math.PI/2;
            const mapRotation = Math.round(rotationObj._y/rotationSnap) * rotationSnap;
            const mapDX = (width / 2) % 1 - dx;
            const mapDZ = (height / 2) % 1 - dy;
            const cos = Math.cos(mapRotation);
            const sin = Math.sin(mapRotation);
            const x = Math.round(positionObj.x) + cos * mapDX + sin * mapDZ;
            const y = Math.round(positionObj.y);
            const z = Math.round(positionObj.z) + cos * mapDZ - sin * mapDX;
            return {
                positionObj: {x, y, z},
                rotationObj: {...rotationObj, _y: mapRotation},
                dx, dy, width, height
            };
        } else {
            return {positionObj, rotationObj, dx, dy, width, height};
        }
    }

    renderMaps() {
        return Object.keys(this.props.scenario.maps).map((mapId) => {
            const {metadata, gmOnly} = this.props.scenario.maps[mapId];
            if (!metadata || (gmOnly && this.props.playerView)) {
                return null;
            }
            return (
                <TabletopMapComponent
                    key={mapId}
                    mapId={mapId}
                    snapMap={this.snapMap}
                    texture={this.props.texture[metadata.id]}
                    gridColour={metadata.appProperties.gridColour}
                    fogBitmap={this.props.scenario.maps[mapId].fogOfWar}
                    fogWidth={this.state.fogWidth[mapId]}
                    fogHeight={this.state.fogHeight[mapId]}
                    transparentFog={this.props.transparentFog}
                    selected={!!(this.state.selected && this.state.selected.mapId === mapId)}
                    gmOnly={gmOnly}
                />
            );
        });
    }

    snapMini(miniId) {
        const {position: positionObj, rotation: rotationObj, scale: scaleFactor, elevation, snapping} = this.props.scenario.minis[miniId];
        if (this.props.snapToGrid && snapping) {
            const rotationSnap = Math.PI/4;
            const scale = scaleFactor > 1 ? Math.round(scaleFactor) : 1.0 / (Math.round(1.0 / scaleFactor));
            const gridSnap = scale > 1 ? 1 : scale;
            const x = Math.floor(positionObj.x / gridSnap) * gridSnap + scale / 2 % 1;
            const y = Math.round(positionObj.y);
            const z = Math.floor(positionObj.z / gridSnap) * gridSnap + scale / 2 % 1;
            return {
                positionObj: {x, y, z},
                rotationObj: {...rotationObj, _y: Math.round(rotationObj._y/rotationSnap) * rotationSnap},
                scaleFactor: scale,
                elevation: Math.round(elevation)
            };
        } else {
            return {positionObj, rotationObj, scaleFactor, elevation};
        }
    }

    renderMinis() {
        return Object.keys(this.props.scenario.minis).map((miniId) => {
            const {metadata, gmOnly} = this.props.scenario.minis[miniId];
            if (!metadata || (gmOnly && this.props.playerView)) {
                return null;
            }
            return (
                <TabletopMiniComponent
                    key={miniId}
                    miniId={miniId}
                    snapMini={this.snapMini}
                    metadata={metadata}
                    texture={this.props.texture[metadata.id]}
                    selected={!!(this.state.selected && this.state.selected.miniId === miniId)}
                    gmOnly={gmOnly}
                />
            )
        });
    }

    roundRect(start, end) {
        if (start < end) {
            return {start: Math.floor(start), end: Math.ceil(end) - 0.01};
        } else {
            return {start: Math.ceil(start) - 0.01, end: Math.floor(end)};
        }
    }

    renderFogOfWarRect() {
        const fogOfWarRect = this.state.fogOfWarRect;
        if (fogOfWarRect) {
            const {start: startX, end: endX} = this.roundRect(fogOfWarRect.startPos.x, fogOfWarRect.endPos.x);
            const {start: startZ, end: endZ} = this.roundRect(fogOfWarRect.startPos.z, fogOfWarRect.endPos.z);
            const start = new THREE.Vector3(startX, fogOfWarRect.startPos.y, startZ);
            const end = new THREE.Vector3(endX, fogOfWarRect.endPos.y, endZ);
            const dx = endX - startX;
            const dz = endZ - startZ;
            return (
                <group>
                    <arrowHelper
                        origin={start}
                        dir={dx > 0 ? TabletopViewComponent.DIR_EAST : TabletopViewComponent.DIR_WEST}
                        length={Math.max(0.01, Math.abs(dx))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={start}
                        dir={dz > 0 ? TabletopViewComponent.DIR_NORTH : TabletopViewComponent.DIR_SOUTH}
                        length={Math.max(0.01, Math.abs(dz))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={end}
                        dir={dx > 0 ? TabletopViewComponent.DIR_WEST : TabletopViewComponent.DIR_EAST}
                        length={Math.max(0.01, Math.abs(dx))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={end}
                        dir={dz > 0 ? TabletopViewComponent.DIR_SOUTH : TabletopViewComponent.DIR_NORTH}
                        length={Math.max(0.01, Math.abs(dz))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                </group>
            );
        } else {
            return null;
        }
    }

    renderMenuSelected() {
        const {buttons: buttonOptions, selected, id} = this.state.menuSelected;
        const data = (selected.miniId) ? this.props.scenario.minis : (selected.mapId) ? this.props.scenario.maps : [
            {name: 'Use this handle to drag the map while in Fog of War mode.'}
        ];
        if (!data[id]) {
            // Selected map or mini has been removed
            return null;
        }
        const buttons = buttonOptions.filter(({show}) => (!show || show(id)));
        return (buttons.length === 0) ? null : (
            <div className='menu' style={{left: selected.position.x + 10, top: selected.position.y + 10}}>
                <div>{data[id].name}</div>
                {
                    buttons.map(({label, title, onClick}) => (
                        <button key={label} title={title} onClick={() => {
                            const result = onClick(id, selected.point, selected.position);
                            if (result && typeof(result) === 'object') {
                                this.setState(result);
                            }
                        }}>
                            {label}
                        </button>
                    ))
                }
            </div>
        );
    }

    changeFogOfWarBitmask(reveal, fogOfWarRect = this.state.fogOfWarRect) {
        const map = this.props.scenario.maps[fogOfWarRect.mapId];
        const mapWidth = Number(map.metadata.appProperties.width);
        const mapHeight = Number(map.metadata.appProperties.height);
        const gridSize = Number(map.metadata.appProperties.gridSize);
        const gridOffsetX = (1 + Number(map.metadata.appProperties.gridOffsetX) / gridSize) % 1;
        const gridOffsetY = (1 + Number(map.metadata.appProperties.gridOffsetY) / gridSize) % 1;
        const fogWidth = this.state.fogWidth[fogOfWarRect.mapId];
        const fogHeight = this.state.fogHeight[fogOfWarRect.mapId];
        // translate to grid coordinates.
        this.offset.copy(fogOfWarRect.startPos).sub(map.position);
        const startX = clamp(Math.floor(1 - gridOffsetX + mapWidth / 2 + this.offset.x), 0, fogWidth);
        const startY = clamp(Math.floor(1 - gridOffsetY + mapHeight / 2 + this.offset.z), 0, fogHeight);
        this.offset.copy(fogOfWarRect.endPos).sub(map.position);
        const endX = clamp(Math.floor(1 - gridOffsetX + mapWidth / 2 + this.offset.x), 0, fogWidth);
        const endY = clamp(Math.floor(1 - gridOffsetY + mapHeight / 2 + this.offset.z), 0, fogHeight);
        // Now iterate over FoW bitmap and set or clear bits.
        let fogOfWar = map.fogOfWar ? [...map.fogOfWar] : new Array(Math.ceil(fogWidth * fogHeight / 32.0)).fill(-1);
        const dx = (startX > endX) ? -1 : 1;
        const dy = (startY > endY) ? -1 : 1;
        for (let y = startY; y !== endY + dy; y += dy) {
            for (let x = startX; x !== endX + dx; x += dx) {
                const textureIndex = x + y * fogWidth;
                const bitmaskIndex = textureIndex >> 5;
                const mask = 1 << (textureIndex & 0x1f);
                if (reveal === null) {
                    fogOfWar[bitmaskIndex] ^= mask;
                } else if (reveal) {
                    fogOfWar[bitmaskIndex] |= mask;
                } else {
                    fogOfWar[bitmaskIndex] &= ~mask;
                }
            }
        }
        this.props.dispatch(updateMapFogOfWarAction(fogOfWarRect.mapId, fogOfWar));
        this.setState({fogOfWarRect: null});
    }

    renderFogOfWarButtons() {
        return (
            <div className='menu' style={{left: this.state.fogOfWarRect.position.x, top: this.state.fogOfWarRect.position.y}}>
                <button onClick={() => {this.changeFogOfWarBitmask(false)}}>Cover</button>
                <button onClick={() => {this.changeFogOfWarBitmask(true)}}>Uncover</button>
                <button onClick={() => {this.setState({fogOfWarRect: null})}}>Cancel</button>
            </div>
        );
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
                    onGestureEnd={this.onGestureEnd}
                    onTap={this.onTap}
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onRotate={this.onRotate}
                >
                    <React3 mainCamera='camera' width={this.props.size.width} height={this.props.size.height}
                            clearColor={0x808080} antialias={true} forceManualRender onManualRenderTriggerCreated={(trigger) => {
                        trigger()
                    }}>
                        <TabletopMiniComponent/>
                        <scene ref={this.setScene}>
                            <perspectiveCamera {...cameraProps} ref={this.setCamera}/>
                            <ambientLight/>
                            {this.renderMaps()}
                            {this.renderMinis()}
                            {this.renderFogOfWarRect()}
                        </scene>
                    </React3>
                    {
                        !this.props.fogOfWarMode ? null : (
                            <div
                                className='fogOfWarDragHandle'
                                onMouseDown={() => {this.setState({usingDragHandle: true})}}
                                onTouchStart={() => {this.setState({usingDragHandle: true})}}
                            >
                                <div className='material-icons'>pan_tool</div>
                            </div>
                        )
                    }
                </GestureControls>
                {this.state.menuSelected ? this.renderMenuSelected() : null}
                {this.state.fogOfWarRect && this.state.fogOfWarRect.showButtons ? this.renderFogOfWarButtons() : null}
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

export default sizeMe({monitorHeight: true})(connect(mapStoreToProps)(TabletopViewComponent));