import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import sizeMe, {ReactSizeMeProps} from 'react-sizeme';
import {clamp} from 'lodash';
import {AnyAction, Dispatch} from 'redux';
import {toast} from 'react-toastify';
import Timer = NodeJS.Timer;

import GestureControls, {ObjectVector2} from '../container/gestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {
    addMiniAction, addMiniWaypointAction, cancelMiniMoveAction, confirmMiniMoveAction, removeMapAction,
    removeMiniAction, removeMiniWaypointAction, updateMapFogOfWarAction, updateMapGMOnlyAction,
    updateMapMetadataLocalAction, updateMapPositionAction, updateMapRotationAction, updateMiniElevationAction,
    updateMiniFlatAction, updateMiniGMOnlyAction, updateMiniMetadataLocalAction, updateMiniNameAction,
    updateMiniPositionAction, updateMiniProneAction, updateMiniRotationAction, updateMiniScaleAction
} from '../redux/scenarioReducer';
import {ReduxStoreType} from '../redux/mainReducer';
import TabletopMapComponent from './tabletopMapComponent';
import TabletopMiniComponent from './tabletopMiniComponent';
import TabletopResourcesComponent from './tabletopResourcesComponent';
import {buildEuler} from '../util/threeUtils';
import {
    DistanceMode, DistanceRound, MapType, MiniType, ObjectVector3, ScenarioType, TabletopType, WithMetadataType
} from '../util/scenarioUtils';
import {ComponentTypeWithDefaultProps} from '../util/types';
import {VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import {
    DriveMetadata, isMiniMetadata, isTemplateMetadata, TabletopObjectAppProperties
} from '../util/googleDriveUtils';
import {FileAPI} from '../util/fileUtils';
import StayInsideContainer from '../container/stayInsideContainer';
import {TextureLoaderContext} from '../util/driveTextureLoader';
import * as constants from '../util/constants';
import InputField from './inputField';
import {PromiseModalContext} from '../container/authenticatedContainer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {addFilesAction, setFetchingFileAction, setFileErrorAction} from '../redux/fileIndexReducer';
import TabletopTemplateComponent from './tabletopTemplateComponent';

import './tabletopViewComponent.css';

interface TabletopViewComponentMenuOption {
    label: string;
    title: string;
    onClick: (miniId?: string, point?: THREE.Vector3, position?: THREE.Vector2) => void;
    show?: (id?: string) => boolean;
}

interface TabletopViewComponentSelected {
    mapId?: string;
    miniId?: string;
    point?: THREE.Vector3;
    scale?: boolean;
    position?: THREE.Vector2;
    finish?: () => void;
    object?: THREE.Object3D;
}

interface TabletopViewComponentMenuSelected {
    buttons: TabletopViewComponentMenuOption[];
    selected: TabletopViewComponentSelected;
    id?: string;
    label?: string;
}

interface TabletopViewComponentEditSelected {
    selected: TabletopViewComponentSelected;
    value: string;
    finish: (value: string) => void;
}

interface TabletopViewComponentProps extends ReactSizeMeProps {
    fullDriveMetadata: {[key: string]: DriveMetadata};
    dispatch: Dispatch<ReduxStoreType>;
    fileAPI?: FileAPI;
    scenario: ScenarioType;
    tabletop: TabletopType;
    setCamera: (parameters: Partial<VirtualGamingTabletopCameraState>) => void;
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    transparentFog: boolean;
    fogOfWarMode: boolean;
    endFogOfWarMode: () => void;
    snapToGrid: boolean;
    userIsGM: boolean;
    setFocusMapId: (mapId: string) => void;
    findPositionForNewMini: (scale: number, basePosition?: THREE.Vector3 | ObjectVector3) => ObjectVector3;
    findUnusedMiniName: (baseName: string, suffix?: number) => [string, number]
    focusMapId?: string;
    readOnly: boolean;
    playerView: boolean;
    labelSize: number;
    myPeerId: MyPeerIdReducerType;
    disableTapMenu?: boolean;
}

interface TabletopViewComponentState {
    texture: {[key: string]: THREE.Texture | null};
    scene?: THREE.Scene;
    camera?: THREE.Camera;
    selected?: TabletopViewComponentSelected,
    dragOffset?: ObjectVector3;
    defaultDragY?: number;
    menuSelected?: TabletopViewComponentMenuSelected;
    editSelected?: TabletopViewComponentEditSelected;
    repositionMapDragHandle: boolean;
    fogOfWarDragHandle: boolean;
    fogOfWarRect?: {
        mapId: string;
        startPos: THREE.Vector3;
        endPos: THREE.Vector3;
        colour: string;
        position: THREE.Vector2;
        showButtons: boolean;
    };
    autoPanInterval?: Timer;
    noGridToastId?: number;
}

type RayCastField = 'mapId' | 'miniId';

class TabletopViewComponent extends React.Component<TabletopViewComponentProps, TabletopViewComponentState> {

    static propTypes = {
        fullDriveMetadata: PropTypes.object.isRequired,
        dispatch: PropTypes.func.isRequired,
        fileAPI: PropTypes.object,
        scenario: PropTypes.object.isRequired,
        tabletop: PropTypes.object.isRequired,
        transparentFog: PropTypes.bool.isRequired,
        fogOfWarMode: PropTypes.bool.isRequired,
        endFogOfWarMode: PropTypes.func.isRequired,
        snapToGrid: PropTypes.bool.isRequired,
        userIsGM: PropTypes.bool.isRequired,
        setFocusMapId: PropTypes.func.isRequired,
        findPositionForNewMini: PropTypes.func.isRequired,
        findUnusedMiniName: PropTypes.func.isRequired,
        focusMapId: PropTypes.string,
        readOnly: PropTypes.bool,
        playerView: PropTypes.bool,
        labelSize: PropTypes.number,
        disableTapMenu: PropTypes.bool
    };

    static defaultProps = {
        readOnly: false,
        playerView: false
    };

    static INTEREST_LEVEL_MAX = 10000;

    static DIR_EAST = new THREE.Vector3(1, 0, 0);
    static DIR_WEST = new THREE.Vector3(-1, 0, 0);
    static DIR_NORTH = new THREE.Vector3(0, 0, 1);
    static DIR_SOUTH = new THREE.Vector3(0, 0, -1);
    static DIR_DOWN = new THREE.Vector3(0, -1, 0);

    static MINI_ROTATION_SNAP = Math.PI / 4;
    static MAP_ROTATION_SNAP = Math.PI / 2;

    static FOG_RECT_HEIGHT_ADJUST = 0.02;
    static FOG_RECT_DRAG_BORDER = 30;

    static HIGHLIGHT_COLOUR_ME = new THREE.Color(0x0000ff);
    static HIGHLIGHT_COLOUR_OTHER = new THREE.Color(0xffff00);

    static contextTypes = {
        textureLoader: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: TextureLoaderContext & PromiseModalContext;

    private rayCaster: THREE.Raycaster;
    private rayPoint: THREE.Vector2;
    private offset: THREE.Vector3;
    private plane: THREE.Plane;

    private selectMapOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Focus on Map',
            title: 'Focus the camera on this map.',
            onClick: (mapId: string) => {this.props.setFocusMapId(mapId);}
        },
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
            label: 'Reposition',
            title: 'Pan, zoom (elevate) and rotate this map on the tabletop.',
            onClick: (mapId: string, point: THREE.Vector3) => {
                this.setState({selected: {mapId, point, finish: () => {
                    this.finaliseSelectedBy();
                    this.setState({repositionMapDragHandle: false, selected: undefined});
                }}, menuSelected: undefined});
            },
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Uncover Map',
            title: 'Uncover all Fog of War on this map.',
            onClick: (mapId: string) => {
                this.props.dispatch(updateMapFogOfWarAction(mapId));
                this.setState({menuSelected: undefined});
            },
            show: (mapId: string) => (this.props.userIsGM && this.props.scenario.maps[mapId].metadata.appProperties.gridColour !== constants.GRID_NONE)
        },
        {
            label: 'Cover Map',
            title: 'Cover this map with Fog of War.',
            onClick: (mapId: string) => {
                this.props.dispatch(updateMapFogOfWarAction(mapId, []));
                this.setState({menuSelected: undefined});
            },
            show: (mapId: string) => (this.props.userIsGM && this.props.scenario.maps[mapId].metadata.appProperties.gridColour !== constants.GRID_NONE)
        },
        {
            label: 'Remove Map',
            title: 'Remove this map from the tabletop',
            onClick: (mapId: string) => {this.props.dispatch(removeMapAction(mapId))},
            show: () => (this.props.userIsGM)
        }
    ];

    private hasMiniMoved(mini: MiniType): boolean {
        return (!mini.movementPath) ? false :
            (mini.movementPath.length > 1) ? true :
                mini.movementPath[0].x !== mini.position.x
                || mini.movementPath[0].y !== mini.position.y + mini.elevation
                || mini.movementPath[0].z !== mini.position.z
    }

    private selectMiniOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Confirm Move',
            title: 'Reset the mini\'s starting position to its current location',
            onClick: (miniId: string) => {
                this.props.dispatch(confirmMiniMoveAction(miniId));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.hasMiniMoved(this.props.scenario.minis[miniId]))
        },
        {
            label: 'Make Waypoint',
            'title': 'Make the current position a waypoint on the path',
            onClick: (miniId: string) => {
                this.props.dispatch(addMiniWaypointAction(miniId));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.hasMiniMoved(this.props.scenario.minis[miniId]))
        },
        {
            label: 'Remove Waypoint',
            'title': 'Remove the last waypoint added to the path',
            onClick: (miniId: string) => {
                this.props.dispatch(removeMiniWaypointAction(miniId));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => {
                const mini = this.props.scenario.minis[miniId];
                return mini.movementPath ? mini.movementPath.length > 1 : false
            }
        },
        {
            label: 'Cancel Move',
            title: 'Reset the mini\'s position back to where it started',
            onClick: (miniId: string) => {
                this.props.dispatch(cancelMiniMoveAction(miniId));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.hasMiniMoved(this.props.scenario.minis[miniId]))
        },
        {
            label: 'Lie Down',
            title: 'Tip this mini over so it\'s lying down.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniProneAction(miniId, true))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].prone)
        },
        {
            label: 'Stand Up',
            title: 'Stand this mini up.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniProneAction(miniId, false))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && this.props.scenario.minis[miniId].prone)
        },
        {
            label: 'Make Flat',
            title: 'Make this mini always render as a flat counter.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniFlatAction(miniId, true))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].flat)
        },
        {
            label: 'Make Standee',
            title: 'Make this mini render as a standee when not viewed from above.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniFlatAction(miniId, false))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && this.props.scenario.minis[miniId].flat)
        },
        {
            label: 'Rename',
            title: 'Change the label shown for this mini.',
            onClick: (miniId: string, point: THREE.Vector3, position: THREE.Vector2) => {
                this.setState({menuSelected: undefined, editSelected: {
                    selected: {miniId, point, position},
                    value: this.props.scenario.minis[miniId].name,
                    finish: (value: string) => {this.props.dispatch(updateMiniNameAction(miniId, value))}
                }})
            },
            show: () => (this.props.userIsGM)
        },
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
            label: 'Scale',
            title: 'Adjust this mini\'s scale',
            onClick: (miniId: string, point: THREE.Vector3) => {
                this.setState({selected: {miniId: miniId, point, scale: true}, menuSelected: undefined});
            },
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Duplicate...',
            title: 'Add duplicates of this mini to the tabletop.',
            onClick: (miniId: string) => {this.duplicateMini(miniId)},
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Remove',
            title: 'Remove this mini from the tabletop',
            onClick: (miniId: string) => {this.props.dispatch(removeMiniAction(miniId))},
            show: () => (this.props.userIsGM)
        }
    ];

    private fogOfWarOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Cover All Maps',
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
            label: 'Uncover All Maps',
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

    private repositionMapOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Finish',
            title: 'Stop repositioning the map',
            onClick: () => {
                this.setSelected(undefined);
                this.setState({menuSelected: undefined});
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
        this.rayCaster = new THREE.Raycaster();
        this.rayPoint = new THREE.Vector2();
        this.offset = new THREE.Vector3();
        this.plane = new THREE.Plane();
        this.state = {
            texture: {},
            fogOfWarDragHandle: false,
            repositionMapDragHandle: false
        };
    }

    componentWillMount() {
        this.actOnProps(this.props);
    }

    componentWillReceiveProps(props: TabletopViewComponentProps) {
        this.actOnProps(props);
    }

    selectionStillValid(data: {[key: string]: MapType | MiniType}, key?: string, props = this.props) {
        return (!key || (data[key] && (!data[key].selectedBy || data[key].selectedBy === props.myPeerId)));
    }

    actOnProps(props: TabletopViewComponentProps) {
        this.checkMetadata(props.scenario.maps, updateMapMetadataLocalAction);
        this.checkMetadata(props.scenario.minis, updateMiniMetadataLocalAction);
        if (this.state.selected) {
            // If we have something selected, ensure it's still present and someone else hasn't grabbed it.
            if (!this.selectionStillValid(props.scenario.minis, this.state.selected.miniId, props)
                    || !this.selectionStillValid(props.scenario.maps, this.state.selected.mapId, props)) {
                // Don't do this via this.setSelected, because we don't want to risk calling finish()
                this.setState({selected: undefined});
            }
        }
    }

    private checkMetadata(object: {[key: string]: WithMetadataType<TabletopObjectAppProperties>}, updateTabletopObjectAction: (id: string, metadata: DriveMetadata) => AnyAction) {
        Object.keys(object).forEach((id) => {
            const metadata = object[id].metadata;
            if (metadata && !metadata.appProperties) {
                const driveMetadata = this.props.fullDriveMetadata[metadata.id];
                if (!driveMetadata) {
                    // Avoid requesting the same metadata multiple times
                    this.props.dispatch(setFetchingFileAction(metadata.id));
                    this.props.fileAPI && this.props.fileAPI.getFullMetadata(metadata.id)
                        .then((fullMetadata) => {
                            if (fullMetadata.trashed) {
                                this.props.dispatch(setFileErrorAction(metadata.id))
                            } else {
                                this.props.dispatch(addFilesAction([fullMetadata]));
                            }
                        })
                        .catch((err) => {
                            this.props.dispatch(setFileErrorAction(metadata.id))
                        });
                } else if (driveMetadata.appProperties) {
                    this.props.dispatch(updateTabletopObjectAction(id, driveMetadata));
                }
            }
            if (metadata && metadata.mimeType !== constants.MIME_TYPE_JSON && this.state.texture[metadata.id] === undefined) {
                // Prevent loading the same texture multiple times.
                this.state.texture[metadata.id] = null;
                this.context.textureLoader.loadTexture(metadata, (texture: THREE.Texture) => {
                    this.setState({texture: {...this.state.texture, [metadata.id]: texture}});
                });
            }
        })
    }

    setScene(scene: THREE.Scene) {
        this.setState({scene});
    }

    setCamera(camera: THREE.Camera) {
        this.setState({camera});
    }

    setSelected(selected: TabletopViewComponentSelected | undefined) {
        if (selected !== this.state.selected) {
            this.state.selected && this.state.selected.finish && this.state.selected.finish();
            this.setState({selected});
        }
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

    findAncestorWithUserDataFields(object: any, fields: RayCastField[]): [any, RayCastField] | null {
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

    rayCastForFirstUserDataFields(position: THREE.Vector2, fields: RayCastField | RayCastField[], intersects = this.rayCastFromScreen(position)) {
        const interestLevelY = this.getInterestLevelY();
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        const selected = intersects.reduce((selected, intersect) => {
            const hit = (intersect.point.y > interestLevelY) ? 'secondary' : 'primary';
            if (!selected[hit]) {
                const ancestor = this.findAncestorWithUserDataFields(intersect.object, fieldsArray);
                if (ancestor) {
                    const [object, field] = ancestor;
                    return {...selected, [hit]: {
                        [field]: object.userDataA[field],
                        point: intersect.point,
                        position,
                        object: intersect.object
                    }};
                }
            }
            return selected;
        }, {});
        return selected['primary'] || selected['secondary'];
    }

    duplicateMini(miniId: string) {
        this.setState({menuSelected: undefined});
        const okOption = 'Ok';
        let duplicateNumber: number = 1;
        this.context.promiseModal && this.context.promiseModal({
            children: (
                <div className='duplicateMiniDialog'>
                    Duplicate this miniature
                    <InputField type='number' select={true} initialValue={duplicateNumber} onChange={(value: string) => {
                        duplicateNumber = Number(value);
                    }}/> time(s).
                </div>
            ),
            options: [okOption, 'Cancel']
        })
            .then((result: string) => {
                if (result === okOption) {
                    const baseMini = this.props.scenario.minis[miniId];
                    const match = baseMini.name.match(/^(.*?)( *[0-9]*)$/);
                    if (match) {
                        const baseName = match[1];
                        let name: string, suffix: number;
                        if (match[2]) {
                            suffix = Number(match[2]) + 1;
                        } else {
                            // Update base mini name too, since it didn't have a numeric suffix.
                            [name, suffix] = this.props.findUnusedMiniName(baseName);
                            this.props.dispatch(updateMiniNameAction(miniId, name));
                        }
                        for (let count = 0; count < duplicateNumber; ++count) {
                            [name, suffix] = this.props.findUnusedMiniName(baseName, suffix);
                            const position = this.props.findPositionForNewMini(baseMini.scale, baseMini.position);
                            this.props.dispatch(addMiniAction({
                                ...baseMini, name, position, movementPath: this.props.scenario.confirmMoves ? [position] : undefined
                            }));
                        }
                    }
                }
            });
    }

    panMini(position: THREE.Vector2, id: string) {
        const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
        // If the ray intersects with a map, drag over the map - otherwise drag over starting plane.
        const dragY = (selected && selected.mapId) ? (this.props.scenario.maps[selected.mapId].position.y - this.state.dragOffset!.y) : this.state.defaultDragY!;
        this.plane.setComponents(0, -1, 0, dragY);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            this.props.dispatch(updateMiniPositionAction(id, this.offset, this.props.myPeerId));
        }
    }

    panMap(position: THREE.Vector2, id: string) {
        const dragY = this.props.scenario.maps[id].position.y;
        this.plane.setComponents(0, -1, 0, dragY);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            this.props.dispatch(updateMapPositionAction(id, this.offset, this.props.myPeerId));
        }
    }

    rotateMini(delta: ObjectVector2, id: string, currentPos?: ObjectVector2) {
        let amount;
        if (currentPos) {
            const miniScreenPos = this.object3DToScreenCoords(this.state.selected!.object!);
            const quadrant14 = (currentPos.x - miniScreenPos.x > currentPos.y - miniScreenPos.y);
            const quadrant12 = (currentPos.x - miniScreenPos.x > miniScreenPos.y - currentPos.y);
            amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
        } else {
            amount = delta.x;
        }
        let rotation = buildEuler(this.props.scenario.minis[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * amount / this.props.size.width;
        this.props.dispatch(updateMiniRotationAction(id, rotation, this.props.myPeerId));
    }

    rotateMap(delta: ObjectVector2, id: string) {
        let rotation = buildEuler(this.props.scenario.maps[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * delta.x / this.props.size.width;
        this.props.dispatch(updateMapRotationAction(id, rotation, this.props.myPeerId));
    }

    elevateMini(delta: ObjectVector2, id: string) {
        const {elevation} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniElevationAction(id, elevation - delta.y / 20, this.props.myPeerId));
    }

    scaleMini(delta: ObjectVector2, id: string) {
        const {scale} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniScaleAction(id, Math.max(0.25, scale - delta.y / 20), this.props.myPeerId));
    }

    elevateMap(delta: ObjectVector2, mapId: string) {
        this.offset.copy(this.props.scenario.maps[mapId].position as THREE.Vector3).add({x: 0, y: -delta.y / 20, z: 0} as THREE.Vector3);
        const mapY = this.offset.y;
        this.props.dispatch(updateMapPositionAction(mapId, this.offset, this.props.myPeerId));
        if (mapId === this.props.focusMapId) {
            // Adjust camera to follow the focus map.
            const cameraLookAt = this.props.cameraLookAt.clone();
            cameraLookAt.y = mapY;
            this.props.setCamera({cameraLookAt});
        }
    }

    autoPanForFogOfWarRect() {
        if ((!this.state.fogOfWarRect || this.state.fogOfWarRect.showButtons) && this.state.autoPanInterval) {
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
                this.props.setCamera(panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
            }
        }
    }

    dragFogOfWarRect(position: THREE.Vector2, startPos: THREE.Vector2) {
        let fogOfWarRect = this.state.fogOfWarRect;
        if (!fogOfWarRect) {
            const selected = this.rayCastForFirstUserDataFields(startPos, 'mapId');
            if (selected) {
                const map = this.props.scenario.maps[selected.mapId];
                if (map.metadata.appProperties.gridColour === constants.GRID_NONE) {
                    if (!this.state.noGridToastId) {
                        this.setState({noGridToastId: toast('Map has no grid - Fog of War for it is disabled.', {
                                onClose: () => {this.setState({noGridToastId: undefined})}
                            })});
                    }
                } else {
                    this.offset.copy(selected.point);
                    this.offset.y += TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST;
                    fogOfWarRect = {mapId: selected.mapId, startPos: this.offset.clone(), endPos: this.offset.clone(),
                        colour: map.metadata.appProperties.gridColour || 'black', position, showButtons: false};
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

    onGestureStart(gesturePosition: THREE.Vector2) {
        this.setState({menuSelected: undefined});
        const fields: RayCastField[] = (this.state.selected && this.state.selected.mapId) ? ['mapId'] : ['miniId', 'mapId'];
        const selected = this.props.readOnly ? undefined : this.rayCastForFirstUserDataFields(gesturePosition, fields);
        if (this.state.selected && selected && this.state.selected.mapId === selected.mapId
            && this.state.selected.miniId === selected.miniId) {
            // reset dragOffset to the new offset
            const position = (this.state.selected.mapId ? this.props.scenario.maps[this.state.selected.mapId].position :
                this.props.scenario.minis[this.state.selected.miniId!].position) as THREE.Vector3;
            this.offset.copy(selected.point).sub(position);
            const dragOffset = {x: -this.offset.x, y: 0, z: -this.offset.z};
            this.setState({dragOffset});
        } else if (selected && selected.miniId && !this.props.fogOfWarMode && this.allowSelectWithSelectedBy(this.props.scenario.minis[selected.miniId].selectedBy)) {
            const position = this.props.scenario.minis[selected.miniId].position as THREE.Vector3;
            this.offset.copy(position).sub(selected.point);
            const dragOffset = {...this.offset};
            this.setSelected(selected);
            this.setState({dragOffset, defaultDragY: selected.point.y});
        } else {
            this.setSelected(undefined);
        }
    }

    private allowSelectWithSelectedBy(selectedBy: null | string) {
        return (!selectedBy || selectedBy === this.props.myPeerId || this.props.userIsGM);
    }

    onGestureEnd() {
        this.finaliseSelectedBy();
        const fogOfWarRect = this.state.fogOfWarRect ? {
            ...this.state.fogOfWarRect,
            showButtons: true
        } : undefined;
        const selected = (this.state.selected && this.state.selected.mapId) ? this.state.selected : undefined;
        this.setSelected(selected);
        this.setState({fogOfWarDragHandle: false, fogOfWarRect, repositionMapDragHandle: false});
    }

    private finaliseSelectedBy(selected: Partial<TabletopViewComponentSelected> | undefined = this.state.selected) {
        if (selected) {
            if (selected.mapId) {
                const {positionObj, rotationObj} = this.snapMap(selected.mapId);
                this.props.dispatch(updateMapPositionAction(selected.mapId, positionObj, null));
                this.props.dispatch(updateMapRotationAction(selected.mapId, rotationObj, null));
            } else if (selected.miniId) {
                const {positionObj, rotationObj, scaleFactor, elevation} = this.snapMini(selected.miniId);
                this.props.dispatch(updateMiniPositionAction(selected.miniId, positionObj, null));
                this.props.dispatch(updateMiniRotationAction(selected.miniId, rotationObj, null));
                this.props.dispatch(updateMiniElevationAction(selected.miniId, elevation, null));
                this.props.dispatch(updateMiniScaleAction(selected.miniId, scaleFactor, null));
            }
        }
    }

    onTap(position: THREE.Vector2) {
        if (this.state.fogOfWarDragHandle) {
            // show fog of war menu
            this.setState({
                menuSelected: {
                    buttons: this.fogOfWarOptions,
                    selected: {position},
                    label: 'Use this handle to pan the camera while in Fog of War mode.'
                }
            });
        } else if (this.state.repositionMapDragHandle) {
            // show reposition menu
            this.setState({
                menuSelected: {
                    buttons: this.repositionMapOptions,
                    selected: {position},
                    label: 'Use this handle to pan the camera while repositioning the map.'
                }
            });
        } else if (this.props.fogOfWarMode) {
            const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
            if (selected) {
                this.changeFogOfWarBitmask(null, {mapId: selected.mapId, startPos: selected.point,
                    endPos: selected.point, position, colour: '', showButtons: false});
            }
        } else if (!this.props.disableTapMenu) {
            const selected = this.rayCastForFirstUserDataFields(position, ['mapId', 'miniId']);
            if (selected) {
                const id = selected.miniId || selected.mapId;
                if (selected.object.type === 'Sprite') {
                    this.setState({menuSelected: undefined, editSelected: {selected, value: this.props.scenario.minis[id].name, finish: (value) => {
                        this.props.dispatch(updateMiniNameAction(id, value))
                    }}});
                } else {
                    const buttons = ((selected.miniId) ? this.selectMiniOptions : this.selectMapOptions);
                    this.setState({editSelected: undefined, menuSelected: {buttons, selected, id}});
                }
            }
            this.setSelected(undefined);
        }
    }

    onPan(delta: ObjectVector2, position: THREE.Vector2, startPos: THREE.Vector2) {
        if (this.props.fogOfWarMode && !this.state.fogOfWarDragHandle) {
            this.dragFogOfWarRect(position, startPos);
        } else if (!this.state.selected || this.state.repositionMapDragHandle) {
            this.props.setCamera(panCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
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
            this.state.camera && this.props.setCamera(zoomCamera(delta, this.state.camera, 2, 95));
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

    onRotate(delta: ObjectVector2, currentPos?: ObjectVector2) {
        if (!this.state.selected) {
            this.state.camera && this.props.setCamera(rotateCamera(delta, this.state.camera, this.props.size.width, this.props.size.height));
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
        } else if (this.state.selected.miniId && !this.state.selected.scale) {
            this.rotateMini(delta, this.state.selected.miniId, currentPos);
        } else if (this.state.selected.mapId) {
            this.rotateMap(delta, this.state.selected.mapId);
        }
    }

    /**
     * Return the Y level just below the first map above the focus map, or 10,000 if the top map has the focus.
     */
    getInterestLevelY() {
        const focusMapY = this.props.focusMapId && this.props.scenario.maps[this.props.focusMapId]
            && this.props.scenario.maps[this.props.focusMapId].position.y;
        if (focusMapY !== undefined) {
            return Object.keys(this.props.scenario.maps).reduce((y, mapId) => {
                const mapY = this.props.scenario.maps[mapId].position.y - 0.01;
                return (mapY < y && mapY > focusMapY) ? mapY : y;
            }, TabletopViewComponent.INTEREST_LEVEL_MAX);
        } else {
            return TabletopViewComponent.INTEREST_LEVEL_MAX;
        }
    }

    snapMap(mapId: string) {
        const {metadata, position: positionObj, rotation: rotationObj, selectedBy} = this.props.scenario.maps[mapId];
        if (!metadata.appProperties) {
            return {positionObj, rotationObj, dx: 0, dy: 0, width: 10, height: 10};
        }
        const dx = (1 + Number(metadata.appProperties.gridOffsetX) / Number(metadata.appProperties.gridSize)) % 1;
        const dy = (1 + Number(metadata.appProperties.gridOffsetY) / Number(metadata.appProperties.gridSize)) % 1;
        const width = Number(metadata.appProperties.width);
        const height = Number(metadata.appProperties.height);
        if (this.props.snapToGrid && selectedBy) {
            const mapRotation = Math.round(rotationObj.y / TabletopViewComponent.MAP_ROTATION_SNAP) * TabletopViewComponent.MAP_ROTATION_SNAP;
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

    renderMaps(interestLevelY: number) {
        const renderedMaps = Object.keys(this.props.scenario.maps)
            .filter((mapId) => (this.props.scenario.maps[mapId].position.y <= interestLevelY))
            .map((mapId) => {
                const {metadata, gmOnly, fogOfWar, selectedBy, name} = this.props.scenario.maps[mapId];
                return (gmOnly && this.props.playerView) ? null : (
                    <TabletopMapComponent
                        key={mapId}
                        name={name}
                        mapId={mapId}
                        metadata={metadata}
                        snapMap={this.snapMap}
                        texture={metadata && this.state.texture[metadata.id]}
                        fogBitmap={fogOfWar}
                        transparentFog={this.props.transparentFog}
                        highlight={!selectedBy ? null : (selectedBy === this.props.myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                        opacity={gmOnly ? 0.5 : 1.0}
                    />
                );
            });
        return renderedMaps.length > 0 ? renderedMaps : (
            <gridHelper size={40} step={40} colorGrid={0x444444} colorCenterLine={0x444444}/>
        )
    }

    snapMini(miniId: string) {
        const {position: positionObj, rotation: rotationObj, scale: scaleFactor, elevation, selectedBy, movementPath} = this.props.scenario.minis[miniId];
        if (this.props.snapToGrid && selectedBy) {
            const scale = scaleFactor > 1 ? Math.round(scaleFactor) : 1.0 / (Math.round(1.0 / scaleFactor));
            const gridSnap = scale > 1 ? 1 : scale;
            const offset = (scale / 2) % 1;
            const x = Math.floor((positionObj.x + gridSnap / 2 - offset) / gridSnap) * gridSnap + offset;
            const y = Math.round(positionObj.y);
            const z = Math.floor((positionObj.z + gridSnap / 2 - offset) / gridSnap) * gridSnap + offset;
            return {
                positionObj: {x, y, z},
                rotationObj: {...rotationObj, y: Math.round(rotationObj.y / TabletopViewComponent.MINI_ROTATION_SNAP) * TabletopViewComponent.MINI_ROTATION_SNAP},
                scaleFactor: scale,
                elevation: Math.round(elevation),
                movementPath
            };
        } else {
            return {positionObj, rotationObj, scaleFactor, elevation, movementPath};
        }
    }

    renderMinis(interestLevelY: number) {
        this.state.camera && this.state.camera.getWorldDirection(this.offset);
        const topDown = this.offset.dot(TabletopViewComponent.DIR_DOWN) > constants.TOPDOWN_DOT_PRODUCT;
        // In top-down mode, we want to counter-rotate labels.  Find camera inverse rotation around the Y axis.
        let cameraInverseQuat: THREE.Quaternion | undefined;
        if (this.state.camera) {
            const cameraQuaternion = this.state.camera.quaternion;
            this.offset.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z);
            this.offset.projectOnVector(TabletopViewComponent.DIR_DOWN);
            cameraInverseQuat = new THREE.Quaternion(this.offset.x, this.offset.y, this.offset.z, cameraQuaternion.w)
                .normalize();
        }
        return Object.keys(this.props.scenario.minis)
            .filter((miniId) => (this.props.scenario.minis[miniId].position.y <= interestLevelY))
            .map((miniId) => {
                const {metadata, gmOnly, name, selectedBy} = this.props.scenario.minis[miniId];
                const {positionObj, rotationObj, scaleFactor, elevation, movementPath} = this.snapMini(miniId);
                return (gmOnly && this.props.playerView) ? null :
                    (isTemplateMetadata(metadata)) ? (
                        <TabletopTemplateComponent
                            key={miniId}
                            miniId={miniId}
                            label={name}
                            labelSize={this.props.labelSize}
                            metadata={metadata}
                            positionObj={positionObj}
                            rotationObj={rotationObj}
                            scaleFactor={scaleFactor}
                            elevation={elevation}
                            highlight={!selectedBy ? null : (selectedBy === this.props.myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                            wireframe={gmOnly}
                        />
                    ) : (isMiniMetadata(metadata)) ? (
                        <TabletopMiniComponent
                            key={miniId}
                            label={name}
                            labelSize={this.props.labelSize}
                            miniId={miniId}
                            positionObj={positionObj}
                            rotationObj={rotationObj}
                            scaleFactor={scaleFactor}
                            elevation={elevation}
                            movementPath={movementPath}
                            distanceMode={this.props.tabletop.distanceMode || DistanceMode.STRAIGHT}
                            distanceRound={this.props.tabletop.distanceRound || DistanceRound.ROUND_OFF}
                            gridScale={this.props.tabletop.gridScale}
                            gridUnit={this.props.tabletop.gridUnit}
                            roundToGrid={this.props.snapToGrid}
                            metadata={metadata}
                            texture={metadata && this.state.texture[metadata.id]}
                            highlight={!selectedBy ? null : (selectedBy === this.props.myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                            opacity={gmOnly ? 0.5 : 1.0}
                            prone={this.props.scenario.minis[miniId].prone}
                            topDown={topDown || this.props.scenario.minis[miniId].flat}
                            cameraInverseQuat={cameraInverseQuat}
                        />
                    ) : null
            });
    }

    roundVectors(start: THREE.Vector3, end: THREE.Vector3) {
        if (start.x <= end.x) {
            start.x = Math.floor(start.x);
            end.x = Math.ceil(end.x) - 0.01;
        } else {
            start.x = Math.ceil(start.x) - 0.01;
            end.x = Math.floor(end.x);
        }
        if (start.z <= end.z) {
            start.z = Math.floor(start.z);
            end.z = Math.ceil(end.z) - 0.01;
        } else {
            start.z = Math.ceil(start.z) - 0.01;
            end.z = Math.floor(end.z);
        }
    }

    getMapGridRoundedVectors(map: MapType, rotation: THREE.Euler, worldStart: THREE.Vector3, worldEnd: THREE.Vector3) {
        const reverseRotation = new THREE.Euler(-rotation.x, -rotation.y, -rotation.z, rotation.order);
        const startPos = worldStart.clone().sub(map.position as THREE.Vector3).applyEuler(reverseRotation);
        const endPos = worldEnd.clone().sub(map.position as THREE.Vector3).applyEuler(reverseRotation);
        const gridSize = Number(map.metadata.appProperties.gridSize);
        const gridOffsetX = Number(map.metadata.appProperties.gridOffsetX) / gridSize;
        const gridOffsetY = Number(map.metadata.appProperties.gridOffsetY) / gridSize;
        const midDX = (Number(map.metadata.appProperties.width) / 2 - gridOffsetX) % 1;
        const midDZ = (Number(map.metadata.appProperties.height) / 2 - gridOffsetY) % 1;
        const roundAdjust = {x: midDX, y: 0, z: midDZ} as THREE.Vector3;
        startPos.add(roundAdjust);
        endPos.add(roundAdjust);
        this.roundVectors(startPos, endPos);
        startPos.sub(roundAdjust);
        endPos.sub(roundAdjust);
        return [startPos, endPos];
    }

    object3DToScreenCoords(object: THREE.Object3D) {
        object.getWorldPosition(this.offset);
        const projected = this.offset.project(this.state.camera!);
        return {x: (1 + projected.x) * this.props.size.width / 2, y: (1 - projected.y) * this.props.size.height / 2};
    }

    renderFogOfWarRect() {
        const fogOfWarRect = this.state.fogOfWarRect;
        if (fogOfWarRect) {
            const map = this.props.scenario.maps[fogOfWarRect.mapId];
            const rotation = buildEuler(map.rotation);
            const [startPos, endPos] = this.getMapGridRoundedVectors(map, rotation, fogOfWarRect.startPos, fogOfWarRect.endPos);
            const delta = this.offset.copy(endPos).sub(startPos);
            startPos.applyEuler(rotation).add(map.position as THREE.Vector3);
            endPos.applyEuler(rotation).add(map.position as THREE.Vector3);
            const dirPlusX = (delta.x > 0 ? TabletopViewComponent.DIR_EAST : TabletopViewComponent.DIR_WEST).clone().applyEuler(rotation);
            const dirPlusZ = (delta.z > 0 ? TabletopViewComponent.DIR_NORTH : TabletopViewComponent.DIR_SOUTH).clone().applyEuler(rotation);
            return (
                <group>
                    <arrowHelper
                        origin={startPos}
                        dir={dirPlusX}
                        length={Math.max(0.01, Math.abs(delta.x))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={startPos}
                        dir={dirPlusZ}
                        length={Math.max(0.01, Math.abs(delta.z))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={endPos}
                        dir={dirPlusX.clone().multiplyScalar(-1)}
                        length={Math.max(0.01, Math.abs(delta.x))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={endPos}
                        dir={dirPlusZ.clone().multiplyScalar(-1)}
                        length={Math.max(0.01, Math.abs(delta.z))}
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
        const {buttons: buttonOptions, selected, id, label} = this.state.menuSelected;
        let heading;
        if (id) {
            const data = (selected.miniId) ? this.props.scenario.minis : this.props.scenario.maps;
            if (!data[id]) {
                // Selected map or mini has been removed
                return null;
            }
            heading = data[id].name;
        } else {
            heading = label;
        }
        const buttons = buttonOptions.filter(({show}) => (!show || show(id)));
        return (buttons.length === 0) ? null : (
            <StayInsideContainer className='menu' containedWidth={this.props.size.width} containedHeight={this.props.size.height}
                                 top={selected.position!.y + 10} left={selected.position!.x + 10}>
                <div>{heading}</div>
                {
                    buttons.map(({label, title, onClick}) => (
                        <button key={label} title={title} onClick={() => {
                            onClick(id, selected.point!, selected.position!);
                        }}>
                            {label}
                        </button>
                    ))
                }
            </StayInsideContainer>
        );
    }

    renderEditSelected() {
        if (!this.state.editSelected) {
            return null;
        } else {
            const {selected, value, finish} = this.state.editSelected;
            const okAction = () => {
                this.setState((state) => {
                    state.editSelected && finish(state.editSelected.value);
                    return {editSelected: undefined};
                });
            };
            const cancelAction = () => {
                this.setState({editSelected: undefined});
            };
            const position = selected.object ? this.object3DToScreenCoords(selected.object)
                : {x: selected.position!.x + 10, y: selected.position!.y + 10};
            return (
                <div className='menu editSelected' style={{top: position.y, left: position.x}}>
                    <InputField type='text' initialValue={value} focus={true} onChange={(value: string) => {
                        this.setState({editSelected: {...this.state.editSelected!, value}});
                    }} specialKeys={{Escape: cancelAction, Esc: cancelAction, Return: okAction, Enter: okAction}}/>
                    <button onClick={okAction}>Ok</button>
                    <button onClick={cancelAction}>Cancel</button>
                </div>
            );
        }
    }

    changeFogOfWarBitmask(reveal: boolean | null, fogOfWarRect = this.state.fogOfWarRect) {
        if (!fogOfWarRect || !fogOfWarRect.mapId || !fogOfWarRect.startPos || !fogOfWarRect.endPos) {
            return;
        }
        const map = this.props.scenario.maps[fogOfWarRect.mapId];
        const rotation = buildEuler(map.rotation);
        const [startPos, endPos] = this.getMapGridRoundedVectors(map, rotation, fogOfWarRect.startPos, fogOfWarRect.endPos);
        const fogWidth = Number(map.metadata.appProperties.fogWidth);
        const fogHeight = Number(map.metadata.appProperties.fogHeight);
        const fogCentre = {x: fogWidth / 2, y: 0, z: fogHeight / 2} as THREE.Vector3;
        startPos.add(fogCentre);
        endPos.add(fogCentre);
        const startX = clamp(Math.floor(Math.min(startPos.x, endPos.x) + 0.5), 0, fogWidth);
        const startY = clamp(Math.floor(Math.min(startPos.z, endPos.z) + 0.5), 0, fogHeight);
        const endX = clamp(Math.floor(Math.max(startPos.x, endPos.x) - 0.49), 0, fogWidth);
        const endY = clamp(Math.floor(Math.max(startPos.z, endPos.z) - 0.49), 0, fogHeight);
        // Now iterate over FoW bitmap and set or clear bits.
        let fogOfWar = map.fogOfWar ? [...map.fogOfWar] : new Array(Math.ceil(fogWidth * fogHeight / 32.0)).fill(-1);
        for (let y = startY; y <= endY; ++y) {
            for (let x = startX; x <= endX; ++x) {
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
            <StayInsideContainer className='menu' containedWidth={this.props.size.width} containedHeight={this.props.size.height}
                                 top={this.state.fogOfWarRect.position.y} left={this.state.fogOfWarRect.position.x}>
                <button onClick={() => {this.changeFogOfWarBitmask(false)}}>Cover</button>
                <button onClick={() => {this.changeFogOfWarBitmask(true)}}>Uncover</button>
                <button onClick={() => {this.setState({fogOfWarRect: undefined})}}>Cancel</button>
            </StayInsideContainer>
        );
    }

    render() {
        const cameraProps = {
            name: 'camera',
            fov: 45,
            aspect: this.props.size.width / this.props.size.height,
            near: 0.1,
            far: 200,
            position: this.props.cameraPosition,
            lookAt: this.props.cameraLookAt
        };
        const interestLevelY = this.getInterestLevelY();
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
                            {this.renderMaps(interestLevelY)}
                            {this.renderMinis(interestLevelY)}
                            {this.renderFogOfWarRect()}
                        </scene>
                    </React3>
                    {
                        !this.props.fogOfWarMode ? null : (
                            <div
                                className='cameraDragHandle'
                                onMouseDown={() => {this.setState({fogOfWarDragHandle: true})}}
                                onTouchStart={() => {this.setState({fogOfWarDragHandle: true})}}
                            >
                                <div className='material-icons'>pan_tool</div>
                            </div>
                        )
                    }
                    {
                        (!this.state.selected || !this.state.selected.mapId) ? null : (
                            <div
                                className='cameraDragHandle'
                                onMouseDown={() => {this.setState({repositionMapDragHandle: true})}}
                                onTouchStart={() => {this.setState({repositionMapDragHandle: true})}}
                            >
                                <div className='material-icons'>pan_tool</div>
                            </div>
                        )
                    }
                </GestureControls>
                {this.renderMenuSelected()}
                {this.renderEditSelected()}
                {this.renderFogOfWarButtons()}
            </div>
        );
    }
}

export default sizeMe({monitorHeight: true})(TabletopViewComponent as ComponentTypeWithDefaultProps<typeof TabletopViewComponent>);