import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import React3 from 'react-three-renderer';
import {withResizeDetector} from 'react-resize-detector';
import {clamp} from 'lodash';
import {AnyAction, Dispatch} from 'redux';
import {toast} from 'react-toastify';
import Timer = NodeJS.Timer;
import {ChromePicker} from 'react-color';

import GestureControls, {ObjectVector2} from '../container/gestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {
    addMiniAction,
    addMiniWaypointAction,
    cancelMiniMoveAction,
    confirmMiniMoveAction, finaliseMapSelectedByAction,
    finaliseMiniSelectedByAction,
    removeMapAction,
    removeMiniAction,
    removeMiniWaypointAction,
    updateAttachMinisAction,
    updateMapFogOfWarAction,
    updateMapGMOnlyAction,
    updateMapMetadataLocalAction,
    updateMapPositionAction,
    updateMapRotationAction,
    updateMiniBaseColourAction,
    updateMiniElevationAction,
    updateMiniFlatAction,
    updateMiniGMOnlyAction,
    updateMiniHideBaseAction, updateMiniLockedAction,
    updateMiniMetadataLocalAction,
    updateMiniNameAction,
    updateMiniPositionAction,
    updateMiniProneAction,
    updateMiniRotationAction,
    updateMiniScaleAction
} from '../redux/scenarioReducer';
import {ReduxStoreType} from '../redux/mainReducer';
import TabletopMapComponent from './tabletopMapComponent';
import TabletopMiniComponent from './tabletopMiniComponent';
import TabletopResourcesComponent from './tabletopResourcesComponent';
import {buildEuler, buildVector3} from '../util/threeUtils';
import {
    DistanceMode,
    DistanceRound,
    MapType,
    MiniType,
    MovementPathPoint,
    ObjectVector3,
    ScenarioType,
    TabletopType,
    WithMetadataType
} from '../util/scenarioUtils';
import {ComponentTypeWithDefaultProps} from '../util/types';
import {SAME_LEVEL_MAP_DELTA_Y, VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import {
    castTemplateAppProperties,
    DriveMetadata,
    isMiniMetadata,
    isTemplateMetadata,
    TabletopObjectAppProperties,
    TemplateAppProperties,
    TemplateShape
} from '../util/googleDriveUtils';
import {FileAPIContext} from '../util/fileUtils';
import StayInsideContainer from '../container/stayInsideContainer';
import {TextureLoaderContext} from '../util/driveTextureLoader';
import * as constants from '../util/constants';
import InputField from './inputField';
import {PromiseModalContext} from '../container/authenticatedContainer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {addFilesAction, setFetchingFileAction, setFileErrorAction} from '../redux/fileIndexReducer';
import TabletopTemplateComponent from './tabletopTemplateComponent';
import InputButton from './inputButton';

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

export interface TabletopViewComponentCameraView {
    fullWidth: number,
    fullHeight: number,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
}

interface TabletopViewComponentProps {
    width: number;
    height: number;
    fullDriveMetadata: {[key: string]: DriveMetadata};
    dispatch: Dispatch<ReduxStoreType>;
    scenario: ScenarioType;
    tabletop: TabletopType;
    setCamera: (parameters: Partial<VirtualGamingTabletopCameraState>) => void;
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    fogOfWarMode: boolean;
    endFogOfWarMode: () => void;
    snapToGrid: boolean;
    userIsGM: boolean;
    setFocusMapId: (mapId: string, moveCamera?: boolean) => void;
    findPositionForNewMini: (scale: number, basePosition?: THREE.Vector3 | ObjectVector3) => ObjectVector3;
    findUnusedMiniName: (baseName: string, suffix?: number) => [string, number]
    focusMapId?: string;
    readOnly: boolean;
    playerView: boolean;
    labelSize: number;
    myPeerId: MyPeerIdReducerType;
    disableTapMenu?: boolean;
    cameraView?: TabletopViewComponentCameraView;
}

interface TabletopViewComponentState {
    texture: {[key: string]: THREE.Texture | null};
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
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
    scaleToastId?: number;
}

type RayCastField = 'mapId' | 'miniId';

type RayCastIntersect = {
    mapId?: string;
    miniId?: string;
    point: THREE.Vector3;
    position: THREE.Vector2;
    object: THREE.Object3D;
}

class TabletopViewComponent extends React.Component<TabletopViewComponentProps, TabletopViewComponentState> {

    static propTypes = {
        fullDriveMetadata: PropTypes.object.isRequired,
        dispatch: PropTypes.func.isRequired,
        scenario: PropTypes.object.isRequired,
        tabletop: PropTypes.object.isRequired,
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

    static DELTA = 0.01;

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
        promiseModal: PropTypes.func,
        fileAPI: PropTypes.object
    };

    context: TextureLoaderContext & PromiseModalContext & FileAPIContext;

    private rayCaster: THREE.Raycaster;
    private rayPoint: THREE.Vector2;
    private offset: THREE.Vector3;
    private plane: THREE.Plane;

    private selectMapOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Focus on Map',
            title: 'Focus the camera on this map.',
            onClick: (mapId: string) => {this.props.setFocusMapId(mapId)},
            show: (mapId: string) => (mapId !== this.props.focusMapId)
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
                this.props.setFocusMapId(mapId, false);
                this.setState({selected: {mapId, point, finish: () => {
                    this.finaliseSelectedBy();
                    this.setState({repositionMapDragHandle: false, selected: undefined});
                }}, menuSelected: undefined});
            },
            show: () => (this.props.userIsGM)
        },
        {
            label: 'Lower map one level',
            title: 'Lower this map down to the elevation of the next map below',
            onClick: (mapId: string) => {
                const mapToMove = this.props.scenario.maps[mapId];
                const nextMapDown = Object.keys(this.props.scenario.maps).reduce<MapType | null>((nextMapDown, otherMapId) => {
                    const map = this.props.scenario.maps[otherMapId];
                    return map.position.y < mapToMove.position.y && (!nextMapDown || map.position.y > nextMapDown.position.y)
                        ? map : nextMapDown;
                }, null);
                if (nextMapDown) {
                    this.props.dispatch(updateMapPositionAction(mapId,
                        {...mapToMove.position, y: nextMapDown.position.y + 0.01}, null));
                }
            },
            show: (mapId: string) => {
                const map = this.props.scenario.maps[mapId];
                for (let otherMapId of Object.keys(this.props.scenario.maps)) {
                    if (this.props.scenario.maps[otherMapId].position.y < map.position.y) {
                        return true;
                    }
                }
                return false;
            }
        },
        {
            label: 'Lift map one level',
            title: 'Lift this map up to the elevation of the next map above',
            onClick: (mapId: string) => {
                const mapToMove = this.props.scenario.maps[mapId];
                const nextMapUp = Object.keys(this.props.scenario.maps).reduce<MapType | null>((nextMapUp, otherMapId) => {
                    const map = this.props.scenario.maps[otherMapId];
                    return map.position.y > mapToMove.position.y && (!nextMapUp || map.position.y < nextMapUp.position.y)
                        ? map : nextMapUp;
                }, null);
                if (nextMapUp) {
                    this.props.dispatch(updateMapPositionAction(mapId,
                        {...mapToMove.position, y: nextMapUp.position.y + 0.01}, null));
                }
            },
            show: (mapId: string) => {
                const map = this.props.scenario.maps[mapId];
                for (let otherMapId of Object.keys(this.props.scenario.maps)) {
                    if (this.props.scenario.maps[otherMapId].position.y > map.position.y) {
                        return true;
                    }
                }
                return false;
            }
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
        if (mini.attachMiniId) {
            mini = this.props.scenario.minis[mini.attachMiniId];
        }
        return (!mini.movementPath) ? false :
            (mini.movementPath.length > 1) ? true :
                mini.movementPath[0].x !== mini.position.x
                || mini.movementPath[0].y !== mini.position.y
                || mini.movementPath[0].z !== mini.position.z
                || (mini.movementPath[0].elevation || 0) !== mini.elevation
    }

    private getMiniName(miniId: string): string {
        const mini = this.props.scenario.minis[miniId];
        const suffix = (mini.attachMiniId) ? ' attached to ' + this.getMiniName(mini.attachMiniId) : '';
        return (mini.name || (mini.metadata.name + (isTemplateMetadata(mini.metadata) ? ' template' : ' miniature'))) + suffix;
    }

    private selectMiniOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Confirm Move',
            title: 'Reset the mini\'s starting position to its current location',
            onClick: (miniId: string) => {
                this.props.dispatch(confirmMiniMoveAction(this.props.scenario.minis[miniId].attachMiniId || miniId));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.hasMiniMoved(this.props.scenario.minis[miniId]))
        },
        {
            label: 'Make Waypoint',
            'title': 'Make the current position a waypoint on the path',
            onClick: (miniId: string) => {
                this.props.dispatch(addMiniWaypointAction(this.props.scenario.minis[miniId].attachMiniId || miniId));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.hasMiniMoved(this.props.scenario.minis[miniId]))
        },
        {
            label: 'Remove Waypoint',
            'title': 'Remove the last waypoint added to the path',
            onClick: (miniId: string) => {
                this.props.dispatch(removeMiniWaypointAction(this.props.scenario.minis[miniId].attachMiniId || miniId));
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
                this.props.dispatch(cancelMiniMoveAction(this.props.scenario.minis[miniId].attachMiniId || miniId));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.hasMiniMoved(this.props.scenario.minis[miniId]))
        },
        {
            label: 'Attach...',
            title: 'Attach this mini to another.',
            onClick: (miniId: string) => {
                const buttons: TabletopViewComponentMenuOption[] = this.getOverlappingDetachedMinis(miniId).map((attachMiniId) => {
                    const name = this.getMiniName(attachMiniId);
                    return {
                        label: 'Attach to ' + name,
                        title: 'Attach this mini to ' + name,
                        onClick: () => {
                            let {positionObj, rotationObj, elevation} = this.snapMini(miniId);
                            // Need to make position and rotation relative to the attachMiniId
                            const {positionObj: attachPosition, rotationObj: attachRotation, elevation: otherElevation} = this.snapMini(attachMiniId);
                            positionObj = buildVector3(positionObj).sub(attachPosition as THREE.Vector3).applyEuler(new THREE.Euler(-attachRotation.x, -attachRotation.y, -attachRotation.z, attachRotation.order));
                            rotationObj = {x: rotationObj.x - attachRotation.x, y: rotationObj.y - attachRotation.y, z: rotationObj.z - attachRotation.z, order: rotationObj.order};
                            this.props.dispatch(updateAttachMinisAction(miniId, attachMiniId, positionObj, rotationObj, elevation - otherElevation));
                            this.setState({menuSelected: undefined});
                        }
                    }
                });
                if (buttons.length === 1) {
                    buttons[0].onClick('');
                } else {
                    this.setState({menuSelected: {...this.state.menuSelected!, buttons}});
                }
            },
            show: (miniId: string) => (!this.props.scenario.minis[miniId].attachMiniId && this.getOverlappingDetachedMinis(miniId).length > 0)
        },
        {
            label: 'Detach',
            title: 'Detach this mini from the template or mini it is attached to.',
            onClick: (miniId: string) => {
                const {positionObj, rotationObj, elevation} = this.snapMini(miniId);
                this.props.dispatch(updateAttachMinisAction(miniId, undefined, positionObj, rotationObj, elevation));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.props.scenario.minis[miniId].attachMiniId !== undefined)
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
            label: 'Lock Position',
            title: 'Prevent movement of this mini until unlocked again.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniLockedAction(miniId, true))},
            show: (miniId: string) => (this.props.userIsGM && !this.props.scenario.minis[miniId].attachMiniId && !this.props.scenario.minis[miniId].locked)
        },
        {
            label: 'Unlock Position',
            title: 'Allow movement of this mini again.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniLockedAction(miniId, false))},
            show: (miniId: string) => (this.props.userIsGM && !this.props.scenario.minis[miniId].attachMiniId && this.props.scenario.minis[miniId].locked)
        },
        {
            label: 'Hide Base',
            title: 'Hide the base of the standee mini.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniHideBaseAction(miniId, true))},
            show: (miniId: string) => (this.props.userIsGM && isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].hideBase)
        },
        {
            label: 'Show Base',
            title: 'Show the base of the standee mini.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniHideBaseAction(miniId, false))},
            show: (miniId: string) => (this.props.userIsGM && isMiniMetadata(this.props.scenario.minis[miniId].metadata) && this.props.scenario.minis[miniId].hideBase)
        },
        {
            label: 'Color Base',
            title: 'Change the standee mini\'s base color.',
            onClick: (miniId: string) => {this.changeMiniBaseColour(miniId)},
            show: (miniId: string) => (this.props.userIsGM && isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].hideBase)
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
                if (!this.state.scaleToastId) {
                    this.setState({scaleToastId: toast('Zoom in or out to change mini scale.', {
                            onClose: () => {this.setState({scaleToastId: undefined})}
                        })});
                }

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
            onClick: () => {this.props.endFogOfWarMode()},
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

    componentDidUpdate(): void {
        this.updateCameraViewOffset();
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
        if (!props.fogOfWarMode && (this.state.fogOfWarDragHandle || this.state.fogOfWarRect ||
                (this.state.menuSelected && this.state.menuSelected.buttons === this.fogOfWarOptions))) {
            this.setState({menuSelected: undefined, fogOfWarRect: undefined, fogOfWarDragHandle: false});
        }
    }

    private checkMetadata(object: {[key: string]: WithMetadataType<TabletopObjectAppProperties>}, updateTabletopObjectAction: (id: string, metadata: DriveMetadata) => AnyAction) {
        Object.keys(object).forEach((id) => {
            let metadata = object[id].metadata;
            if (metadata && !metadata.appProperties) {
                const driveMetadata = this.props.fullDriveMetadata[metadata.id];
                if (!driveMetadata) {
                    // Avoid requesting the same metadata multiple times
                    this.props.dispatch(setFetchingFileAction(metadata.id));
                    this.context.fileAPI.getFullMetadata(metadata.id)
                        .then((fullMetadata) => {
                            if (fullMetadata.trashed) {
                                this.props.dispatch(setFileErrorAction(metadata.id))
                            } else {
                                this.props.dispatch(addFilesAction([fullMetadata]));
                            }
                        })
                        .catch(() => {
                            this.props.dispatch(setFileErrorAction(metadata.id))
                        });
                } else if (driveMetadata.appProperties) {
                    this.props.dispatch(updateTabletopObjectAction(id, driveMetadata));
                    metadata = driveMetadata as any;
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

    setCamera(camera: THREE.PerspectiveCamera) {
        this.setState({camera});
    }

    setSelected(selected: TabletopViewComponentSelected | undefined) {
        if (selected !== this.state.selected) {
            this.state.selected && this.state.selected.finish && this.state.selected.finish();
            this.setState({selected});
        }
    }

    private rayCastFromScreen(position: THREE.Vector2): THREE.Intersection[] {
        if (this.state.scene && this.state.camera) {
            this.rayPoint.x = 2 * position.x / this.props.width - 1;
            this.rayPoint.y = 1 - 2 * position.y / this.props.height;
            this.rayCaster.setFromCamera(this.rayPoint, this.state.camera);
            return this.rayCaster.intersectObjects(this.state.scene.children, true);
        } else {
            return [];
        }
    }

    private findAncestorWithUserDataFields(intersect: THREE.Intersection, fields: RayCastField[]): [any, RayCastField, THREE.Intersection] | null {
        let object: any = intersect.object;
        while (object && object.type !== 'LineSegments') {
            let matchingField = object.userDataA && fields.reduce((result, field) =>
                (result || (object.userDataA[field] && field)), null);
            if (matchingField) {
                return [object, matchingField, intersect];
            } else {
                object = object.parent;
            }
        }
        return null;
    }

    private rayCastForFirstUserDataFields(position: THREE.Vector2, fields: RayCastField | RayCastField[], intersects: THREE.Intersection[] = this.rayCastFromScreen(position)): RayCastIntersect | null {
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        return intersects.reduce((selected, intersect) => {
            if (!selected) {
                const ancestor = this.findAncestorWithUserDataFields(intersect, fieldsArray);
                if (ancestor) {
                    const [object, field] = ancestor;
                    return {
                        [field]: object.userDataA[field],
                        point: intersect.point,
                        position,
                        object: intersect.object
                    };
                }
            }
            return selected;
        }, null);
    }

    private rayCastForAllUserDataFields(position: THREE.Vector2, fields: RayCastField | RayCastField[], intersects: THREE.Intersection[] = this.rayCastFromScreen(position)): RayCastIntersect[] {
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        let inResult = {};
        return intersects
            .map((intersect) => {
                const ancestor = this.findAncestorWithUserDataFields(intersect, fieldsArray);
                if (ancestor) {
                    const [object, field] = ancestor;
                    return {
                        [field]: object.userDataA[field],
                        point: intersect.point,
                        position,
                        object: intersect.object
                    }
                } else {
                    return null;
                }
            })
            .filter((intersect): intersect is RayCastIntersect => (intersect !== null))
            .filter((intersect) => {
                const id = intersect.mapId || intersect.miniId;
                const otherId = intersect.miniId ? this.props.scenario.minis[intersect.miniId].attachMiniId : undefined;
                if (inResult[id!] || (otherId && inResult[otherId])) {
                    return false;
                } else {
                    inResult[id!] = true;
                    return true;
                }
            });
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
                            let position: MovementPathPoint = this.props.findPositionForNewMini(baseMini.scale, baseMini.position);
                            if (baseMini.elevation) {
                                position = {...position, elevation: baseMini.elevation};
                            }
                            this.props.dispatch(addMiniAction({
                                ...baseMini, name, position, movementPath: this.props.scenario.confirmMoves ? [position] : undefined
                            }));
                        }
                    }
                }
            });
    }

    changeMiniBaseColour(miniId: string) {
        this.setState({menuSelected: undefined});
        const okOption = 'Ok';
        let baseColour = this.props.scenario.minis[miniId].baseColour || 0;
        const colourObj = {
            r: (baseColour >> 16) & 0xff,
            g: (baseColour >> 8) & 0xff,
            b: baseColour & 0xff
        };
        this.context.promiseModal && this.context.promiseModal({
            children: (
                <div>
                    <p>Set base color for {this.props.scenario.minis[miniId].name}.</p>
                    <ChromePicker color={colourObj} disableAlpha={true} onChangeComplete={(colourObj) => {
                        baseColour = (colourObj.rgb.r << 16) + (colourObj.rgb.g << 8) + colourObj.rgb.b;
                    }}/>
                </div>
            ),
            options: [okOption, 'Cancel']
        })
            .then((result: string) => {
                if (result === okOption) {
                    this.props.dispatch(updateMiniBaseColourAction(miniId, baseColour));
                }
            });
    }

    panMini(position: THREE.Vector2, miniId: string) {
        const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
        // If the ray intersects with a map, drag over the map - otherwise drag over starting plane.
        const dragY = (selected && selected.mapId) ? (this.props.scenario.maps[selected.mapId].position.y - this.state.dragOffset!.y) : this.state.defaultDragY!;
        this.plane.setComponents(0, -1, 0, dragY);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            const {attachMiniId} = this.props.scenario.minis[miniId];
            if (attachMiniId) {
                // Need to reorient the drag position to be relative to the attachMiniId
                const {positionObj, rotationObj} = this.snapMini(attachMiniId);
                this.offset.sub(positionObj as THREE.Vector3).applyEuler(new THREE.Euler(-rotationObj.x, -rotationObj.y, -rotationObj.z, rotationObj.order));
            }
            this.props.dispatch(updateMiniPositionAction(miniId, this.offset, this.props.myPeerId));
        }
    }

    panMap(position: THREE.Vector2, mapId: string) {
        const dragY = this.props.scenario.maps[mapId].position.y;
        this.plane.setComponents(0, -1, 0, dragY);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            this.props.dispatch(updateMapPositionAction(mapId, this.offset, this.props.myPeerId));
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
        rotation.y += 2 * Math.PI * amount / this.props.width;
        this.props.dispatch(updateMiniRotationAction(id, rotation, this.props.myPeerId));
    }

    rotateMap(delta: ObjectVector2, id: string) {
        let rotation = buildEuler(this.props.scenario.maps[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * delta.x / this.props.width;
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
        const deltaVector = {x: 0, y: -delta.y / 20, z: 0} as THREE.Vector3;
        this.offset.copy(this.props.scenario.maps[mapId].position as THREE.Vector3).add(deltaVector);
        this.props.dispatch(updateMapPositionAction(mapId, this.offset, this.props.myPeerId));
        if (mapId === this.props.focusMapId) {
            // Adjust camera to follow the focus map.
            this.props.setCamera({
                cameraLookAt: this.props.cameraLookAt.clone().add(deltaVector),
                cameraPosition: this.props.cameraPosition.clone().add(deltaVector)
            });
        }
    }

    autoPanForFogOfWarRect() {
        if ((!this.state.fogOfWarRect || this.state.fogOfWarRect.showButtons) && this.state.autoPanInterval) {
            clearInterval(this.state.autoPanInterval);
            this.setState({autoPanInterval: undefined});
        } else {
            let delta = {x: 0, y: 0};
            const dragBorder = Math.min(TabletopViewComponent.FOG_RECT_DRAG_BORDER, this.props.width / 10, this.props.height / 10);
            const {position} = this.state.fogOfWarRect!;
            if (position.x < dragBorder) {
                delta.x = dragBorder - position.x;
            } else if (position.x >= this.props.width - dragBorder) {
                delta.x = this.props.width - dragBorder - position.x;
            }
            if (position.y < dragBorder) {
                delta.y = dragBorder - position.y;
            } else if (position.y >= this.props.height - dragBorder) {
                delta.y = this.props.height - dragBorder - position.y;
            }
            if (this.state.camera && (delta.x || delta.y)) {
                this.props.setCamera(panCamera(delta, this.state.camera, this.props.width, this.props.height));
            }
        }
    }

    dragFogOfWarRect(position: THREE.Vector2, startPos: THREE.Vector2) {
        let fogOfWarRect = this.state.fogOfWarRect;
        if (!fogOfWarRect) {
            const selected = this.rayCastForFirstUserDataFields(startPos, 'mapId');
            if (selected && selected.mapId) {
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
        if (selected && selected.miniId && this.props.scenario.minis[selected.miniId].attachMiniId) {
            selected.miniId = this.props.scenario.minis[selected.miniId].attachMiniId;
        }
        if (this.state.selected && selected && this.state.selected.mapId === selected.mapId
            && this.state.selected.miniId === selected.miniId) {
            // reset dragOffset to the new offset
            const position = (this.state.selected.mapId ? this.props.scenario.maps[this.state.selected.mapId].position :
                this.snapMini(this.state.selected.miniId!).positionObj) as THREE.Vector3;
            this.offset.copy(selected.point).sub(position);
            const dragOffset = {x: -this.offset.x, y: 0, z: -this.offset.z};
            this.setState({dragOffset});
        } else if (selected && selected.miniId && !this.props.fogOfWarMode && this.allowSelectWithSelectedBy(this.props.scenario.minis[selected.miniId].selectedBy)) {
            const position = this.snapMini(selected.miniId).positionObj as THREE.Vector3;
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
                this.props.dispatch(finaliseMapSelectedByAction(selected.mapId, positionObj, rotationObj));
                this.props.dispatch(updateMapPositionAction(selected.mapId, positionObj, null));
                this.props.dispatch(updateMapRotationAction(selected.mapId, rotationObj, null));
            } else if (selected.miniId) {
                let {positionObj, rotationObj, scaleFactor, elevation} = this.snapMini(selected.miniId);
                const {attachMiniId} = this.props.scenario.minis[selected.miniId];
                if (attachMiniId) {
                    // Need to make position and rotation relative to the attached mini
                    const {positionObj: attachPosition, rotationObj: attachRotation} = this.snapMini(attachMiniId);
                    positionObj = buildVector3(positionObj).sub(attachPosition as THREE.Vector3).applyEuler(new THREE.Euler(-attachRotation.x, -attachRotation.y, -attachRotation.z, attachRotation.order));
                    rotationObj = {x: rotationObj.x - attachRotation.x, y: rotationObj.y - attachRotation.y, z: rotationObj.z - attachRotation.z, order: rotationObj.order};
                }
                this.props.dispatch(finaliseMiniSelectedByAction(selected.miniId, positionObj, rotationObj, scaleFactor, elevation));
                this.props.dispatch(updateMiniPositionAction(selected.miniId, positionObj, null));
                this.props.dispatch(updateMiniRotationAction(selected.miniId, rotationObj, null));
                this.props.dispatch(updateMiniElevationAction(selected.miniId, elevation, null));
                this.props.dispatch(updateMiniScaleAction(selected.miniId, scaleFactor, null));
            }
        }
    }

    private isMiniAttachedTo(miniId: string, targetMiniId: string): boolean {
        if (miniId === targetMiniId) {
            return true;
        } else {
            const mini = this.props.scenario.minis[miniId];
            return (mini.attachMiniId) ? this.isMiniAttachedTo(mini.attachMiniId, targetMiniId) : false;
        }
    }

    private doesMiniOverlapTemplate(miniId: string, templateId: string): boolean {
        const {positionObj: miniPosition, scaleFactor: miniScale} = this.snapMini(miniId);
        const {positionObj: templatePosition, elevation: templateElevation, rotationObj: templateRotation, scaleFactor: templateScale} = this.snapMini(templateId);
        const template: MiniType<TemplateAppProperties> = this.props.scenario.minis[templateId] as MiniType<TemplateAppProperties>;
        const templateProperties: TemplateAppProperties = castTemplateAppProperties(template.metadata.appProperties);
        const dx = templatePosition.x + templateProperties.offsetX - miniPosition.x,
            dy = templatePosition.y + templateProperties.offsetY + templateElevation - miniPosition.y,
            dz = templatePosition.z + templateProperties.offsetZ - miniPosition.z,
            miniRadius = miniScale / 2;
        const templateWidth = templateProperties.width * templateScale;
        const templateHeight = templateProperties.height * templateScale;
        if (dy < -templateHeight / 2 || dy > templateHeight / 2 + TabletopMiniComponent.MINI_HEIGHT * miniScale) {
            return false;
        }
        let rotatedPos;
        switch (templateProperties.templateShape) {
            case TemplateShape.RECTANGLE:
                rotatedPos = new THREE.Vector3(dx, 0, dz).applyQuaternion(new THREE.Quaternion().setFromEuler(buildEuler(templateRotation)).inverse());
                return (Math.abs(rotatedPos.x) < miniRadius + templateWidth / 2) && (Math.abs(rotatedPos.z) < miniRadius + (templateProperties.depth * templateScale) / 2);
            case TemplateShape.CIRCLE:
                return dx*dx + dz*dz < (miniRadius + templateWidth) * (miniRadius + templateWidth);
            case TemplateShape.ARC:
                if (dx*dx + dz*dz >= (miniRadius + templateWidth) * (miniRadius + templateWidth)) {
                    return false;
                }
                rotatedPos = new THREE.Vector3(-dx, 0, -dz).applyQuaternion(new THREE.Quaternion().setFromEuler(buildEuler(templateRotation)).inverse());
                const angle = Math.PI * (templateProperties.angle!) / 360;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const pointGreaterLine1 = sin * rotatedPos.x - cos * rotatedPos.z + miniRadius > 0;
                const pointGreaterLine2 = -sin * rotatedPos.x - cos * rotatedPos.z - miniRadius < 0;
                return ((templateProperties.angle!) < 180) ? pointGreaterLine1 && pointGreaterLine2 : pointGreaterLine1 || pointGreaterLine2;
        }
    }

    private doMinisOverlap(mini1Id: string, mini2Id: string): boolean {
        const mini1 = this.props.scenario.minis[mini1Id];
        const mini2 = this.props.scenario.minis[mini2Id];
        const mini1Template = isTemplateMetadata(mini1.metadata);
        const mini2Template = isTemplateMetadata(mini2.metadata);
        if (!mini1Template && !mini2Template) {
            const {positionObj: position1, scaleFactor: scale1} = this.snapMini(mini1Id);
            const {positionObj: position2, scaleFactor: scale2} = this.snapMini(mini2Id);
            const dx = position2.x - position1.x,
                dy = position2.y - position1.y,
                dz = position2.z - position1.z,
                r1 = scale1 / 2, r2 = scale2 / 2;
            return Math.abs(dy) < TabletopViewComponent.DELTA && (dx*dx + dz*dz < (r1 + r2) * (r1 + r2));
        } else if (mini1Template && mini2Template) {
            return false; // TODO
        } else if (mini1Template) {
            return this.doesMiniOverlapTemplate(mini2Id, mini1Id);
        } else {
            return this.doesMiniOverlapTemplate(mini1Id, mini2Id);
        }
    }

    private getOverlappingDetachedMinis(miniId: string): string[] {
        return Object.keys(this.props.scenario.minis).filter((otherMiniId) => {
            // Ensure we don't create attachment loops.
            if (this.isMiniAttachedTo(otherMiniId, miniId)) {
                return false;
            } else {
                return this.doMinisOverlap(miniId, otherMiniId);
            }
        });
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
            if (selected && selected.mapId) {
                this.changeFogOfWarBitmask(null, {mapId: selected.mapId, startPos: selected.point,
                    endPos: selected.point, position, colour: '', showButtons: false});
            }
        } else if (!this.props.disableTapMenu) {
            const allSelected = this.rayCastForAllUserDataFields(position, ['mapId', 'miniId']);
            if (allSelected.length > 0) {
                const selected = allSelected[0];
                const id = selected.miniId || selected.mapId;
                if (allSelected.length > 1 && !!selected.mapId === !!allSelected[1].mapId
                        && allSelected[0].point.clone().sub(allSelected[1].point).lengthSq() < SAME_LEVEL_MAP_DELTA_Y * SAME_LEVEL_MAP_DELTA_Y) {
                    // Click intersects with several maps or several minis which are close-ish - bring up disambiguation menu.
                    const buttons: TabletopViewComponentMenuOption[] = allSelected.filter((intersect) => (!!intersect.mapId === !!selected.mapId))
                        .map((intersect) => {
                            const name = intersect.mapId ? this.props.scenario.maps[intersect.mapId].name : this.getMiniName(intersect.miniId!);
                            return {
                                label: name,
                                title: 'Select ' + name,
                                onClick: () => {
                                    const buttons = ((intersect.miniId) ? this.selectMiniOptions : this.selectMapOptions);
                                    this.setState({menuSelected: {buttons, selected: intersect, id: intersect.mapId || intersect.miniId}});
                                }
                            }
                        });
                    this.setState({menuSelected: {buttons, selected, label: 'Which do you want to select?'}});
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
            this.props.setCamera(panCamera(delta, this.state.camera, this.props.width, this.props.height));
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
        } else if (this.state.selected.miniId && !this.state.selected.scale && !this.props.scenario.minis[this.state.selected.miniId].locked) {
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
            this.state.camera && this.props.setCamera(rotateCamera(delta, this.state.camera, this.props.width, this.props.height));
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
            && this.props.scenario.maps[this.props.focusMapId].position.y + SAME_LEVEL_MAP_DELTA_Y;
        if (focusMapY !== undefined) {
            return Object.keys(this.props.scenario.maps).reduce((y, mapId) => {
                const mapY = this.props.scenario.maps[mapId].position.y - TabletopViewComponent.DELTA;
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
                        transparentFog={this.props.userIsGM && !this.props.playerView}
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
        let {position: positionObj, rotation: rotationObj, scale: scaleFactor, elevation, selectedBy, movementPath, attachMiniId} = this.props.scenario.minis[miniId];
        if (attachMiniId) {
            const {positionObj: attachedPosition, rotationObj: attachedRotation, elevation: attachedElevation} = this.snapMini(attachMiniId);
            positionObj = buildVector3(positionObj).applyEuler(buildEuler(attachedRotation)).add(attachedPosition as THREE.Vector3);
            rotationObj = {x: rotationObj.x + attachedRotation.x, y: rotationObj.y + attachedRotation.y, z: rotationObj.z + attachedRotation.z, order: rotationObj.order};
            elevation += attachedElevation;
        }
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
        const cameraInverseQuat = this.getInverseCameraQuaternion();
        let templateY = {};
        return Object.keys(this.props.scenario.minis)
            .map((miniId) => {
                const {metadata, gmOnly, name, selectedBy, attachMiniId} = this.props.scenario.minis[miniId];
                const {positionObj, rotationObj, scaleFactor, elevation, movementPath} = this.snapMini(miniId);
                // Adjust templates drawing at the same Y level upwards to try to minimise Z-fighting.
                let elevationOffset = 0;
                if (isTemplateMetadata(metadata)) {
                    const y = positionObj.y + elevation + Number(metadata.appProperties.offsetY);
                    while (templateY[y + elevationOffset]) {
                        elevationOffset += 0.001;
                    }
                    templateY[y + elevationOffset] = true;
                }
                return ((gmOnly && this.props.playerView) || positionObj.y > interestLevelY) ? null :
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
                            elevation={elevation + elevationOffset}
                            highlight={!selectedBy ? null : (selectedBy === this.props.myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                            wireframe={gmOnly}
                            movementPath={attachMiniId ? undefined : movementPath}
                            distanceMode={this.props.tabletop.distanceMode || DistanceMode.STRAIGHT}
                            distanceRound={this.props.tabletop.distanceRound || DistanceRound.ROUND_OFF}
                            gridScale={this.props.tabletop.gridScale}
                            gridUnit={this.props.tabletop.gridUnit}
                            roundToGrid={this.props.snapToGrid || false}
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
                            movementPath={attachMiniId ? undefined : movementPath}
                            distanceMode={this.props.tabletop.distanceMode || DistanceMode.STRAIGHT}
                            distanceRound={this.props.tabletop.distanceRound || DistanceRound.ROUND_OFF}
                            gridScale={this.props.tabletop.gridScale}
                            gridUnit={this.props.tabletop.gridUnit}
                            roundToGrid={this.props.snapToGrid || false}
                            metadata={metadata}
                            texture={metadata && this.state.texture[metadata.id]}
                            highlight={!selectedBy ? null : (selectedBy === this.props.myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                            opacity={gmOnly ? 0.5 : 1.0}
                            prone={this.props.scenario.minis[miniId].prone || false}
                            topDown={topDown || this.props.scenario.minis[miniId].flat || false}
                            hideBase={this.props.scenario.minis[miniId].hideBase || false}
                            baseColour={this.props.scenario.minis[miniId].baseColour}
                            cameraInverseQuat={cameraInverseQuat}
                        />
                    ) : null
            });
    }

    private getInverseCameraQuaternion(): THREE.Quaternion {
        if (this.state.camera) {
            const cameraQuaternion = this.state.camera.quaternion;
            this.offset.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z);
            this.offset.projectOnVector(TabletopViewComponent.DIR_DOWN);
            return new THREE.Quaternion(this.offset.x, this.offset.y, this.offset.z, cameraQuaternion.w)
                .normalize();
        } else {
            return new THREE.Quaternion();
        }
    }

    roundVectors(start: THREE.Vector3, end: THREE.Vector3) {
        if (start.x <= end.x) {
            start.x = Math.floor(start.x);
            end.x = Math.ceil(end.x) - TabletopViewComponent.DELTA;
        } else {
            start.x = Math.ceil(start.x) - TabletopViewComponent.DELTA;
            end.x = Math.floor(end.x);
        }
        if (start.z <= end.z) {
            start.z = Math.floor(start.z);
            end.z = Math.ceil(end.z) - TabletopViewComponent.DELTA;
        } else {
            start.z = Math.ceil(start.z) - TabletopViewComponent.DELTA;
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

    updateCameraViewOffset() {
        if (this.state.camera) {
            const view = this.state.camera.view;
            if (this.props.cameraView) {
                if (!view
                    || view.fullWidth !== this.props.cameraView.fullWidth
                    || view.fullHeight !== this.props.cameraView.fullHeight
                    || view.offsetX !== this.props.cameraView.offsetX
                    || view.offsetY !== this.props.cameraView.offsetY
                    || view.width !== this.props.cameraView.width
                    || view.height !== this.props.cameraView.height
                ) {
                    this.state.camera.setViewOffset(this.props.cameraView.fullWidth, this.props.cameraView.fullHeight,
                        this.props.cameraView.offsetX, this.props.cameraView.offsetY, this.props.cameraView.width, this.props.cameraView.height);
                }
            } else if (view) {
                // Simply clearing the offset doesn't seem to reset the camera properly, so explicitly set it back to default first.
                this.state.camera.setViewOffset(this.props.width, this.props.height, 0, 0, this.props.width, this.props.height);
                this.state.camera.clearViewOffset();
            }
        }
    }

    object3DToScreenCoords(object: THREE.Object3D) {
        object.getWorldPosition(this.offset);
        const projected = this.offset.project(this.state.camera!);
        return {x: (1 + projected.x) * this.props.width / 2, y: (1 - projected.y) * this.props.height / 2};
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
                        length={Math.max(TabletopViewComponent.DELTA, Math.abs(delta.x))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={startPos}
                        dir={dirPlusZ}
                        length={Math.max(TabletopViewComponent.DELTA, Math.abs(delta.z))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={endPos}
                        dir={dirPlusX.clone().multiplyScalar(-1)}
                        length={Math.max(TabletopViewComponent.DELTA, Math.abs(delta.x))}
                        headLength={0.001}
                        headWidth={0.001}
                        color={fogOfWarRect.colour}
                    />
                    <arrowHelper
                        origin={endPos}
                        dir={dirPlusZ.clone().multiplyScalar(-1)}
                        length={Math.max(TabletopViewComponent.DELTA, Math.abs(delta.z))}
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
            <StayInsideContainer className='menu scrollable' top={selected.position!.y + 10} left={selected.position!.x + 10}>
                <div className='menuSelectedTitle'>{heading}</div>
                {
                    buttons.map(({label, title, onClick}, index) => (
                        <div key={'menuButton' + index}>
                            <InputButton type='button' title={title} onChange={() => {
                                onClick(id, selected.point!, selected.position!);
                            }}>
                                {label}
                            </InputButton>
                        </div>
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
                    <InputButton type='button' onChange={okAction}>Ok</InputButton>
                    <InputButton type='button' onChange={cancelAction}>Cancel</InputButton>
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
            <StayInsideContainer className='menu' top={this.state.fogOfWarRect.position.y} left={this.state.fogOfWarRect.position.x}>
                <InputButton type='button' onChange={() => {this.changeFogOfWarBitmask(false)}}>Cover</InputButton>
                <InputButton type='button' onChange={() => {this.changeFogOfWarBitmask(true)}}>Uncover</InputButton>
                <InputButton type='button' onChange={() => {this.setState({fogOfWarRect: undefined})}}>Cancel</InputButton>
            </StayInsideContainer>
        );
    }

    render() {
        const cameraProps = {
            name: 'camera',
            fov: 45,
            aspect: this.props.width / this.props.height,
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
                    <React3 mainCamera='camera' width={this.props.width || 0} height={this.props.height || 0}
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

export default withResizeDetector(TabletopViewComponent as ComponentTypeWithDefaultProps<typeof TabletopViewComponent>);