import React, {Fragment} from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import {AmbientLight, ArrowHelper, Group, Mesh} from 'react-three-fiber/components';
import {Canvas} from 'react-three-fiber';
import {withResizeDetector} from 'react-resize-detector';
import {clamp, isEqual, omit} from 'lodash';
import {AnyAction} from 'redux';
import {toast, ToastOptions} from 'react-toastify';
import {Physics, usePlane} from 'use-cannon';
import memoizeOne from 'memoize-one';
import {v4} from 'uuid';
import RichTextEditor, {EditorValue} from 'react-rte';
import {HTML} from 'drei';
import ReactMarkdown from 'react-markdown';

import GestureControls from '../container/gestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {
    addMiniAction,
    addMiniWaypointAction,
    cancelMiniMoveAction,
    confirmMiniMoveAction,
    removeMapAction,
    removeMiniAction,
    removeMiniWaypointAction,
    separateUndoGroupAction,
    undoGroupThunk,
    updateAttachMinisAction,
    updateMapCameraFocusPoint,
    updateMapFogOfWarAction,
    updateMapGMOnlyAction,
    updateMapMetadataLocalAction,
    updateMapPositionAction,
    updateMapRotationAction,
    updateMiniBaseColourAction,
    updateMiniElevationAction,
    updateMiniFlatAction,
    updateMiniHideBaseAction,
    updateMiniLockedAction,
    updateMiniMetadataLocalAction,
    updateMiniNameAction,
    updateMiniNoteMarkdownAction,
    updateMiniPositionAction,
    updateMiniProneAction,
    updateMiniRotationAction,
    updateMiniScaleAction,
    updateMiniVisibilityAction
} from '../redux/scenarioReducer';
import TabletopMapComponent from './tabletopMapComponent';
import TabletopMiniComponent from './tabletopMiniComponent';
import {buildEuler, buildVector3, hasAnyAudio, isVideoTexture, vector3ToObject} from '../util/threeUtils';
import {
    cartesianToHexCoords,
    DistanceMode,
    DistanceRound,
    getAbsoluteMiniPosition,
    getBaseCameraParameters,
    getColourHex,
    getFocusMapIdAndFocusPointAtLevel,
    getGridTypeOfMap,
    getMapFogRect,
    getMapGridRoundedVectors,
    getMapIdAtPoint,
    getMapIdOnNextLevel,
    getMapIdsAtLevel,
    getMaxCameraDistance,
    getPiecesRosterDisplayValue,
    getRootAttachedMiniId,
    getVisibilityString,
    isNameColumn,
    MAP_EPSILON,
    MapType,
    MiniType,
    MovementPathPoint,
    NEW_MAP_DELTA_Y,
    ObjectVector2,
    ObjectVector3,
    PiecesRosterColumn,
    PieceVisibilityEnum,
    SAME_LEVEL_MAP_DELTA_Y,
    ScenarioType,
    snapMap,
    snapMini,
    TabletopType,
    WithMetadataType
} from '../util/scenarioUtils';
import {ComponentTypeWithDefaultProps} from '../util/types';
import {VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import {
    AnyProperties,
    castMapProperties,
    castTemplateProperties,
    DriveMetadata,
    GridType,
    isMiniMetadata,
    isTemplateMetadata,
    MapProperties,
    MiniProperties,
    ScenarioObjectProperties,
    TemplateProperties,
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
import {joinAnd} from '../util/stringUtils';
import ColourPicker from './colourPicker';
import {updateTabletopAction, updateTabletopVideoMutedAction} from '../redux/tabletopReducer';
import TabletopGridComponent from './tabletopGridComponent';
import {GtoveDispatchProp} from '../redux/mainReducer';
import ControlledCamera from '../container/controlledCamera';
import Die from './die';
import {DiceReducerType, setDieResultAction} from '../redux/diceReducer';
import {addPingAction, PingReducerType} from '../redux/pingReducer';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import PingsComponent from './pingsComponent';
import {promiseSleep} from '../util/promiseSleep';
import VisibilitySlider from './visibilitySlider';
import Tooltip from './tooltip';
import {PaintState, PaintToolEnum} from './paintTools';
import ModalDialog from './modalDialog';

import './tabletopViewComponent.scss';

interface TabletopViewComponentCustomMenuOption {
    render: (id: string) => React.ReactElement;
    show?: (id: string) => boolean;
}

interface TabletopViewComponentButtonMenuOption {
    label: string;
    title: string;
    onClick: (id: string, selected: TabletopViewComponentSelected) => void;
    show?: (id: string) => boolean;
}

function isTabletopViewComponentButtonMenuOption(option: any): option is TabletopViewComponentButtonMenuOption {
    return option.label && option.title && option.onClick;
}

type TabletopViewComponentMenuOption = TabletopViewComponentCustomMenuOption | TabletopViewComponentButtonMenuOption;

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

interface TabletopViewComponentProps extends GtoveDispatchProp {
    width: number;
    height: number;
    fullDriveMetadata: {[key: string]: DriveMetadata};
    scenario: ScenarioType;
    tabletop: TabletopType;
    setCamera: (parameters: Partial<VirtualGamingTabletopCameraState>, animate?: number, focusMapId?: string) => void;
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    fogOfWarMode: boolean;
    endFogOfWarMode: () => void;
    snapToGrid: boolean;
    userIsGM: boolean;
    setFocusMapId: (mapId: string, panCamera?: boolean) => void;
    findPositionForNewMini: (scale: number, basePosition?: THREE.Vector3 | ObjectVector3) => MovementPathPoint;
    findUnusedMiniName: (baseName: string, suffix?: number, space?: boolean) => [string, number]
    focusMapId?: string;
    readOnly: boolean;
    playerView: boolean;
    labelSize: number;
    myPeerId: MyPeerIdReducerType;
    disableTapMenu?: boolean;
    cameraView?: TabletopViewComponentCameraView;
    replaceMapImageFn?: (metadataId: string) => void;
    dice?: DiceReducerType;
    networkHubId?: string;
    pings?: PingReducerType;
    connectedUsers?: ConnectedUserReducerType;
    sideMenuOpen?: boolean;
    paintState: PaintState;
    updatePaintState: (update: Partial<PaintState>, callback?: () => void) => void;
    disableUndoRedo?: (disable: boolean) => void;
}

interface TabletopViewComponentState {
    texture: {[key: string]: THREE.Texture | THREE.VideoTexture | null};
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    selected?: TabletopViewComponentSelected,
    dragOffset?: ObjectVector3;
    defaultDragY?: number;
    defaultDragGridType: GridType;
    menuSelected?: TabletopViewComponentMenuSelected;
    editSelected?: TabletopViewComponentEditSelected;
    repositionMapDragHandle: boolean;
    fogOfWarDragHandle: boolean;
    paintModeDragHandle: boolean;
    fogOfWarRect?: {
        mapId: string;
        startPos: THREE.Vector3;
        endPos: THREE.Vector3;
        colour: string;
        position: THREE.Vector2;
        showButtons: boolean;
    };
    autoPanInterval?: number;
    toastIds: {[message: string]: number | string};
    selectedNoteMiniId?: string;
    rteState?: EditorValue;
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

    static BACKGROUND_COLOUR = new THREE.Color(0x808080);

    static DELTA = 0.01;

    static DIR_EAST = new THREE.Vector3(1, 0, 0);
    static DIR_WEST = new THREE.Vector3(-1, 0, 0);
    static DIR_NORTH = new THREE.Vector3(0, 0, 1);
    static DIR_SOUTH = new THREE.Vector3(0, 0, -1);
    static DIR_DOWN = new THREE.Vector3(0, -1, 0);

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
    private readonly rayPoint: THREE.Vector2;
    private readonly offset: THREE.Vector3;
    private readonly plane: THREE.Plane;

    private userIsGM(): boolean {
        return this.props.userIsGM && !this.props.playerView;
    }

    private selectMapOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Focus on map',
            title: 'Focus the camera on this map.',
            onClick: (mapId: string) => {
                const map = this.props.scenario.maps[mapId];
                this.props.setCamera(getBaseCameraParameters(map), 1000, mapId);
                this.setState({menuSelected: undefined});
            },
            show: (mapId: string) => (mapId !== this.props.focusMapId)
        },
        {
            label: 'Set camera focus point',
            title: 'Set this point as the default camera focus point for this level.',
            onClick: async (mapId: string) => {
                if (this.state.menuSelected && this.state.menuSelected.selected && this.state.menuSelected.selected.point) {
                    const map = this.props.scenario.maps[mapId];
                    const mapsAtLevel = getMapIdsAtLevel(this.props.scenario.maps, map.position.y);
                    for (let levelMapId of mapsAtLevel) {
                        if (levelMapId !== mapId && this.props.scenario.maps[levelMapId].cameraFocusPoint) {
                            this.props.dispatch(updateMapCameraFocusPoint(levelMapId));
                        }
                    }
                    this.props.dispatch(updateMapCameraFocusPoint(mapId, this.state.menuSelected.selected.point.clone().sub(map.position as THREE.Vector3)));
                    await promiseSleep(1);
                    this.props.setFocusMapId(mapId);
                    this.setState({menuSelected: undefined});
                }
            },
            show: () => (this.userIsGM())
        },
        {
            label: 'Clear camera focus point',
            title: 'Clear the default camera focus point for this level.',
            onClick: (mapId: string) => {
                const map = this.props.scenario.maps[mapId];
                const mapsAtLevel = getMapIdsAtLevel(this.props.scenario.maps, map.position.y);
                for (let levelMapId of mapsAtLevel) {
                    this.props.dispatch(updateMapCameraFocusPoint(levelMapId));
                }
                this.setState({menuSelected: undefined});
            },
            show: (mapId: string) => (this.userIsGM() && getFocusMapIdAndFocusPointAtLevel(this.props.scenario.maps, this.props.scenario.maps[mapId].position.y).cameraFocusPoint !== undefined)
        },
        {
            label: 'Mute Video',
            title: 'Mute the audio track of this video texture',
            onClick: (mapId: string) => {
                const metadataId = this.props.scenario.maps[mapId].metadata.id;
                this.props.dispatch(updateTabletopVideoMutedAction(metadataId, true));
            },
            show: (mapId: string) => {
                if (!this.userIsGM()) {
                    return false;
                }
                const metadataId = this.props.scenario.maps[mapId].metadata.id;
                const texture = this.state.texture[metadataId];
                return (isVideoTexture(texture) && hasAnyAudio(texture)) ? !this.props.tabletop.videoMuted[metadataId] : false;
            }
        },
        {
            label: 'Unmute Video',
            title: 'Unmute the audio track of this video texture',
            onClick: (mapId: string) => {
                const metadataId = this.props.scenario.maps[mapId].metadata.id;
                this.props.dispatch(updateTabletopVideoMutedAction(metadataId, false));
            },
            show: (mapId: string) => {
                if (!this.userIsGM()) {
                    return false;
                }
                const metadataId = this.props.scenario.maps[mapId].metadata.id;
                const texture = this.state.texture[metadataId];
                return (isVideoTexture(texture) && hasAnyAudio(texture)) ? this.props.tabletop.videoMuted[metadataId] : false;
            }
        },
        {
            label: 'Reveal',
            title: 'Reveal this map to players',
            onClick: (mapId: string) => {this.props.dispatch(updateMapGMOnlyAction(mapId, false))},
            show: (mapId: string) => (this.userIsGM() && this.props.scenario.maps[mapId].gmOnly)
        },
        {
            label: 'Hide',
            title: 'Hide this map from players',
            onClick: (mapId: string) => {this.props.dispatch(updateMapGMOnlyAction(mapId, true))},
            show: (mapId: string) => (this.userIsGM() && !this.props.scenario.maps[mapId].gmOnly)
        },
        {
            label: 'Reposition',
            title: 'Pan, zoom (elevate) and rotate this map on the tabletop.',
            onClick: (mapId: string, selected: TabletopViewComponentSelected) => {
                this.setSelected({mapId, point: selected.point, finish: () => {
                        this.finaliseSelectedBy();
                        this.setState({repositionMapDragHandle: false, selected: undefined});
                        this.props.setFocusMapId(mapId, false);
                    }});
                this.setState({menuSelected: undefined});
            },
            show: () => (this.userIsGM())
        },
        {
            label: 'Lift map one level',
            title: 'Lift this map up to the elevation of the next level above',
            onClick: (mapId: string) => {
                const map = this.props.scenario.maps[mapId];
                const nextMapUpId = getMapIdOnNextLevel(1, this.props.scenario.maps, mapId);
                const deltaVector = new THREE.Vector3(0, nextMapUpId ? this.props.scenario.maps[nextMapUpId].position.y - map.position.y + MAP_EPSILON : NEW_MAP_DELTA_Y, 0);
                this.props.dispatch(updateMapPositionAction(mapId, deltaVector.clone().add(map.position as THREE.Vector3), null));
                this.props.setCamera({
                    cameraPosition: this.props.cameraPosition.clone().add(deltaVector),
                    cameraLookAt: this.props.cameraLookAt.clone().add(deltaVector)
                }, 1000, mapId);
            },
            show: () => (this.userIsGM())
        },
        {
            label: 'Lower map one level',
            title: 'Lower this map down to the elevation of the next level below',
            onClick: (mapId: string) => {
                const map = this.props.scenario.maps[mapId];
                const nextMapDownId = getMapIdOnNextLevel(-1, this.props.scenario.maps, mapId);
                const deltaVector = new THREE.Vector3(0, nextMapDownId ? this.props.scenario.maps[nextMapDownId].position.y - map.position.y + MAP_EPSILON : -NEW_MAP_DELTA_Y, 0);
                this.props.dispatch(updateMapPositionAction(mapId, deltaVector.clone().add(map.position as THREE.Vector3), null));
                this.props.setCamera({
                    cameraPosition: this.props.cameraPosition.clone().add(deltaVector),
                    cameraLookAt: this.props.cameraLookAt.clone().add(deltaVector)
                }, 1000, mapId);
            },
            show: () => (this.userIsGM())
        },
        {
            label: 'Uncover map',
            title: 'Uncover all Fog of War on this map.',
            onClick: async (mapId: string) => {
                if (await this.confirmLargeFogOfWarAction([mapId])) {
                    this.props.dispatch(updateMapFogOfWarAction(mapId));
                    this.setState({menuSelected: undefined});
                }
            },
            show: (mapId: string) => (this.userIsGM() && this.props.scenario.maps[mapId].metadata.properties.gridType === GridType.SQUARE)
        },
        {
            label: 'Cover map',
            title: 'Cover this map with Fog of War.',
            onClick: async (mapId: string) => {
                if (await this.confirmLargeFogOfWarAction([mapId])) {
                    this.props.dispatch(updateMapFogOfWarAction(mapId, []));
                    this.setState({menuSelected: undefined});
                }
            },
            show: (mapId: string) => (this.userIsGM() && this.props.scenario.maps[mapId].metadata.properties.gridType === GridType.SQUARE)
        },
        {
            label: 'Replace map',
            title: 'Replace this map with a different map, preserving the current Fog of War',
            onClick: this.props.replaceMapImageFn || (() => {}),
            show: () => (this.userIsGM() && this.props.replaceMapImageFn !== undefined)
        },
        {
            label: 'Remove map',
            title: 'Remove this map from the tabletop',
            onClick: async (mapId: string) => {
                const miniIdsOnMap = Object.keys(this.props.scenario.minis).filter((miniId) => (this.props.scenario.minis[miniId].onMapId === mapId));
                const hiddenMiniIdsOnMap = miniIdsOnMap.filter((miniId) => (this.props.scenario.minis[miniId].gmOnly));
                const undoGroupId = v4();
                if (miniIdsOnMap.length > 0 && this.context.promiseModal && !this.context.promiseModal.isBusy()) {
                    const removeAll = 'Remove map and its minis';
                    const removeFogged = hiddenMiniIdsOnMap.length > 0 ? 'Remove map and its hidden minis' : undefined;
                    const cancel = 'Cancel';
                    const answer = await this.context.promiseModal({
                        children: (
                            <>
                                <p>
                                    The map currently has {miniIdsOnMap.length}  piece{miniIdsOnMap.length === 1 ? '' : 's'} on it.
                                </p>
                                <p>
                                    You can remove the map and all minis on it,
                                    {
                                        hiddenMiniIdsOnMap.length === 0 ? null : ' the map and all hidden minis on it, '
                                    }
                                    or just the map (leaving the minis behind, potentially revealing any fogged minis as
                                    the Fog of War hiding them is removed).
                                </p>
                            </>
                        ),
                        options: [removeAll, removeFogged, 'Remove map only', cancel]
                    });
                    if (answer === cancel) {
                        return;
                    } else if (answer === removeAll || (removeFogged && answer === removeFogged)) {
                        const miniIds = (answer === removeAll) ? miniIdsOnMap : hiddenMiniIdsOnMap;
                        for (let miniId of miniIds) {
                            this.props.dispatch(undoGroupThunk(removeMiniAction(miniId), undoGroupId));
                        }
                    }
                }
                this.props.dispatch(undoGroupThunk(removeMapAction(mapId), undoGroupId));
            },
            show: () => (this.userIsGM())
        }
    ];

    /**
     * If this mini or any mini it is attached to has moved, return the miniId of the moved mini closest to this one.
     * @param miniId
     */
    private getMovedMiniId(miniId: string): string | undefined {
        const mini = this.props.scenario.minis[miniId];
        return (!mini.movementPath ? undefined :
            (mini.movementPath.length > 1) ? miniId :
                (mini.movementPath[0].x !== mini.position.x
                    || mini.movementPath[0].y !== mini.position.y
                    || mini.movementPath[0].z !== mini.position.z
                    || (mini.movementPath[0].elevation || 0) !== mini.elevation)
                    ? miniId : undefined)
            || (mini.attachMiniId && this.getMovedMiniId(mini.attachMiniId));
    }

    private getPieceName(miniId: string): string {
        const mini = this.props.scenario.minis[miniId];
        const suffix = (mini.attachMiniId) ? ' attached to ' + this.getPieceName(mini.attachMiniId) : '';
        const nameColumn = this.props.tabletop.piecesRosterColumns.find(isNameColumn);
        if (nameColumn && !nameColumn.showNear && nameColumn.gmOnly) {
            // Name is GM-only and not visible on tabletop - use the first visible column value instead, if present.
            const firstVisibleColumn = this.props.tabletop.piecesRosterColumns.find((column) => (column.showNear));
            if (firstVisibleColumn) {
                return getPiecesRosterDisplayValue(firstVisibleColumn, {...mini.piecesRosterValues, ...mini.piecesRosterGMValues}) + suffix;
            }
        }
        return (mini.name || (mini.metadata.name + (isTemplateMetadata(mini.metadata) ? ' template' : ' miniature'))) + suffix;
    }

    private userOwnsMini(miniId: string): boolean {
        const driveFileOwners = this.props.scenario.minis[miniId] && this.props.scenario.minis[miniId].metadata.owners;
        return this.props.userIsGM ? !this.props.playerView :
            (driveFileOwners !== undefined && driveFileOwners.reduce<boolean>((mine, owner) => (mine || owner.me), false));
    }

    private selectMiniOptions: TabletopViewComponentMenuOption[] = [
        {
            render: (miniId) => {
                const mini = this.props.scenario.minis[miniId];
                return (
                    <Tooltip tooltip='Visibility to players: Fog means hidden by Fog of War on a map.' verticalSpace={40}>
                        <label>
                            <VisibilitySlider visibility={mini.visibility} onChange={async (value) => {
                                if (await this.verifyMiniVisibility(miniId, value)) {
                                    this.props.dispatch(updateMiniVisibilityAction(miniId, value));
                                }
                            }}/>
                        </label>
                    </Tooltip>
                );
            },
            show: (miniId: string) => (this.userOwnsMini(miniId))
        },
        {
            label: 'Add GM note',
            title: 'Add a rich text GM note to this piece',
            onClick: (miniId: string) => {
                this.props.disableUndoRedo && this.props.disableUndoRedo(true);
                this.setState({selectedNoteMiniId: miniId, rteState: RichTextEditor.createValueFromString(this.props.scenario.minis[miniId].gmNoteMarkdown || '', 'markdown'), menuSelected: undefined})
            },
            show: (miniId: string) => (this.userIsGM() && miniId !== this.state.selectedNoteMiniId && !this.props.scenario.minis[miniId].gmNoteMarkdown)
        },
        {
            label: 'Open GM note',
            title: 'Show the GM note associated with this piece (closing any other GM notes)',
            onClick: (miniId: string) => {this.setState({selectedNoteMiniId: miniId, menuSelected: undefined})},
            show: (miniId: string) => (this.userIsGM() && miniId !== this.state.selectedNoteMiniId && !!this.props.scenario.minis[miniId].gmNoteMarkdown)
        },
        {
            label: 'Close GM note',
            title: 'Close the GM note associated with this piece',
            onClick: () => {this.setState({selectedNoteMiniId: undefined, menuSelected: undefined})},
            show: (miniId: string) => (this.userIsGM() && miniId === this.state.selectedNoteMiniId)
        },
        {
            label: 'Confirm move',
            title: 'Reset the piece\'s starting position to its current location',
            onClick: (miniId: string) => {
                this.props.dispatch(confirmMiniMoveAction(this.getMovedMiniId(miniId)!));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.getMovedMiniId(miniId) !== undefined)
        },
        {
            label: 'Make waypoint',
            'title': 'Make the current position a waypoint on the path',
            onClick: (miniId: string) => {
                this.props.dispatch(addMiniWaypointAction(this.getMovedMiniId(miniId)!));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.getMovedMiniId(miniId) !== undefined)
        },
        {
            label: 'Remove waypoint',
            'title': 'Remove the last waypoint added to the path',
            onClick: (miniId: string) => {
                this.props.dispatch(removeMiniWaypointAction(this.getMovedMiniId(miniId)!));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => {
                const mini = this.props.scenario.minis[miniId];
                return mini.movementPath ? mini.movementPath.length > 1 : false
            }
        },
        {
            label: 'Cancel move',
            title: 'Reset the piece\'s position back to where it started',
            onClick: (miniId: string) => {
                this.props.dispatch(cancelMiniMoveAction(this.getMovedMiniId(miniId)!));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.getMovedMiniId(miniId) !== undefined)
        },
        {
            label: 'Attach...',
            title: 'Attach this piece to another.',
            onClick: (miniId: string, selected: TabletopViewComponentSelected) => {
                const name = this.getPieceName(miniId);
                const visibility = this.props.scenario.minis[miniId].visibility;
                const buttons: TabletopViewComponentMenuOption[] = this.getOverlappingDetachedMinis(miniId).map((attachMiniId) => {
                    const attachName = this.getPieceName(attachMiniId);
                    // A piece can only attach to pieces with the same or higher visibility.
                    return (this.props.scenario.minis[attachMiniId].visibility < visibility) ? {
                        label: `(${attachName} is less visible)`,
                        title: 'You cannot attach a piece to something which is less visible.',
                        onClick: () => {this.showToastMessage('You cannot attach a piece to something which is less visible.')}
                    } : {
                        label: 'Attach to ' + attachName,
                        title: 'Attach this piece to ' + attachName,
                        onClick: () => {
                            const snapMini = this.snapMini(miniId);
                            if (!snapMini) {
                                // Mini may have been deleted mid-action
                                this.showToastMessage(`Unable to determine the position of ${name}?  Action failed.`);
                                return;
                            }
                            let {positionObj, rotationObj, elevation} = snapMini;
                            // Need to make position and rotation relative to the attachMiniId
                            const attachSnapMini = this.snapMini(attachMiniId);
                            if (!attachSnapMini) {
                                this.showToastMessage(`Unable to determine the position of ${attachName}?  Action failed.`);
                                // Mini may have been deleted mid-action
                                return;
                            }
                            const {positionObj: attachPosition, rotationObj: attachRotation, elevation: otherElevation} = attachSnapMini;
                            positionObj = buildVector3(positionObj).sub(attachPosition as THREE.Vector3).applyEuler(new THREE.Euler(-attachRotation.x, -attachRotation.y, -attachRotation.z, attachRotation.order));
                            rotationObj = {x: rotationObj.x - attachRotation.x, y: rotationObj.y - attachRotation.y, z: rotationObj.z - attachRotation.z, order: rotationObj.order};
                            this.props.dispatch(updateAttachMinisAction(miniId, attachMiniId, positionObj, rotationObj, elevation - otherElevation));
                            this.setState({menuSelected: undefined});
                        }
                    }
                });
                if (buttons.length === 1 && isTabletopViewComponentButtonMenuOption(buttons[0])) {
                    buttons[0].onClick(miniId, selected);
                } else {
                    this.setState({menuSelected: {...this.state.menuSelected!, buttons}});
                }
            },
            show: (miniId: string) => (!this.props.scenario.minis[miniId].attachMiniId && this.getOverlappingDetachedMinis(miniId).length > 0)
        },
        {
            label: 'Detach',
            title: 'Detach this piece from the piece it is attached to.',
            onClick: (miniId: string) => {
                const snapMini = this.snapMini(miniId);
                if (!snapMini) {
                    // Mini may have been deleted mid-action
                    return;
                }
                const {positionObj, rotationObj, elevation} = snapMini;
                this.props.dispatch(updateAttachMinisAction(miniId, undefined, positionObj, rotationObj, elevation));
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.props.scenario.minis[miniId].attachMiniId !== undefined)
        },
        {
            label: 'Move attachment point',
            title: 'Move this piece relative to the piece it is attached to.',
            onClick: (miniId: string, selected: TabletopViewComponentSelected) => {
                this.setSelected({miniId: miniId, ...selected});
                this.setState({menuSelected: undefined});
            },
            show: (miniId: string) => (this.props.scenario.minis[miniId].attachMiniId !== undefined)
        },
        {
            label: 'Lie down',
            title: 'Tip this piece over so it\'s lying down.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniProneAction(miniId, true))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].prone)
        },
        {
            label: 'Stand up',
            title: 'Stand this piece up.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniProneAction(miniId, false))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && this.props.scenario.minis[miniId].prone)
        },
        {
            label: 'Make flat',
            title: 'Make this piece always render as a flat counter.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniFlatAction(miniId, true))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].flat)
        },
        {
            label: 'Make standee',
            title: 'Make this piece render as a standee when not viewed from above.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniFlatAction(miniId, false))},
            show: (miniId: string) => (isMiniMetadata(this.props.scenario.minis[miniId].metadata) && this.props.scenario.minis[miniId].flat)
        },
        {
            label: 'Mute Video',
            title: 'Mute the audio track of this video texture',
            onClick: (miniId: string) => {
                const metadataId = this.props.scenario.minis[miniId].metadata.id;
                this.props.dispatch(updateTabletopVideoMutedAction(metadataId, true));
            },
            show: (miniId: string) => {
                if (!this.userIsGM()) {
                    return false;
                }
                const metadataId = this.props.scenario.minis[miniId].metadata.id;
                const texture = this.state.texture[metadataId];
                return (isVideoTexture(texture) && hasAnyAudio(texture)) ? !this.props.tabletop.videoMuted[metadataId] : false;
            }
        },
        {
            label: 'Unmute Video',
            title: 'Unmute the audio track of this video texture',
            onClick: (miniId: string) => {
                const metadataId = this.props.scenario.minis[miniId].metadata.id;
                this.props.dispatch(updateTabletopVideoMutedAction(metadataId, false));
            },
            show: (miniId: string) => {
                if (!this.userIsGM()) {
                    return false;
                }
                const metadataId = this.props.scenario.minis[miniId].metadata.id;
                const texture = this.state.texture[metadataId];
                return (isVideoTexture(texture) && hasAnyAudio(texture)) ? this.props.tabletop.videoMuted[metadataId] : false;
            }
        },
        {
            label: 'Lock position',
            title: 'Prevent movement of this piece until unlocked again.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniLockedAction(miniId, true))},
            show: (miniId: string) => (this.userOwnsMini(miniId) && !this.props.scenario.minis[miniId].attachMiniId && !this.props.scenario.minis[miniId].locked)
        },
        {
            label: 'Unlock position',
            title: 'Allow movement of this piece again.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniLockedAction(miniId, false))},
            show: (miniId: string) => (this.userOwnsMini(miniId) && !this.props.scenario.minis[miniId].attachMiniId && this.props.scenario.minis[miniId].locked)
        },
        {
            label: 'Hide base',
            title: 'Hide the base of the standee piece.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniHideBaseAction(miniId, true))},
            show: (miniId: string) => (this.userOwnsMini(miniId) && isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].hideBase)
        },
        {
            label: 'Show base',
            title: 'Show the base of the standee piece.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniHideBaseAction(miniId, false))},
            show: (miniId: string) => (this.userOwnsMini(miniId) && isMiniMetadata(this.props.scenario.minis[miniId].metadata) && this.props.scenario.minis[miniId].hideBase)
        },
        {
            label: 'Color base',
            title: 'Change the standee piece\'s base color.',
            onClick: (miniId: string) => (this.changeMiniBaseColour(miniId)),
            show: (miniId: string) => (this.userOwnsMini(miniId) && isMiniMetadata(this.props.scenario.minis[miniId].metadata) && !this.props.scenario.minis[miniId].hideBase)
        },
        {
            label: 'Rename',
            title: 'Change the label shown for this piece.',
            onClick: (miniId: string, selected: TabletopViewComponentSelected) => {
                this.setState({menuSelected: undefined, editSelected: {
                    selected: {miniId, ...selected},
                    value: this.props.scenario.minis[miniId].name,
                    finish: (value: string) => {this.props.dispatch(updateMiniNameAction(miniId, value))}
                }})
            }
        },
        {
            label: 'Scale',
            title: 'Adjust this piece\'s scale',
            onClick: (miniId: string, selected: TabletopViewComponentSelected) => {
                this.setSelected({miniId: miniId, point: selected.point, scale: true,
                    finish: () => {this.finaliseSelectedBy()}});
                this.setState({menuSelected: undefined});
                this.showToastMessage('Zoom in or out to change mini scale.');
            },
            show: (miniId: string) => (this.userOwnsMini(miniId))
        },
        {
            label: 'Duplicate...',
            title: 'Add duplicates of this piece to the tabletop.',
            onClick: (miniId: string) => {this.duplicateMini(miniId)},
            show: () => (this.userIsGM())
        },
        {
            label: 'Remove',
            title: 'Remove this piece from the tabletop',
            onClick: (miniId: string) => {this.props.dispatch(removeMiniAction(miniId))},
            show: (miniId: string) => (this.userOwnsMini(miniId))
        }
    ];

    private fogOfWarOptions: TabletopViewComponentMenuOption[] = [
        {
            label: 'Cover all maps',
            title: 'Cover all maps with Fog of War.',
            onClick: async () => {
                const mapIds = Object.keys(this.props.scenario.maps);
                if (await this.confirmLargeFogOfWarAction(mapIds)) {
                    mapIds.forEach((mapId) => {
                        this.props.dispatch(updateMapFogOfWarAction(mapId, []));
                    });
                    this.setState({menuSelected: undefined});
                }
            },
            show: () => (this.userIsGM())
        },
        {
            label: 'Uncover all maps',
            title: 'Remove Fog of War from all maps.',
            onClick: async () => {
                const mapIds = Object.keys(this.props.scenario.maps);
                if (await this.confirmLargeFogOfWarAction(mapIds)) {
                    mapIds.forEach((mapId) => {
                        this.props.dispatch(updateMapFogOfWarAction(mapId));
                    });
                    this.setState({menuSelected: undefined});
                }
            },
            show: () => (this.userIsGM())
        },
        {
            label: 'Finish',
            title: 'Exit Fog of War Mode',
            onClick: () => {this.props.endFogOfWarMode()},
            show: () => (this.userIsGM())
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
            show: () => (this.userIsGM())
        }
    ];

    constructor(props: TabletopViewComponentProps) {
        super(props);
        this.onGestureStart = this.onGestureStart.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.onTap = this.onTap.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onRotate = this.onRotate.bind(this);
        this.onPress = this.onPress.bind(this);
        this.autoPanForFogOfWarRect = this.autoPanForFogOfWarRect.bind(this);
        this.snapMap = this.snapMap.bind(this);
        this.userOwnsMini = this.userOwnsMini.bind(this);
        this.closeGMNote = this.closeGMNote.bind(this);
        this.editGMNote = this.editGMNote.bind(this);
        this.getDicePosition = memoizeOne(this.getDicePosition.bind(this));
        this.getShowNearColumns = memoizeOne(this.getShowNearColumns.bind(this));
        this.rayCaster = new THREE.Raycaster();
        this.rayPoint = new THREE.Vector2();
        this.offset = new THREE.Vector3();
        this.plane = new THREE.Plane();
        this.state = {
            texture: {},
            fogOfWarDragHandle: false,
            repositionMapDragHandle: false,
            paintModeDragHandle: false,
            toastIds: {},
            defaultDragGridType: props.tabletop.defaultGrid
        };
    }

    componentDidMount() {
        this.actOnProps(this.props);
    }

    UNSAFE_componentWillReceiveProps(props: TabletopViewComponentProps) {
        this.actOnProps(props);
    }

    componentDidUpdate(): void {
        this.updateCameraViewOffset();
    }

    selectionStillValid(data: {[key: string]: MapType | MiniType}, key?: string, props = this.props) {
        return (!key || (data[key] && (!data[key].selectedBy || data[key].selectedBy === props.myPeerId || props.userIsGM)));
    }

    selectionMissing(selection: TabletopViewComponentSelected, props = this.props) {
        return (selection.miniId && !props.scenario.minis[selection.miniId]) || (selection.mapId && !props.scenario.maps[selection.mapId]);
    }

    actOnProps(props: TabletopViewComponentProps) {
        const unusedMetadata = Object.keys(this.state.texture).reduce((all, metadataId) => {
            // Mark all metadata as unused initially.
            all[metadataId] = true;
            // Also ensure videoMuted is applied to video textures
            const texture = this.state.texture[metadataId];
            if (isVideoTexture(texture)) {
                const muted = props.tabletop.videoMuted[metadataId] || false;
                if (texture.image.paused) {
                    texture.image.play();
                } else {
                    texture.image.muted = muted;
                }
            }
            return all;
        }, {});
        this.checkMetadata<MapProperties>(props.scenario.maps, updateMapMetadataLocalAction, unusedMetadata);
        this.checkMetadata<MiniProperties>(props.scenario.minis, updateMiniMetadataLocalAction, unusedMetadata);
        // Release textures which are no longer being used
        this.disposeOfUnusedTextures(unusedMetadata);
        if (this.state.selected) {
            // If we have something selected, ensure it's still present and someone else hasn't grabbed it.
            if (!this.selectionStillValid(props.scenario.minis, this.state.selected.miniId, props)
                    || !this.selectionStillValid(props.scenario.maps, this.state.selected.mapId, props)) {
                // Don't do this via this.setSelected, because we don't want to risk calling finish()
                this.setState({selected: undefined});
            }
        }
        // For menu and edit selections, just ensure it's still present.
        if (this.state.menuSelected && this.selectionMissing(this.state.menuSelected.selected, props)) {
            this.setState({menuSelected: undefined});
        }
        // Likewise for selectedNoteMiniId
        if (this.state.selectedNoteMiniId && !props.scenario.minis[this.state.selectedNoteMiniId]) {
            this.setState({selectedNoteMiniId: undefined, rteState: undefined});
        }
        if (this.state.editSelected && this.selectionMissing(this.state.editSelected.selected, props)) {
            this.setState({editSelected: undefined});
        }
        if (!props.fogOfWarMode && (this.state.fogOfWarDragHandle || this.state.fogOfWarRect ||
                (this.state.menuSelected && this.state.menuSelected.buttons === this.fogOfWarOptions))) {
            this.setState({menuSelected: undefined, fogOfWarRect: undefined, fogOfWarDragHandle: false});
        }
        if (this.state.paintModeDragHandle && (!props.paintState.open || props.paintState.selected === PaintToolEnum.NONE)) {
            this.setState({paintModeDragHandle: false});
        }
    }

    private checkMetadata<T = AnyProperties>(object: {[key: string]: WithMetadataType<ScenarioObjectProperties>},
                                             updateTabletopObjectAction: (id: string, metadata: DriveMetadata<void, T>) => AnyAction,
                                             unusedMetadata: {[key: string]: boolean}) {
        Object.keys(object).forEach((id) => {
            let metadata = object[id].metadata;
            if (metadata) {
                unusedMetadata[metadata.id] = false;
                if (!metadata.properties) {
                    const driveMetadata = this.props.fullDriveMetadata[metadata.id] as DriveMetadata<void, T>;
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
                    } else if (driveMetadata.properties) {
                        this.props.dispatch(updateTabletopObjectAction(id, driveMetadata));
                        metadata = driveMetadata as any;
                    }
                }
                if (metadata.mimeType !== constants.MIME_TYPE_JSON && this.state.texture[metadata.id] === undefined) {
                    this.setState((prevState) => {
                        if (prevState.texture[metadata.id] === undefined) {
                            // Avoid loading the same texture multiple times.
                            this.context.textureLoader.loadTexture(metadata, (texture: THREE.Texture | THREE.VideoTexture) => {
                                this.setState({texture: {...this.state.texture, [metadata.id]: texture}});
                            });
                        }
                        return {texture: {...prevState.texture, [metadata.id]: null}}
                    });
                }
            }
        })
    }

    private disposeOfUnusedTextures(unusedMetadataIds: {[metadataId: string]: boolean}) {
        this.setState(({texture}) => {
            const toDisposeIds = Object.keys(texture).filter((metadataId) => (unusedMetadataIds[metadataId] && texture[metadataId]));
            if (toDisposeIds.length > 0) {
                const nextTexture = {...texture};
                for (let metadataId of toDisposeIds) {
                    texture[metadataId]!.dispose();
                    delete(nextTexture[metadataId]);
                }
                // Also discard the disposed-of metadata from the videoMuted list.
                this.props.dispatch(updateTabletopAction({videoMuted: omit(this.props.tabletop.videoMuted, toDisposeIds)}));
                return {texture: nextTexture};
            } else {
                return null;
            }
        });
    }

    setSelected(selected: TabletopViewComponentSelected | undefined) {
        if (selected !== this.state.selected) {
            this.state.selected && this.state.selected.finish && this.state.selected.finish();
            this.setState({selected});
        }
    }

    private addAttachedMinisWithHigherVisibility(miniId: string, visibility: PieceVisibilityEnum, miniIds: string[]) {
        for (let otherMiniId of Object.keys(this.props.scenario.minis)) {
            const otherMini = this.props.scenario.minis[otherMiniId];
            if (otherMini.attachMiniId === miniId && otherMini.visibility > visibility) {
                miniIds.push(otherMiniId);
                this.addAttachedMinisWithHigherVisibility(otherMiniId, visibility, miniIds);
            }
        }
    }

    private async verifyMiniVisibility(miniId: string, visibility: PieceVisibilityEnum) {
        const mini = this.props.scenario.minis[miniId];
        // A piece can only attach to pieces with the same or higher visibility.
        const problemMinisIds = [];
        for (let attachMiniId = mini.attachMiniId; attachMiniId; attachMiniId = attachMiniId && this.props.scenario.minis[attachMiniId].attachMiniId) {
            const attachMini = this.props.scenario.minis[attachMiniId];
            if (attachMini.visibility < visibility) {
                problemMinisIds.push(attachMiniId);
            } else {
                attachMiniId = undefined;
            }
        }
        this.addAttachedMinisWithHigherVisibility(miniId, visibility, problemMinisIds);
        if (problemMinisIds.length > 0 && this.context.promiseModal && !this.context.promiseModal.isBusy()) {
            const fixProblems = 'Change the visibility of all affected pieces';
            const visibilityString = getVisibilityString(visibility);
            const response = await this.context.promiseModal({
                children: (
                    <div>
                        <p>
                            A piece can only attach to pieces with the same or higher visibility.  Changing the
                            visibility of {mini.name} to {visibilityString} will thus cause problems for the
                            following {problemMinisIds.length === 1 ? 'piece' : 'pieces'}:
                            {joinAnd(problemMinisIds.map((miniId) => ('"' + this.props.scenario.minis[miniId].name + '"')))}
                        </p>
                        <p>
                            You can change {problemMinisIds.length === 1 ? 'that piece' : 'all those pieces'} as well
                            as {mini.name} to the new visibility level, or cancel your change.
                        </p>
                    </div>
                ),
                options: [fixProblems, 'Cancel change']
            });
            if (response === fixProblems) {
                for (let otherMiniId of problemMinisIds) {
                    this.props.dispatch(updateMiniVisibilityAction(otherMiniId, visibility));
                }
                return true;
            }
            return false;
        }
        return true;
    }

    private rayCastFromScreen(position: ObjectVector2): THREE.Intersection[] {
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
            const toTest = object;  // Avoid lint warning about object being unsafe inside a function in a loop
            let matchingField = object.userData && fields.reduce<RayCastField | null>((result, field) =>
                (result || (toTest.userData[field] && field)), null);
            if (matchingField) {
                return [object, matchingField, intersect];
            } else {
                object = object.parent;
            }
        }
        return null;
    }

    private rayCastForFirstUserDataFields(position: ObjectVector2, fields: RayCastField | RayCastField[], intersects: THREE.Intersection[] = this.rayCastFromScreen(position)): RayCastIntersect | null {
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        return intersects.reduce<RayCastIntersect | null>((selected, intersect) => {
            if (!selected) {
                const ancestor = this.findAncestorWithUserDataFields(intersect, fieldsArray);
                if (ancestor) {
                    const [object, field] = ancestor;
                    return {
                        [field]: object.userData[field],
                        point: intersect.point,
                        position: new THREE.Vector2(position.x, position.y),
                        object: intersect.object
                    };
                }
            }
            return selected;
        }, null);
    }

    private rayCastForAllUserDataFields(position: ObjectVector2, fields: RayCastField | RayCastField[], intersects: THREE.Intersection[] = this.rayCastFromScreen(position)): RayCastIntersect[] {
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        let inResult = {};
        return intersects
            .map((intersect) => {
                const ancestor = this.findAncestorWithUserDataFields(intersect, fieldsArray);
                if (ancestor) {
                    const [object, field] = ancestor;
                    return {
                        [field]: object.userData[field],
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

    async duplicateMini(miniId: string) {
        if (this.context.promiseModal && !this.context.promiseModal.isBusy()) {
            this.setState({menuSelected: undefined});
            const okOption = 'OK';
            let duplicateNumber: number = 1;
            const result = await this.context.promiseModal({
                children: (
                    <div className='duplicateMiniDialog'>
                        Duplicate this miniature
                        <InputField type='number' select={true} initialValue={duplicateNumber} onChange={(value: number) => {
                            duplicateNumber = value;
                        }}/> time(s).
                    </div>
                ),
                options: [okOption, 'Cancel']
            });
            if (result === okOption) {
                const baseMini = this.props.scenario.minis[miniId];
                const match = baseMini.name.match(/^(.*?)( *[0-9]*)$/);
                if (match) {
                    const baseName = match[1];
                    let name: string, suffix: number;
                    let space = true;
                    if (match[2]) {
                        suffix = Number(match[2]) + 1;
                        space = (match[2][0] === ' ');
                    } else {
                        // Update base mini name too, since it didn't have a numeric suffix.
                        [name, suffix] = this.props.findUnusedMiniName(baseName);
                        this.props.dispatch(updateMiniNameAction(miniId, name));
                    }
                    for (let count = 0; count < duplicateNumber; ++count) {
                        [name, suffix] = this.props.findUnusedMiniName(baseName, suffix, space);
                        let position: MovementPathPoint = this.props.findPositionForNewMini(baseMini.scale, baseMini.position);
                        if (baseMini.elevation) {
                            position = {...position, elevation: baseMini.elevation};
                        }
                        this.props.dispatch(addMiniAction({
                            ...baseMini,
                            name,
                            position,
                            movementPath: this.props.scenario.confirmMoves ? [position] : undefined
                        }));
                    }
                }
            }
        }
    }

    async changeMiniBaseColour(miniId: string) {
        if (this.context.promiseModal && !this.context.promiseModal.isBusy()) {
            this.setState({menuSelected: undefined});
            const okOption = 'OK';
            let baseColour = this.props.scenario.minis[miniId].baseColour || 0;
            let swatches: string[] | undefined = undefined;
            const result = await this.context.promiseModal({
                children: (
                    <div>
                        <p>Set base color for {this.props.scenario.minis[miniId].name}.</p>
                        <ColourPicker
                            disableAlpha={true}
                            initialColour={baseColour}
                            onColourChange={(colourObj) => {
                                baseColour = (colourObj.rgb.r << 16) + (colourObj.rgb.g << 8) + colourObj.rgb.b;
                            }}
                            initialSwatches={this.props.tabletop.baseColourSwatches}
                            onSwatchChange={(newSwatches: string[]) => {
                                swatches = newSwatches;
                            }}
                        />
                    </div>
                ),
                options: [okOption, 'Cancel']
            });
            if (result === okOption) {
                this.props.dispatch(updateMiniBaseColourAction(miniId, baseColour));
                if (swatches) {
                    this.props.dispatch(updateTabletopAction({baseColourSwatches: swatches}));
                }
            }
        }
    }

    findNextUnlockedMiniId(position: ObjectVector2, miniId: string): string | undefined {
        if (!this.props.scenario.minis[miniId].locked) {
            return miniId;
        }
        const allSelected = this.rayCastForAllUserDataFields(position, ['miniId']);
        let index = allSelected.findIndex((selected) => (selected.miniId === miniId));
        while (this.props.scenario.minis[miniId].locked) {
            // Need to raytrace through to the next mini
            index++;
            if (index >= allSelected.length) {
                return undefined;
            }
            miniId = allSelected[index].miniId!;
        }
        this.setSelected({
            miniId,
            point: allSelected[index].point,
            finish: this.state.selected!.finish,
            position: new THREE.Vector2(position.x, position.y),
            object: allSelected[index].object
        });
        const snapMini = this.snapMini(miniId);
        if (!snapMini) {
            // Mini may have been deleted mid-action
            return;
        }
        const {positionObj} = snapMini;
        this.offset.copy(positionObj as THREE.Vector3).sub(allSelected[index].point);
        const dragOffset = {...this.offset};
        this.setState({dragOffset});
        return miniId;
    }

    panMini(position: ObjectVector2, miniId: string) {
        const nextMiniId = this.findNextUnlockedMiniId(position, miniId);
        if (!nextMiniId) {
            return;
        }
        miniId = nextMiniId;
        const firstMap = this.rayCastForFirstUserDataFields(position, 'mapId');
        // If the ray intersects with a map, drag over the map (and the mini is "on" that map) - otherwise drag over starting plane.
        const dragY = (firstMap && firstMap.mapId) ? (this.props.scenario.maps[firstMap.mapId].position.y - this.state.dragOffset!.y) : this.state.defaultDragY!;
        this.plane.setComponents(0, -1, 0, dragY);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            const attachMiniId = this.props.scenario.minis[miniId].attachMiniId;
            if (attachMiniId) {
                // Need to reorient the drag position to be relative to the attachMiniId
                const snapMini = this.snapMini(attachMiniId);
                if (snapMini) {
                    const {positionObj, rotationObj} = snapMini;
                    this.offset.sub(positionObj as THREE.Vector3).applyEuler(new THREE.Euler(-rotationObj.x, -rotationObj.y, -rotationObj.z, rotationObj.order));
                }
            }
            this.props.dispatch(updateMiniPositionAction(miniId, this.offset, this.props.myPeerId, firstMap ? firstMap.mapId : getMapIdAtPoint(this.offset, this.props.scenario.maps)));
        }
    }

    panMap(position: ObjectVector2, mapId: string) {
        const dragY = this.props.scenario.maps[mapId].position.y;
        this.plane.setComponents(0, -1, 0, dragY);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.offset.add(this.state.dragOffset as THREE.Vector3);
            this.props.dispatch(updateMapPositionAction(mapId, this.offset, this.props.myPeerId));
        }
    }

    rotateMini(delta: ObjectVector2, miniId: string, currentPos?: ObjectVector2) {
        if (this.state.selected && this.state.selected.position) {
            const nextMiniId = this.findNextUnlockedMiniId(this.state.selected.position, miniId);
            if (!nextMiniId) {
                return;
            }
            miniId = nextMiniId;
        }
        let amount;
        if (currentPos) {
            const miniScreenPos = this.object3DToScreenCoords(this.state.selected!.object!);
            const quadrant14 = (currentPos.x - miniScreenPos.x > currentPos.y - miniScreenPos.y);
            const quadrant12 = (currentPos.x - miniScreenPos.x > miniScreenPos.y - currentPos.y);
            amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
        } else {
            amount = delta.x;
        }
        let rotation = buildEuler(this.props.scenario.minis[miniId].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * amount / this.props.width;
        this.props.dispatch(updateMiniRotationAction(miniId, rotation, this.props.myPeerId));
    }

    rotateMap(delta: ObjectVector2, id: string) {
        let rotation = buildEuler(this.props.scenario.maps[id].rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * delta.x / this.props.width;
        this.props.dispatch(updateMapRotationAction(id, rotation, this.props.myPeerId));
    }

    elevateMini(delta: ObjectVector2, miniId: string) {
        if (this.state.selected && this.state.selected.position) {
            const nextMiniId = this.findNextUnlockedMiniId(this.state.selected.position, miniId);
            if (!nextMiniId) {
                return;
            }
            miniId = nextMiniId;
        }
        const deltaY = -delta.y / 20;
        const mini = this.props.scenario.minis[miniId];
        const snapMini = this.snapMini(mini.attachMiniId);
        const lowerLimit = (snapMini) ? -snapMini.elevation : 0;
        if (mini.elevation < lowerLimit || mini.elevation + deltaY >= lowerLimit) {
            this.props.dispatch(updateMiniElevationAction(miniId, mini.elevation + deltaY, this.props.myPeerId));
        }
    }

    scaleMini(delta: ObjectVector2, id: string) {
        const {scale} = this.props.scenario.minis[id];
        this.props.dispatch(updateMiniScaleAction(id, Math.max(0.25, scale - delta.y / 20), this.props.myPeerId));
    }

    elevateMap(delta: ObjectVector2, mapId: string) {
        const deltaVector = {x: 0, y: -delta.y / 20, z: 0} as THREE.Vector3;
        this.offset.copy(this.props.scenario.maps[mapId].position as THREE.Vector3).add(deltaVector);
        this.props.dispatch(updateMapPositionAction(mapId, this.offset, this.props.myPeerId));
        this.props.setCamera({
            cameraLookAt: this.props.cameraLookAt.clone().add(deltaVector),
            cameraPosition: this.props.cameraPosition.clone().add(deltaVector)
        });
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
                this.props.setCamera(panCamera(delta, this.state.camera, this.props.cameraLookAt,
                    this.props.cameraPosition, this.props.width, this.props.height));
            }
        }
    }

    private showToastMessage(message: string, options?: ToastOptions) {
        if (!this.state.toastIds[message]) {
            this.setState((prevState) => (prevState.toastIds[message] ? null : {
                toastIds: {...prevState.toastIds,
                    [message]: toast(message, {
                        onClose: () => {
                            this.setState((prevState) => {
                                const toastIds = {...prevState.toastIds};
                                delete(toastIds[message]);
                                return {toastIds};
                            });
                        },
                        ...options
                    })
                }
            }))
        }
    }

    dragFogOfWarRect(position: ObjectVector2, startPos: ObjectVector2) {
        let fogOfWarRect = this.state.fogOfWarRect;
        if (!fogOfWarRect) {
            const selected = this.rayCastForFirstUserDataFields(startPos, 'mapId');
            if (selected && selected.mapId) {
                const map = this.props.scenario.maps[selected.mapId];
                if (map.metadata.properties.gridType === GridType.NONE) {
                    this.showToastMessage('Map has no grid - Fog of War for it is disabled.');
                } else if (map.metadata.properties.gridType !== GridType.SQUARE) {
                    this.showToastMessage('Fog of War not (yet) supported on hexagonal grids.');
                } else {
                    this.offset.copy(selected.point);
                    this.offset.y += TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST;
                    fogOfWarRect = {mapId: selected.mapId, startPos: this.offset.clone(), endPos: this.offset.clone(),
                        colour: map.metadata.properties.gridColour || 'black',
                        position: new THREE.Vector2(position.x, position.y), showButtons: false};
                }
            }
            if (!fogOfWarRect) {
                return;
            } else {
                this.setState({autoPanInterval: window.setInterval(this.autoPanForFogOfWarRect, 100)});
            }
        }
        const mapY = this.props.scenario.maps[fogOfWarRect.mapId].position.y;
        this.plane.setComponents(0, -1, 0, mapY + TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.setState({fogOfWarRect: {...fogOfWarRect, endPos: this.offset.clone(),
                    position: new THREE.Vector2(position.x, position.y), showButtons: false}});
        }
    }

    private async confirmLargeFogOfWarAction(mapIds: string[]): Promise<boolean> {
        const complexFogMapIds = mapIds.filter((mapId) => {
            const {fogOfWar} = this.props.scenario.maps[mapId];
            return fogOfWar && fogOfWar.reduce<boolean>((complex, bitmask) => (complex || (!!bitmask && bitmask !== -1)), false);
        });
        if (complexFogMapIds.length > 0 && this.context.promiseModal && !this.context.promiseModal.isBusy()) {
            const mapNames = complexFogMapIds.length === 1
                ? 'Map "' + this.props.scenario.maps[complexFogMapIds[0]].name + '" has'
                : 'Maps "' + joinAnd(complexFogMapIds.map((mapId) => (this.props.scenario.maps[mapId].name)), '", "', '" and "') + '" have';
            const proceed = 'Proceed';
            const response = await this.context.promiseModal({
                children: `${mapNames} detailed fog-of-war coverage.  Are you sure you want to discard it?`,
                options: [proceed, 'Cancel']
            });
            return response === proceed;
        }
        return true;
    }

    private getGridTypeOfMap(mapId?: string) {
        if (!mapId) {
            return this.props.tabletop.defaultGrid;
        } else {
            return getGridTypeOfMap(this.props.scenario.maps[mapId], this.props.tabletop.defaultGrid);
        }
    }

    private isPaintActive() {
        return (this.props.paintState.open && this.props.paintState.selected !== PaintToolEnum.NONE);
    }

    onGestureStart(gesturePosition: ObjectVector2) {
        this.setState({menuSelected: undefined});
        const fields: RayCastField[] = (this.state.selected && this.state.selected.mapId) ? ['mapId'] : ['miniId', 'mapId'];
        const selected = this.props.readOnly ? undefined : this.rayCastForFirstUserDataFields(gesturePosition, fields);
        if (this.state.selected && selected && this.state.selected.mapId === selected.mapId && this.state.selected.miniId === selected.miniId) {
            // reset dragOffset to the new offset
            const snapMini = this.snapMini(this.state.selected.miniId);
            if (!this.state.selected.mapId && !snapMini) {
                return;
            }
            const position = snapMini ? snapMini.positionObj : this.props.scenario.maps[this.state.selected.mapId!].position;
            this.offset.copy(position as THREE.Vector3).sub(selected.point);
            const defaultDragGridType = this.getGridTypeOfMap(selected.mapId);
            if (selected.mapId) {
                this.offset.setY(0);
            }
            const dragOffset = {...this.offset};
            this.setState({dragOffset, defaultDragY: selected.point.y, defaultDragGridType});
            return;
        }
        if (selected && selected.miniId) {
            selected.miniId = getRootAttachedMiniId(selected.miniId, this.props.scenario.minis);
        }
        if (selected && selected.mapId && this.isPaintActive()) {
            // The gesture start may have triggered the drag handle, but the state change may still be pending - wait on
            // state to settle before checking.
            this.setState({}, () => {
                if (!this.state.paintModeDragHandle) {
                    this.props.updatePaintState({operationId: v4(), toolPositionStart: selected.point, toolMapId: selected.mapId});
                }
            });
        } else if (selected && selected.miniId && !this.props.fogOfWarMode && this.allowSelectWithSelectedBy(this.props.scenario.minis[selected.miniId].selectedBy)) {
            const snapMini = this.snapMini(selected.miniId);
            if (!snapMini) {
                return;
            }
            this.offset.copy(snapMini.positionObj as THREE.Vector3).sub(selected.point);
            const dragOffset = {...this.offset};
            this.setSelected(selected);
            const {onMapId} = this.props.scenario.minis[selected.miniId];
            const defaultDragGridType = this.getGridTypeOfMap(onMapId);
            this.setState({dragOffset, defaultDragY: selected.point.y, defaultDragGridType});
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
        this.setState({fogOfWarDragHandle: false, fogOfWarRect, repositionMapDragHandle: false, paintModeDragHandle: false});
        this.props.updatePaintState({operationId: undefined, toolPositionStart: undefined, toolPosition: undefined, toolMapId: undefined});
    }

    private finaliseSelectedBy(selected: Partial<TabletopViewComponentSelected> | undefined = this.state.selected) {
        if (selected) {
            const actions = [];
            if (selected.mapId) {
                const map = this.props.scenario.maps[selected.mapId];
                if (map.selectedBy !== this.props.myPeerId) {
                    return;
                }
                const {positionObj, rotationObj} = this.snapMap(selected.mapId);
                if (!isEqual(rotationObj, map.rotation)) {
                    actions.push(updateMapRotationAction(selected.mapId, rotationObj, null));
                }
                if (actions.length === 0 || !isEqual(positionObj, map.position)) {
                    // Default to updating position if no others are needed, to reset selectedBy
                    actions.push(updateMapPositionAction(selected.mapId, positionObj, null));
                }
            } else if (selected.miniId) {
                const mini = this.props.scenario.minis[selected.miniId];
                if (mini.selectedBy !== this.props.myPeerId) {
                    return;
                }
                const snapMini = this.snapMini(selected.miniId);
                if (!snapMini) {
                    return;
                }
                let {positionObj, rotationObj, scaleFactor, elevation} = snapMini;
                if (mini.attachMiniId) {
                    // Need to make position, rotation and elevation relative to the attached mini
                    const attachSnapMini = this.snapMini(mini.attachMiniId);
                    if (attachSnapMini) {
                        const {positionObj: attachPosition, rotationObj: attachRotation, elevation: attachElevation} = attachSnapMini;
                        positionObj = buildVector3(positionObj).sub(attachPosition as THREE.Vector3).applyEuler(new THREE.Euler(-attachRotation.x, -attachRotation.y, -attachRotation.z, attachRotation.order));
                        rotationObj = {x: rotationObj.x - attachRotation.x, y: rotationObj.y - attachRotation.y, z: rotationObj.z - attachRotation.z, order: rotationObj.order};
                        elevation -= attachElevation;
                    }
                }
                if (!isEqual(rotationObj, mini.rotation)) {
                    actions.push(updateMiniRotationAction(selected.miniId, rotationObj, null));
                }
                if (elevation !== mini.elevation) {
                    actions.push(updateMiniElevationAction(selected.miniId, elevation, null));
                }
                if (scaleFactor !== mini.scale) {
                    actions.push(updateMiniScaleAction(selected.miniId, scaleFactor, null));
                }
                if (actions.length === 0 || !isEqual(positionObj, mini.position)) {
                    // Default to updating position if no others are needed, to reset selectedBy
                    actions.push(updateMiniPositionAction(selected.miniId, positionObj, null, mini.onMapId));
                }
            }
            actions.push(separateUndoGroupAction() as any);
            for (let action of actions) {
                this.props.dispatch(action);
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
        const snapMini = this.snapMini(miniId);
        const snapTemplate = this.snapMini(templateId);
        if (!snapMini || !snapTemplate) {
            return false;
        }
        const {positionObj: miniPosition, scaleFactor: miniScale, elevation} = snapMini;
        const {positionObj: templatePosition, elevation: templateElevation, rotationObj: templateRotation, scaleFactor: templateScale} = snapTemplate;
        const template: MiniType<TemplateProperties> = this.props.scenario.minis[templateId] as MiniType<TemplateProperties>;
        const templateProperties: TemplateProperties = castTemplateProperties(template.metadata.properties);
        const dy = templatePosition.y - miniPosition.y + templateElevation;
        const miniRadius = miniScale / 2;
        const templateWidth = templateProperties.width * templateScale;
        const templateHeight = templateProperties.height * templateScale;
        if (dy < -templateHeight / 2 - 0.5 || dy > templateHeight / 2 + TabletopMiniComponent.MINI_HEIGHT * miniScale + elevation + 0.5) {
            return false;
        }
        const adjustedPos = new THREE.Vector3(templatePosition.x - miniPosition.x, 0, templatePosition.z - miniPosition.z)
            .applyQuaternion(new THREE.Quaternion().setFromEuler(buildEuler(templateRotation)).inverse())
            .add({x: templateProperties.offsetX, y: templateProperties.offsetY, z: templateProperties.offsetZ} as THREE.Vector3);
        switch (templateProperties.templateShape) {
            case TemplateShape.RECTANGLE:
                return (Math.abs(adjustedPos.x) < miniRadius + templateWidth / 2) && (Math.abs(adjustedPos.z) < miniRadius + (templateProperties.depth * templateScale) / 2);
            case TemplateShape.CIRCLE:
            case TemplateShape.ICON:
                return adjustedPos.x*adjustedPos.x + adjustedPos.z*adjustedPos.z < (miniRadius + templateWidth) * (miniRadius + templateWidth);
            case TemplateShape.ARC:
                if (adjustedPos.x*adjustedPos.x + adjustedPos.z*adjustedPos.z >= (miniRadius + templateWidth) * (miniRadius + templateWidth)) {
                    return false;
                }
                const angle = Math.PI * (templateProperties.angle!) / 360;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const pointGreaterLine1 = -sin * adjustedPos.x + cos * adjustedPos.z + miniRadius > 0;
                const pointGreaterLine2 = sin * adjustedPos.x + cos * adjustedPos.z - miniRadius < 0;
                return ((templateProperties.angle!) < 180) ? pointGreaterLine1 && pointGreaterLine2 : pointGreaterLine1 || pointGreaterLine2;
        }
    }

    private doMinisOverlap(mini1Id: string, mini2Id: string): boolean {
        const mini1 = this.props.scenario.minis[mini1Id];
        const mini2 = this.props.scenario.minis[mini2Id];
        const mini1Template = isTemplateMetadata(mini1.metadata);
        const mini2Template = isTemplateMetadata(mini2.metadata);
        if (!mini1Template && !mini2Template) {
            const snapMini1 = this.snapMini(mini1Id);
            const snapMini2 = this.snapMini(mini2Id);
            if (!snapMini1 || !snapMini2) {
                return false;
            }
            const {positionObj: position1, scaleFactor: scale1} = snapMini1;
            const {positionObj: position2, scaleFactor: scale2} = snapMini2;
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

    onTap(position: ObjectVector2) {
        if (this.state.fogOfWarDragHandle) {
            // show fog of war menu
            this.setState({
                menuSelected: {
                    buttons: this.fogOfWarOptions,
                    selected: {position: new THREE.Vector2(position.x, position.y)},
                    label: 'Use this handle to pan the camera while in Fog of War mode.'
                }
            });
        } else if (this.state.repositionMapDragHandle) {
            // show reposition menu
            this.setState({
                menuSelected: {
                    buttons: this.repositionMapOptions,
                    selected: {position: new THREE.Vector2(position.x, position.y)},
                    label: 'Use this handle to pan the camera while repositioning the map.'
                }
            });
        } else if (this.props.fogOfWarMode) {
            const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
            if (selected && selected.mapId && this.props.scenario.maps[selected.mapId].metadata.properties.gridType === GridType.SQUARE) {
                this.changeFogOfWarBitmask(null, {mapId: selected.mapId, startPos: selected.point,
                    endPos: selected.point, position: new THREE.Vector2(position.x, position.y), colour: '', showButtons: false});
            }
        } else if (this.isPaintActive()) {
            this.props.updatePaintState({toolPosition: this.props.paintState.toolPositionStart}, () => {
                this.props.updatePaintState({operationId: undefined, toolPositionStart: undefined, toolPosition: undefined, toolMapId: undefined});
            });
        } else if (!this.props.disableTapMenu) {
            const allSelected = this.rayCastForAllUserDataFields(position, ['mapId', 'miniId']);
            if (allSelected.length > 0) {
                const selected = allSelected[0];
                const id = selected.miniId || selected.mapId;
                if (allSelected.length > 1 && !selected.mapId === !allSelected[1].mapId
                        && allSelected[0].point.clone().sub(allSelected[1].point).lengthSq() < SAME_LEVEL_MAP_DELTA_Y * SAME_LEVEL_MAP_DELTA_Y) {
                    // Click intersects with several maps or several minis which are close-ish - bring up disambiguation menu.
                    const buttons: TabletopViewComponentMenuOption[] = allSelected.filter((intersect) => (!intersect.mapId === !selected.mapId))
                        .map((intersect) => {
                            const name = intersect.mapId ? this.props.scenario.maps[intersect.mapId].name : this.getPieceName(intersect.miniId!);
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

    onPan(delta: ObjectVector2, position: ObjectVector2, startPos: ObjectVector2) {
        if (this.props.fogOfWarMode && !this.state.fogOfWarDragHandle) {
            this.dragFogOfWarRect(position, startPos);
        } else if (!this.props.readOnly && !this.state.selected && this.isPaintActive() && !this.state.paintModeDragHandle) {
            const paintTarget = this.rayCastForFirstUserDataFields(position, ['mapId']);
            if (paintTarget) {
                this.props.updatePaintState({toolPosition: paintTarget.point, toolMapId: paintTarget.mapId});
            }
        } else if (!this.state.selected || this.state.repositionMapDragHandle || this.state.paintModeDragHandle) {
            this.state.camera && this.props.setCamera(panCamera(delta, this.state.camera, this.props.cameraLookAt,
                this.props.cameraPosition, this.props.width, this.props.height));
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
            const maxDistance = getMaxCameraDistance(this.props.scenario.maps);
            this.state.camera && this.props.setCamera(zoomCamera(delta, this.props.cameraLookAt,
                this.props.cameraPosition, 2, maxDistance));
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
            this.state.camera && this.props.setCamera(rotateCamera(delta, this.state.camera, this.props.cameraLookAt,
                this.props.cameraPosition, this.props.width, this.props.height));
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
        } else if (this.state.selected.miniId && !this.state.selected.scale) {
            this.rotateMini(delta, this.state.selected.miniId, currentPos);
        } else if (this.state.selected.mapId) {
            this.rotateMap(delta, this.state.selected.mapId);
        }
    }

    onPress(position: ObjectVector2) {
        // Long-press creates a ping on the position.
        if (this.props.tabletop.gmOnlyPing && !this.props.userIsGM) {
            // unless the GM has disabled pings for players and they're a player.
            return;
        }
        let intercept: THREE.Vector3;
        let focusMapId: string | undefined;
        const pingTarget = this.rayCastForFirstUserDataFields(position, ['mapId', 'miniId']);
        if (pingTarget) {
            intercept = pingTarget.point;
            const onMapId = pingTarget.miniId ? this.props.scenario.minis[pingTarget.miniId].onMapId : undefined;
            const onMap = onMapId ? this.props.scenario.maps[onMapId] : undefined;
            focusMapId = pingTarget.mapId || (onMap ? onMapId : undefined) || this.props.focusMapId;
        } else {
            // ping the intercept with the plane of the current focus map (or 0, if none)
            const focusMapY = this.props.focusMapId && this.props.scenario.maps[this.props.focusMapId]
                ? this.props.scenario.maps[this.props.focusMapId].position.y : 0;
            this.rayCaster.setFromCamera(this.rayPoint, this.state.camera!);
            intercept = new THREE.Vector3();
            this.rayCaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -focusMapY), intercept);
            focusMapId = this.props.focusMapId;
        }
        this.props.dispatch(addPingAction(vector3ToObject(intercept), this.props.myPeerId!, focusMapId));
    }

    /**
     * Return the Y level just below the first map above the focus map, or one level above the top map if the top map
     * has the focus.  However, if we have a map selected, use that map's Y level if it's higher.
     */
    getInterestLevelY() {
        const aboveMapId = getMapIdOnNextLevel(1, this.props.scenario.maps, this.props.focusMapId, false);
        const levelAboveY = aboveMapId ? this.props.scenario.maps[aboveMapId].position.y - TabletopViewComponent.DELTA
            : this.props.focusMapId && this.props.scenario.maps[this.props.focusMapId]
                ? this.props.scenario.maps[this.props.focusMapId].position.y + NEW_MAP_DELTA_Y
                : NEW_MAP_DELTA_Y;
        if (this.state.selected && this.state.selected.mapId) {
            const selectedMapY = this.props.scenario.maps[this.state.selected.mapId].position.y;
            return Math.max(levelAboveY, selectedMapY);
        } else {
            return levelAboveY;
        }
    }

    snapMap(mapId: string) {
        const map = this.props.scenario.maps[mapId];
        return snapMap(this.props.snapToGrid && map.selectedBy !== null, castMapProperties(map.metadata.properties), map.position, map.rotation);
    }

    renderBlankGrid(grid: GridType) {
        const size = 40.02;
        let dx = 0, dy = 0;
        if (grid === GridType.HEX_HORZ || grid === GridType.HEX_VERT) {
            const {strideX, centreX, strideY, centreY} = cartesianToHexCoords(size / 2, size / 2, grid);
            dx = size / 2 - (1 - centreX) * strideX;
            dy = size / 2 - (1 - centreY) * strideY;
        }
        return (
            <Group position={TabletopMapComponent.MAP_OFFSET}>
                <TabletopGridComponent width={size} height={size} dx={dx} dy={dy} gridType={grid} colour='#444444' />
            </Group>
        );
    }

    renderMaps(interestLevelY: number) {
        const renderedMaps = Object.keys(this.props.scenario.maps)
            .filter((mapId) => (this.props.scenario.maps[mapId].position.y <= interestLevelY))
            .map((mapId) => {
                const {metadata, gmOnly, fogOfWar, selectedBy, name, paintLayers} = this.props.scenario.maps[mapId];
                return (gmOnly && this.props.playerView) ? null : (
                    <TabletopMapComponent
                        dispatch={this.props.dispatch}
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
                        paintState={this.props.paintState}
                        paintLayers={paintLayers}
                    />
                );
            });
        return renderedMaps.length > 0 ? renderedMaps : this.renderBlankGrid(this.props.tabletop.defaultGrid);
    }

    snapMini(miniId?: string) {
        if (!miniId || !this.props.scenario.minis[miniId]) {
            // Mini may have been removed while dragging.
            return undefined;
        }
        const {scale: scaleFactor, selectedBy, onMapId} = this.props.scenario.minis[miniId];
        const gridType = this.getGridTypeOfMap(onMapId);
        const absolutePosition = getAbsoluteMiniPosition(miniId, this.props.scenario.minis, this.props.snapToGrid, gridType);
        if (!absolutePosition) {
            return undefined;
        }
        const {positionObj, rotationObj, elevation} = absolutePosition;
        const snapped = snapMini(this.props.snapToGrid && !!selectedBy, gridType, scaleFactor, positionObj, elevation, rotationObj);
        if (!this.state.selected || !this.state.selected.scale) {
            // Don't actually round scaleFactor unless we're actually adjusting scale.
            snapped.scaleFactor = scaleFactor;
        }
        return snapped;
    }

    getShowNearColumns(playerView: boolean, columns: PiecesRosterColumn[]): {showMiniNames: boolean, nearColumns: PiecesRosterColumn[], simpleNearColumns: PiecesRosterColumn[]} {
        const nameColumn = columns.find(isNameColumn);
        const nearColumns = columns.filter((column) => {
            return (!playerView || !column.gmOnly) && column.showNear;
        });
        return {showMiniNames: !nameColumn || !!nameColumn.showNear, nearColumns, simpleNearColumns: nameColumn ? [nameColumn] : []};
    }

    private closeGMNote() {
        this.setState({selectedNoteMiniId: undefined});
    }

    private editGMNote() {
        if (this.state.selectedNoteMiniId) {
            const mini = this.props.scenario.minis[this.state.selectedNoteMiniId];
            if (mini) {
                const markdown = mini.gmNoteMarkdown || '';
                this.props.disableUndoRedo && this.props.disableUndoRedo(true);
                this.setState({rteState: RichTextEditor.createValueFromString(markdown, 'markdown')});
            }
        }
    }

    renderMinis(interestLevelY: number) {
        this.offset.copy(this.props.cameraLookAt).sub(this.props.cameraPosition).normalize();
        const topDown = this.offset.dot(TabletopViewComponent.DIR_DOWN) > constants.TOPDOWN_DOT_PRODUCT;
        // In top-down mode, we want to counter-rotate labels.  Find camera inverse rotation around the Y axis.
        const cameraInverseQuat = this.getInverseCameraQuaternion();
        let templateY = {};
        const {showMiniNames, nearColumns, simpleNearColumns} = this.getShowNearColumns(!this.props.userIsGM || this.props.playerView, this.props.tabletop.piecesRosterColumns);
        return Object.keys(this.props.scenario.minis)
            .map((miniId) => {
                const {metadata, gmOnly, name, selectedBy, attachMiniId, piecesRosterValues, piecesRosterGMValues,
                    piecesRosterSimple, gmNoteMarkdown} = this.props.scenario.minis[miniId];
                let {movementPath} = this.props.scenario.minis[miniId];
                const snapMini = this.snapMini(miniId);
                if (!snapMini) {
                    return null;
                }
                let {positionObj, rotationObj, scaleFactor, elevation} = snapMini;
                // Adjust templates drawing at the same Y level upwards to try to minimise Z-fighting.
                let elevationOffset = 0;
                if (isTemplateMetadata(metadata)) {
                    const y = positionObj.y + elevation + Number(metadata.properties.offsetY);
                    while (templateY[y + elevationOffset]) {
                        elevationOffset += 0.001;
                    }
                    templateY[y + elevationOffset] = true;
                }
                if (attachMiniId) {
                    const attachedSnapMini = this.snapMini(attachMiniId);
                    if (attachedSnapMini) {
                        const {positionObj: attachPositionObj, rotationObj: attachRotationObj, elevation: attachElevation} = attachedSnapMini;
                        // If mini is attached, adjust movementPath to be absolute instead of relative.
                        if (movementPath) {
                            movementPath = movementPath.map((position) => ({
                                ...this.offset.set(position.x, position.y, position.z)
                                    .applyEuler(new THREE.Euler(attachRotationObj.x, attachRotationObj.y, attachRotationObj.z, attachRotationObj.order))
                                    .add(attachPositionObj as THREE.Vector3),
                                elevation: position.elevation,
                                onMapId: position.onMapId
                            }));
                        }
                        // Also make mini base sit at the attachment point
                        positionObj = {...positionObj, y: positionObj.y + attachElevation};
                        elevation -= attachElevation;
                    }
                }
                return ((gmOnly && this.props.playerView) || positionObj.y > interestLevelY) ? null : (
                    <Fragment key={miniId}>
                        {
                            (isTemplateMetadata(metadata)) ? (
                                <TabletopTemplateComponent
                                    miniId={miniId}
                                    label={showMiniNames ? name : ''}
                                    labelSize={this.props.labelSize}
                                    metadata={metadata}
                                    positionObj={positionObj}
                                    rotationObj={rotationObj}
                                    scaleFactor={scaleFactor}
                                    elevation={elevation + elevationOffset}
                                    highlight={!selectedBy ? null : (selectedBy === this.props.myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                                    wireframe={gmOnly}
                                    movementPath={movementPath}
                                    distanceMode={this.props.tabletop.distanceMode || DistanceMode.STRAIGHT}
                                    distanceRound={this.props.tabletop.distanceRound || DistanceRound.ROUND_OFF}
                                    gridScale={this.props.tabletop.gridScale}
                                    gridUnit={this.props.tabletop.gridUnit}
                                    roundToGrid={this.props.snapToGrid || false}
                                    defaultGridType={this.props.tabletop.defaultGrid}
                                    maps={this.props.scenario.maps}
                                    piecesRosterColumns={piecesRosterSimple ? simpleNearColumns : nearColumns}
                                    piecesRosterValues={{...piecesRosterValues, ...piecesRosterGMValues}}
                                />
                            ) : (isMiniMetadata(metadata)) ? (
                                <TabletopMiniComponent
                                    label={showMiniNames ? name : ''}
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
                                    defaultGridType={this.props.tabletop.defaultGrid}
                                    maps={this.props.scenario.maps}
                                    piecesRosterColumns={piecesRosterSimple ? simpleNearColumns : nearColumns}
                                    piecesRosterValues={{...piecesRosterValues, ...piecesRosterGMValues}}
                                />
                            ) : null
                        }
                        {
                            this.state.selectedNoteMiniId !== miniId || this.state.rteState ? null : (
                                <HTML scaleFactor={10} position={buildVector3(positionObj)} className='templateNote'
                                      style={{transform: 'translate3d(-50%,0,0)'}}>
                                    <div className='material-icons menuCancel'
                                         onClick={this.closeGMNote} onTouchStart={this.closeGMNote}>close</div>
                                    <div className='material-icons menuEdit'
                                         onClick={this.editGMNote} onTouchStart={this.editGMNote}>edit</div>
                                    <ReactMarkdown source={gmNoteMarkdown || '\n'} linkTarget='_blank'/>
                                </HTML>
                            )
                        }
                    </Fragment>
                )
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

    updateCameraViewOffset() {
        const camera = this.state.camera;
        if (camera) {
            const cameraView = this.props.cameraView;
            if (cameraView) {
                camera.setViewOffset(cameraView.fullWidth, cameraView.fullHeight,
                    cameraView.offsetX, cameraView.offsetY, cameraView.width, cameraView.height);
            } else if (camera.view) {
                // Simply clearing the offset doesn't seem to reset the camera properly, so explicitly set it back to default first.
                camera.setViewOffset(this.props.width, this.props.height, 0, 0, this.props.width, this.props.height);
                camera.clearViewOffset();
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
            const [startPos, endPos] = getMapGridRoundedVectors(map, rotation, fogOfWarRect.startPos, fogOfWarRect.endPos);
            const delta = this.offset.copy(endPos).sub(startPos);
            startPos.applyEuler(rotation).add(map.position as THREE.Vector3);
            endPos.applyEuler(rotation).add(map.position as THREE.Vector3);
            const dirPlusX = (delta.x > 0 ? TabletopViewComponent.DIR_EAST : TabletopViewComponent.DIR_WEST).clone().applyEuler(rotation);
            const dirPlusZ = (delta.z > 0 ? TabletopViewComponent.DIR_NORTH : TabletopViewComponent.DIR_SOUTH).clone().applyEuler(rotation);
            return (
                <Group>
                    <ArrowHelper attach='geometry'
                                 args={[dirPlusX, startPos, Math.max(TabletopViewComponent.DELTA, Math.abs(delta.x)),
                                     getColourHex(fogOfWarRect.colour), 0.001, 0.001]}
                    />
                    <ArrowHelper attach='geometry'
                                 args={[dirPlusZ, startPos, Math.max(TabletopViewComponent.DELTA, Math.abs(delta.z)),
                                    getColourHex(fogOfWarRect.colour), 0.001, 0.001]}
                    />
                    <ArrowHelper attach='geometry'
                                 args={[dirPlusX.clone().multiplyScalar(-1), endPos, Math.max(TabletopViewComponent.DELTA, Math.abs(delta.x)),
                                     getColourHex(fogOfWarRect.colour), 0.001, 0.001]}
                    />
                    <ArrowHelper attach='geometry'
                                 args={[dirPlusZ.clone().multiplyScalar(-1), endPos, Math.max(TabletopViewComponent.DELTA, Math.abs(delta.z)),
                                     getColourHex(fogOfWarRect.colour), 0.001, 0.001]}
                    />
                </Group>
            );
        } else {
            return null;
        }
    }

    private getDicePosition(rollId: string) {
        // This is memoized so it will remember props.cameraLookAt at the instant the rollId changes.  The returning
        // of cameraPosition when rollId === '' (i.e. no roll is happening) is just to stop the linter complaining that
        // rollId is unused.
        return rollId ? this.props.cameraLookAt : this.props.cameraPosition;
    }

    renderDice() {
        const dice = this.props.dice;
        const dicePosition = this.getDicePosition(dice ? dice.rollId : '');
        const hidden = (dicePosition.y > this.getInterestLevelY());
        return !dice || !dice.rollId ? null : (
            <Group position={dicePosition}>
                <Physics gravity={[0, -20, 0]}>
                    <this.DiceRollSurface/>
                    {
                        Object.keys(dice.rolling).map((dieId) => {
                            const resultIndex = this.props.networkHubId && dice.rolling[dieId].result ? dice.rolling[dieId].result![this.props.networkHubId] : undefined;
                            return (
                                <Die key={dieId} type={dice.rolling[dieId].dieType} seed={dieId}
                                     index={dice.rolling[dieId].index}
                                     resultIndex={resultIndex}
                                     onResult={(result) => {
                                         this.props.dispatch(setDieResultAction(dieId, result))
                                     }}
                                     hidden={hidden}
                                />
                            );
                        })
                    }
                </Physics>
            </Group>
        )
    }

    renderPings() {
        const pings = this.props.pings;
        return (!pings || !this.props.connectedUsers || !this.state.camera || Object.keys(pings).length === 0) ? null : (
            <PingsComponent pings={pings} connectedUsers={this.props.connectedUsers}
                            dispatch={this.props.dispatch} camera={this.state.camera} bumpLeft={this.props.sideMenuOpen}
                            onClick={(pingId) => {
                                // Zoom camera to ping
                                const cameraLookAt = buildVector3(pings.active[pingId].position);
                                const focusMapId = pings.active[pingId].focusMapId;
                                const map = focusMapId ? this.props.scenario.maps[focusMapId] : undefined;
                                const cameraPosition = getBaseCameraParameters(map, 0.5, cameraLookAt).cameraPosition;
                                this.props.setCamera({cameraPosition, cameraLookAt}, 1000, focusMapId);
                            }}
            />
        );
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
        const buttons = buttonOptions.filter(({show}) => (!show || show(id || '')));
        const cancelMenu = () => {this.setState({menuSelected: undefined})};
        const nameColumn = this.props.tabletop.piecesRosterColumns.find(isNameColumn);
        const hideMiniNames = nameColumn && !nameColumn.showNear && nameColumn.gmOnly;
        return (buttons.length === 0) ? null : (
            <StayInsideContainer className='menu' top={selected.position!.y + 10} left={selected.position!.x + 10}>
                {
                    selected.miniId && hideMiniNames ? null : (
                        <div className='menuSelectedTitle'>{heading}</div>
                    )
                }
                <div className='menuCancel' onClick={cancelMenu} onTouchStart={cancelMenu}>&times;</div>
                <div className='scrollable'>
                    {
                        buttons.map((option, index) => (
                            <div key={'menuButton' + index}>
                                {
                                    isTabletopViewComponentButtonMenuOption(option) ? (
                                        <InputButton type='button' tooltip={option.title} onChange={() => {
                                            option.onClick(id || '', selected);
                                        }}>
                                            {option.label}
                                        </InputButton>
                                    ) : (
                                        option.render(id || '')
                                    )
                                }
                            </div>
                        ))
                    }
                </div>
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
                    <InputButton type='button' onChange={okAction}>OK</InputButton>
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
        const {startPos, endPos, fogWidth, fogHeight} = getMapFogRect(map, fogOfWarRect.startPos, fogOfWarRect.endPos);
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

    renderNoteEditor() {
        const okResponse = 'Ok';
        const name = this.state.selectedNoteMiniId ? this.getPieceName(this.state.selectedNoteMiniId) : '';
        return (
            <ModalDialog isOpen={this.state.rteState !== undefined}
                         heading={'GM Note for ' + name}
                         options={[okResponse, 'Cancel']}
                         setResult={(response: string) => {
                             this.setState(({selectedNoteMiniId, rteState}) => {
                                 if (response === okResponse && selectedNoteMiniId && rteState) {
                                     this.props.dispatch(updateMiniNoteMarkdownAction(selectedNoteMiniId, rteState.toString('markdown')));
                                 }
                                 this.props.disableUndoRedo && this.props.disableUndoRedo(false);
                                 return {rteState: undefined};
                             });
                         }}
            >
                {
                    !this.state.rteState ? null : (
                        <RichTextEditor value={this.state.rteState} onChange={(rteState) => {this.setState({rteState})}}/>
                    )
                }
            </ModalDialog>
        )
    }

    DiceRollSurface() {
        const [ref] = usePlane(() => ({mass: 0, rotation: [-Math.PI / 2, 0, 0]}));
        return (<Mesh ref={ref}/>);
    }

    render() {
        const interestLevelY = this.getInterestLevelY();
        const maxCameraDistance = getMaxCameraDistance(this.props.scenario.maps);
        return (
            <div className='canvas'>
                <GestureControls
                    onGestureStart={this.onGestureStart}
                    onGestureEnd={this.onGestureEnd}
                    onTap={this.onTap}
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onRotate={this.onRotate}
                    onPress={this.onPress}
                >
                    <Canvas
                        style={{width: this.props.width || 0, height: this.props.height || 0}}
                        invalidateFrameloop={true}
                        onCreated={({gl, camera, scene}) => {
                            gl.setClearColor(TabletopViewComponent.BACKGROUND_COLOUR);
                            gl.setClearAlpha(1);
                            this.setState({camera: camera as THREE.PerspectiveCamera, scene});
                        }}
                    >
                        <ControlledCamera position={this.props.cameraPosition} lookAt={this.props.cameraLookAt} near={0.1} far={maxCameraDistance}/>
                        <AmbientLight />
                        {this.renderMaps(interestLevelY)}
                        {this.renderMinis(interestLevelY)}
                        {this.renderFogOfWarRect()}
                        {this.renderDice()}
                        {this.renderPings()}
                    </Canvas>
                    {
                        !this.props.fogOfWarMode ? null : (
                            <div
                                className='cameraDragHandle'
                                onMouseDown={() => {this.setState({fogOfWarDragHandle: true})}}
                                onTouchStart={() => {this.setState({fogOfWarDragHandle: true})}}
                            >
                                <Tooltip tooltip='Use this handle to pan the camera without leaving Fog of War mode'>
                                    <div className='material-icons'>pan_tool</div>
                                </Tooltip>
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
                                <Tooltip tooltip='Use this handle to pan the camera while repositioning the map'>
                                    <div className='material-icons'>pan_tool</div>
                                </Tooltip>
                            </div>
                        )
                    }
                    {
                        !this.isPaintActive() ? null : (
                            <div
                                className='cameraDragHandle'
                                onMouseDown={() => {this.setState({paintModeDragHandle: true})}}
                                onTouchStart={() => {this.setState({paintModeDragHandle: true})}}
                            >
                                <Tooltip tooltip='Use this handle to pan the camera without leaving paint mode'>
                                    <div className='material-icons'>pan_tool</div>
                                </Tooltip>
                            </div>
                        )
                    }
                </GestureControls>
                {this.renderMenuSelected()}
                {this.renderEditSelected()}
                {this.renderFogOfWarButtons()}
                {this.renderNoteEditor()}
            </div>
        );
    }
}

export default withResizeDetector(TabletopViewComponent as ComponentTypeWithDefaultProps<typeof TabletopViewComponent>);