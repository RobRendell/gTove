import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import sizeMe, {ReactSizeMeProps} from 'react-sizeme';
import {connect} from 'react-redux';
import {clamp} from 'lodash';
import {Dispatch} from 'redux';
import Timer = NodeJS.Timer;

import GestureControls, {ObjectVector2} from '../container/gestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {
    removeMapAction, removeMiniAction,
    updateMapFogOfWarAction, updateMapGMOnlyAction,
    updateMapPositionAction,
    updateMapRotationAction,
    updateMiniElevationAction,
    updateMiniGMOnlyAction,
    updateMiniPositionAction,
    updateMiniRotationAction,
    updateMiniScaleAction
} from '../redux/scenarioReducer';
import {cacheTextureAction, TextureReducerType} from '../redux/textureReducer';
import {getAllTexturesFromStore, getScenarioFromStore, ReduxStoreType} from '../redux/mainReducer';
import TabletopMapComponent from './tabletopMapComponent';
import TabletopMiniComponent from './tabletopMiniComponent';
import TabletopResourcesComponent from './tabletopResourcesComponent';
import {buildEuler} from '../util/threeUtils';
import * as constants from '../util/constants';
import {ObjectVector3, ScenarioType} from '../@types/scenario';
import {ComponentTypeWithDefaultProps} from '../util/types';

import './tabletopViewComponent.css';
import {toast} from 'react-toastify';

interface TabletopViewComponentMenuOption {
    label: string;
    title: string;
    onClick: (miniId?: string, point?: THREE.Vector3, position?: THREE.Vector2) => void;
    show: (id: string) => boolean;
}

interface TabletopViewComponentSelected {
    mapId?: string;
    miniId?: string;
    point?: THREE.Vector3;
    scale?: boolean;
    position?: THREE.Vector2;
    finish?: () => void;
}

interface TabletopViewComponentMenuSelected {
    buttons: TabletopViewComponentMenuOption[];
    selected: TabletopViewComponentSelected;
    id: string;
}

interface TabletopViewComponentProps extends ReactSizeMeProps {
    dispatch: Dispatch<ReduxStoreType>;
    scenario: ScenarioType;
    texture: TextureReducerType;
    transparentFog: boolean;
    fogOfWarMode: boolean;
    endFogOfWarMode: () => void;
    snapToGrid: boolean;
    userIsGM: boolean;
    readOnly: boolean;
    playerView: boolean;
}

interface TabletopViewComponentState {
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    scene?: THREE.Scene;
    camera?: THREE.Camera;
    selected?: TabletopViewComponentSelected,
    dragOffset?: ObjectVector3;
    defaultDragY?: number;
    menuSelected?: TabletopViewComponentMenuSelected;
    fogOfWarDragHandle: boolean;
    fogOfWarRect?: {
        mapId: string;
        startPos: THREE.Vector3;
        endPos?: THREE.Vector3;
        colour?: string;
        position: THREE.Vector2;
        showButtons?: boolean;
    };
    autoPanInterval?: Timer;
}

type rayCastField = 'mapId' | 'miniId';

class TabletopViewComponent extends React.Component<TabletopViewComponentProps, TabletopViewComponentState> {

    static propTypes = {
        transparentFog: PropTypes.bool.isRequired,
        fogOfWarMode: PropTypes.bool.isRequired,
        endFogOfWarMode: PropTypes.func.isRequired,
        snapToGrid: PropTypes.bool.isRequired,
        userIsGM: PropTypes.bool.isRequired,
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

    private rayCaster: THREE.Raycaster;
    private rayPoint: THREE.Vector2;
    private offset: THREE.Vector3;
    private plane: THREE.Plane;

    private selectMapOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Reveal',
            title: 'Reveal this map to players',
            onClick: (mapId: string) => {this.props.dispatch(updateMapGMOnlyAction(mapId, false))},
            show: (mapId: string) => (this.props.userIsGM && this.props.scenario.maps[mapId].gmOnly)
        },
        {
            label: 'Hide',
            title: 'Hide this map from players',
            onClick: (mapId: string) => {this.props.dispatch(updateMapGMOnlyAction(mapId, true))},
            show: (mapId: string) => (this.props.userIsGM && !this.props.scenario.maps[mapId].gmOnly)
        },
        {
            label: 'Remove',
            title: 'Remove this map from the tabletop',
            onClick: (mapId: string) => {this.props.dispatch(removeMapAction(mapId))},
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Reposition',
            title: 'Pan, zoom (elevate) and rotate this map on the tabletop.',
            onClick: (mapId: string, point: THREE.Vector3) => {
                const toastId = toast('Tap or select something else to end.', {position: toast.POSITION.BOTTOM_CENTER});
                this.setState({selected: {mapId, point, finish: () => toast.dismiss(toastId)}, menuSelected: undefined});
            },
            show: () => (this.props.userIsGM)
        }
    ];

    private selectMiniOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Reveal',
            title: 'Reveal this mini to players',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniGMOnlyAction(miniId, false))},
            show: (miniId: string) => (this.props.userIsGM && this.props.scenario.minis[miniId].gmOnly)
        },
        {
            label: 'Hide',
            title: 'Hide this mini from players',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniGMOnlyAction(miniId, true))},
            show: (miniId: string) => (this.props.userIsGM && !this.props.scenario.minis[miniId].gmOnly)
        },
        {
            label: 'Remove',
            title: 'Remove this mini from the tabletop',
            onClick: (miniId: string) => {this.props.dispatch(removeMiniAction(miniId))},
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Scale',
            title: 'Adjust this mini\'s scale',
            onClick: (miniId: string, point: THREE.Vector3) => {
                this.setState({selected: {miniId: miniId, point, scale: true}, menuSelected: undefined});
            },
            show: () => (this.props.userIsGM)
        }
    ];

    private fogOfWarOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Cover All',
            title: 'Cover all maps with Fog of War.',
            onClick: () => {
                Object.keys(this.props.scenario.maps).forEach((mapId) => {
                    this.props.dispatch(updateMapFogOfWarAction(mapId, []));
                });
                this.setState({menuSelected: undefined});
            },
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Uncover All',
            title: 'Remove Fog of War from all maps.',
            onClick: () => {
                Object.keys(this.props.scenario.maps).forEach((mapId) => {
                    this.props.dispatch(updateMapFogOfWarAction(mapId));
                });
                this.setState({menuSelected: undefined});
            },
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Finish',
            title: 'Exit Fog of War Mode',
            onClick: () => {
                this.props.endFogOfWarMode();
                this.setState({menuSelected: undefined, fogOfWarRect: undefined});
            },
            show: () => (this.props.userIsGM)
        }
    ];

    constructor(props: TabletopViewComponentProps) {
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
            fogOfWarDragHandle: false,
            scene: undefined,
            camera: undefined,
            selected: undefined,
            dragOffset: undefined,
            defaultDragY: undefined,
            menuSelected: undefined,
            fogOfWarRect: undefined,
            autoPanInterval: undefined
        };
    }

    componentWillMount() {
        this.updateStateFromProps(this.props);
    }

    componentWillReceiveProps(props: TabletopViewComponentProps) {
        this.updateStateFromProps(props);
    }

    updateStateFromProps(props: TabletopViewComponentProps) {
        [props.scenario.maps, props.scenario.minis].forEach((models) => {
            Object.keys(models).forEach((id) => {
                const metadata = models[id].metadata;
                if (metadata && props.texture[metadata.id] === undefined) {
                    this.context.textureLoader.loadTexture(metadata, (texture: THREE.Texture) => {
                        this.props.dispatch(cacheTextureAction(metadata.id, texture));
                    });
                }
            });
        });
    }

    setScene(scene: THREE.Scene) {
        this.setState({scene});
    }

    setCamera(camera: THREE.Camera) {
        this.setState({camera});
    }

    rayCastFromScreen(position: THREE.Vector2): THREE.Intersection[] {
        if (this.state.scene && this.state.camera) {
            this.rayPoint.x = 2 * position.x / this.props.size.width - 1;
            this.rayPoint.y = 1 - 2 * position.y / this.props.size.height;
            this.rayCaster.setFromCamera(this.rayPoint, this.state.camera);
            return this.rayCaster.intersectObjects(this.state.scene.children, true);
        } else {
            return [];
        }
    }

    findAncestorWithUserDataFields(object: any, fields: rayCastField[]): [any, rayCastField] | null {
        while (object) {
            let matchingField = object.userDataA && fields.reduce((result, field) =>
                (result || (object.userDataA[field] && field)), null);
            if (matchingField) {
                return [object, matchingField];
            } else {
                object = object.parent;
            }
        }
        return null;
    }

    rayCastForFirstUserDataFields(position: THREE.Vector2, fields: rayCastField | rayCastField[], intersects = this.rayCastFromScreen(position)) {
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        return intersects.reduce((selected, intersect) => {
            if (!selected) {
                const ancestor = this.findAncestorWithUserDataFields(intersect.object, fieldsArray);
                if (ancestor) {
                    const [object, field] = ancestor;
                    return {[field]: object.userDataA[field], point: intersect.point, position};
                }
            }
            return selected;
        }, null);
    }

    panMini(position: THREE.Vector2, id: string) {
        const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
        // If the ray intersects with a map, drag over the map - otherwise drag over starting plane.
        const dragY = (selected && selected.mapId) ? (this.props.scenario.maps[selected.mapId].position.y - this.state.dragOffset!.y) : this.state.defaultDragY!;
        this.plane.setComponents(0, -1, 0, dragY);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            this.props.dispatch(updateMiniPositionAction(id, this.offset));
        }
    }

    panMap(position: THREE.Vector2, id: string) {
        const dragY = this.props.scenario.maps[id].position.y;
        this.plane.setComponents(0, -1, 0, dragY);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            this.props.dispatch(updateMapPositionAction(id, this.offset));
        }
    }

    rotateMini(delta: ObjectVector2, id: string) {
        let rotation = buildEuler(this.props.scenario.minis[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * delta.x / this.props.size.width;
        this.props.dispatch(updateMiniRotationAction(id, rotation));
    }

    rotateMap(delta: ObjectVector2, id: string) {
        let rotation = buildEuler(this.props.scenario.maps[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * delta.x / this.props.size.width;
        this.props.dispatch(updateMapRotationAction(id, rotation));
    }

    elevateMini(delta: ObjectVector2, id: string) {
        const {elevation} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniElevationAction(id, elevation - delta.y / 20));
    }

    scaleMini(delta: ObjectVector2, id: string) {
        const {scale} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniScaleAction(id, Math.max(0.25, scale - delta.y / 20)));
    }

    elevateMap(delta: ObjectVector2, mapId: string) {
        this.offset.copy(this.props.scenario.maps[mapId].position as THREE.Vector3).add({x: 0, y: -delta.y / 20, z: 0} as THREE.Vector3);
        this.props.dispatch(updateMapPositionAction(mapId, this.offset));
    }

    autoPanForFogOfWarRect() {
        if (!this.state.fogOfWarRect && this.state.autoPanInterval) {
            clearInterval(this.state.autoPanInterval);
            this.setState({autoPanInterval: undefined});
        } else {
            let delta = {x: 0, y: 0};
            const dragBorder = Math.min(TabletopViewComponent.FOG_RECT_DRAG_BORDER, this.props.size.width / 10, this.props.size.height / 10);
            const {position} = this.state.fogOfWarRect!;
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
            if (this.state.camera && (delta.x || delta.y)) {
                this.setState(panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
            }
        }
    }

    dragFogOfWarRect(position: THREE.Vector2, startPos: THREE.Vector2) {
        let fogOfWarRect = this.state.fogOfWarRect;
        if (!fogOfWarRect) {
            const selected = this.rayCastForFirstUserDataFields(startPos, 'mapId');
            if (selected) {
                const dragY = this.props.scenario.maps[selected.mapId].position.y;
                const map = this.props.scenario.maps[selected.mapId];
                this.plane.setComponents(0, -1, 0, dragY + TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST);
                if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
                    const intersection = this.offset.clone();
                    fogOfWarRect = {mapId: selected.mapId, startPos: intersection, colour: map.metadata.appProperties.gridColour || 'black', position};
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
            const intersection = this.offset.clone();
            this.setState({fogOfWarRect: {...fogOfWarRect, endPos: intersection, position, showButtons: false}});
        }
    }

    onGestureStart(gesturePosition: THREE.Vector2) {
        this.setState({menuSelected: undefined});
        const selected = this.rayCastForFirstUserDataFields(gesturePosition, ['miniId', 'mapId']);
        if (this.state.selected && selected && this.state.selected.mapId === selected.mapId
            && this.state.selected.miniId === selected.miniId) {
            // reset dragOffset to the new offset
            const position = (this.state.selected.mapId ? this.props.scenario.maps[this.state.selected.mapId].position :
                this.props.scenario.minis[this.state.selected.miniId!].position) as THREE.Vector3;
            this.offset.copy(selected.point).sub(position);
            const dragOffset = {x: -this.offset.x, y: 0, z: -this.offset.z};
            this.setState({dragOffset});
        } else if (selected && selected.miniId && !this.props.fogOfWarMode) {
            const position = this.props.scenario.minis[selected.miniId].position as THREE.Vector3;
            this.offset.copy(position).sub(selected.point);
            const dragOffset = {...this.offset};
            this.state.selected && this.state.selected.finish && this.state.selected.finish();
            this.setState({selected, dragOffset, defaultDragY: selected.point.y});
        } else {
            this.state.selected && this.state.selected.finish && this.state.selected.finish();
            this.setState({selected: undefined});
        }
    }

    onGestureEnd() {
        if (this.props.snapToGrid && this.state.selected) {
            if (this.state.selected.mapId) {
                const {positionObj, rotationObj} = this.snapMap(this.state.selected.mapId);
                this.props.dispatch(updateMapPositionAction(this.state.selected.mapId, positionObj, false));
                this.props.dispatch(updateMapRotationAction(this.state.selected.mapId, rotationObj, false));
            } else if (this.state.selected.miniId) {
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
        } : undefined;
        const selected = (this.state.selected && this.state.selected.mapId) ? this.state.selected : undefined;
        !selected && this.state.selected && this.state.selected.finish && this.state.selected.finish();
        this.setState({selected, fogOfWarDragHandle: false, fogOfWarRect});
    }

    onTap(position: THREE.Vector2) {
        if (this.state.fogOfWarDragHandle) {
            // show menu
            this.setState({
                menuSelected: {
                    buttons: this.fogOfWarOptions,
                    selected: {position},
                    id: '0'
                }
            });
        } else if (this.props.fogOfWarMode) {
            const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
            if (selected) {
                this.changeFogOfWarBitmask(null, {mapId: selected.mapId, startPos: selected.point, endPos: selected.point, position});
            }
        } else {
            const selected = this.rayCastForFirstUserDataFields(position, ['mapId', 'miniId']);
            if (selected) {
                const id = selected.miniId || selected.mapId;
                const buttons = ((selected.miniId) ? this.selectMiniOptions : this.selectMapOptions);
                this.state.selected && this.state.selected.finish && this.state.selected.finish();
                this.setState({menuSelected: {buttons, selected, id}, selected: undefined});
            } else {
                this.state.selected && this.state.selected.finish && this.state.selected.finish();
                this.setState({selected: undefined});
            }
        }
    }

    onPan(delta: ObjectVector2, position: THREE.Vector2, startPos: THREE.Vector2) {
        if (this.props.fogOfWarMode && !this.state.fogOfWarDragHandle) {
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

    onZoom(delta: ObjectVector2) {
        if (!this.state.selected) {
            this.state.camera && this.setState(zoomCamera(delta, this.state.camera, 2, 95));
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

    onRotate(delta: ObjectVector2) {
        if (!this.state.selected) {
            this.state.camera && this.setState(rotateCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
        } else if (this.state.selected.miniId && !this.state.selected.scale) {
            this.rotateMini(delta, this.state.selected.miniId);
        } else if (this.state.selected.mapId) {
            this.rotateMap(delta, this.state.selected.mapId);
        }
    }

    snapMap(mapId: string) {
        const {metadata, position: positionObj, rotation: rotationObj, snapping} = this.props.scenario.maps[mapId];
        const dx = (1 + Number(metadata.appProperties.gridOffsetX) / Number(metadata.appProperties.gridSize)) % 1;
        const dy = (1 + Number(metadata.appProperties.gridOffsetY) / Number(metadata.appProperties.gridSize)) % 1;
        const width = Number(metadata.appProperties.width);
        const height = Number(metadata.appProperties.height);
        if (this.props.snapToGrid && snapping) {
            const rotationSnap = Math.PI/2;
            const mapRotation = Math.round(rotationObj.y/rotationSnap) * rotationSnap;
            const mapDX = (width / 2) % 1 - dx;
            const mapDZ = (height / 2) % 1 - dy;
            const cos = Math.cos(mapRotation);
            const sin = Math.sin(mapRotation);
            const x = Math.round(positionObj.x) + cos * mapDX + sin * mapDZ;
            const y = Math.round(positionObj.y);
            const z = Math.round(positionObj.z) + cos * mapDZ - sin * mapDX;
            return {
                positionObj: {x, y, z},
                rotationObj: {...rotationObj, y: mapRotation},
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
                    gridColour={metadata.appProperties.fogWidth ? metadata.appProperties.gridColour : constants.GRID_NONE}
                    fogBitmap={this.props.scenario.maps[mapId].fogOfWar}
                    fogWidth={Number(metadata.appProperties.fogWidth)}
                    fogHeight={Number(metadata.appProperties.fogHeight)}
                    transparentFog={this.props.transparentFog}
                    selected={!!(this.state.selected && this.state.selected.mapId === mapId)}
                    gmOnly={gmOnly}
                />
            );
        });
    }

    snapMini(miniId: string) {
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
                rotationObj: {...rotationObj, y: Math.round(rotationObj.y/rotationSnap) * rotationSnap},
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

    roundRect(start: number, end: number) {
        if (start < end) {
            return {start: Math.floor(start), end: Math.ceil(end) - 0.01};
        } else {
            return {start: Math.ceil(start) - 0.01, end: Math.floor(end)};
        }
    }

    renderFogOfWarRect() {
        const fogOfWarRect = this.state.fogOfWarRect;
        if (fogOfWarRect) {
            const {start: startX, end: endX} = this.roundRect(fogOfWarRect.startPos.x, fogOfWarRect.endPos!.x);
            const {start: startZ, end: endZ} = this.roundRect(fogOfWarRect.startPos.z, fogOfWarRect.endPos!.z);
            const start = new THREE.Vector3(startX, fogOfWarRect.startPos.y, startZ);
            const end = new THREE.Vector3(endX, fogOfWarRect.endPos!.y, endZ);
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
        if (!this.state.menuSelected) {
            return null;
        }
        const {buttons: buttonOptions, selected, id} = this.state.menuSelected;
        const data = (selected.miniId) ? this.props.scenario.minis : (selected.mapId) ? this.props.scenario.maps :
            [{name: 'Use this handle to pan the camera while in Fog of War mode.'}];
        if (!data[id]) {
            // Selected map or mini has been removed
            return null;
        }
        const buttons = buttonOptions.filter(({show}) => (!show || show(id)));
        return (buttons.length === 0) ? null : (
            <div className='menu' style={{left: selected.position!.x + 10, top: selected.position!.y + 10}}>
                <div>{data[id].name}</div>
                {
                    buttons.map(({label, title, onClick}) => (
                        <button key={label} title={title} onClick={() => {
                            onClick(id, selected.point!, selected.position!);
                        }}>
                            {label}
                        </button>
                    ))
                }
            </div>
        );
    }

    changeFogOfWarBitmask(reveal: boolean | null, fogOfWarRect = this.state.fogOfWarRect) {
        if (!fogOfWarRect || !fogOfWarRect.mapId || !fogOfWarRect.startPos || !fogOfWarRect.endPos) {
            return;
        }
        const map = this.props.scenario.maps[fogOfWarRect.mapId];
        const mapWidth = Number(map.metadata.appProperties.width);
        const mapHeight = Number(map.metadata.appProperties.height);
        const gridSize = Number(map.metadata.appProperties.gridSize);
        const gridOffsetX = (1 + Number(map.metadata.appProperties.gridOffsetX) / gridSize) % 1;
        const gridOffsetY = (1 + Number(map.metadata.appProperties.gridOffsetY) / gridSize) % 1;
        const fogWidth = Number(map.metadata.appProperties.fogWidth);
        const fogHeight = Number(map.metadata.appProperties.fogHeight);
        // translate to grid coordinates.
        this.offset.copy(fogOfWarRect.startPos).sub(map.position as THREE.Vector3);
        const startX = clamp(Math.floor(1 - gridOffsetX + mapWidth / 2 + this.offset.x), 0, fogWidth);
        const startY = clamp(Math.floor(1 - gridOffsetY + mapHeight / 2 + this.offset.z), 0, fogHeight);
        this.offset.copy(fogOfWarRect.endPos).sub(map.position as THREE.Vector3);
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
        this.setState({fogOfWarRect: undefined});
    }

    renderFogOfWarButtons() {
        return (!this.state.fogOfWarRect || !this.state.fogOfWarRect.showButtons) ? null : (
            <div className='menu' style={{left: this.state.fogOfWarRect.position.x, top: this.state.fogOfWarRect.position.y}}>
                <button onClick={() => {this.changeFogOfWarBitmask(false)}}>Cover</button>
                <button onClick={() => {this.changeFogOfWarBitmask(true)}}>Uncover</button>
                <button onClick={() => {this.setState({fogOfWarRect: undefined})}}>Cancel</button>
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
                            clearColor={0x808080} antialias={true} forceManualRender={true}
                            onManualRenderTriggerCreated={(trigger: () => void) => {trigger()}}
                    >
                        <TabletopResourcesComponent/>
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
                                onMouseDown={() => {this.setState({fogOfWarDragHandle: true})}}
                                onTouchStart={() => {this.setState({fogOfWarDragHandle: true})}}
                            >
                                <div className='material-icons'>pan_tool</div>
                            </div>
                        )
                    }
                </GestureControls>
                {this.renderMenuSelected()}
                {this.renderFogOfWarButtons()}
            </div>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        scenario: getScenarioFromStore(store),
        texture: getAllTexturesFromStore(store)
    }
}

export default sizeMe({monitorHeight: true})(connect(mapStoreToProps)(TabletopViewComponent as ComponentTypeWithDefaultProps<typeof TabletopViewComponent>));