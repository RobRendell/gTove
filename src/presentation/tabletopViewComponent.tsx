import React, {Fragment, useCallback, useMemo} from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {isEqual, partition, pick, takeWhile} from 'lodash';
import {toast, ToastOptions} from 'react-toastify';
import {Physics, usePlane} from '@react-three/cannon';
import memoizeOne from 'memoize-one';
import {v4} from 'uuid';
import RichTextEditor, {EditorValue} from 'react-rte';
import {Html} from '@react-three/drei';
import ReactMarkdown from 'react-markdown';

import './tabletopViewComponent.scss';

import GestureControls from '../container/gestureControls';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {
    addMapAction,
    addMiniAction,
    addMiniWaypointAction,
    cancelMiniMoveAction,
    confirmMiniMoveAction,
    removeMapAction,
    removeMiniAction,
    removeMiniWaypointAction,
    separateUndoGroupAction,
    undoGroupActionList,
    undoGroupThunk,
    updateAttachMinisAction,
    updateMapCameraFocusPoint,
    updateMapFogOfWarAction,
    updateMapGMOnlyAction,
    updateMapPositionAction,
    updateMapRotationAction,
    updateMapTransparencyAction,
    updateMiniBaseColourAction,
    updateMiniElevationAction,
    updateMiniFlatAction,
    updateMiniHideBaseAction,
    updateMiniLockedAction,
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
import {buildEuler, buildVector3, vector3ToObject} from '../util/threeUtils';
import {
    calculateMapProperties,
    calculatePieceProperties,
    cartesianToHexCoords,
    DistanceMode,
    DistanceRound,
    getAbsoluteMiniPosition,
    getBaseCameraParameters,
    getFocusMapIdAndFocusPointAtLevel,
    getGridTypeOfMap,
    getMapGridRoundedVectors,
    getMapIdAtPoint,
    getMapIdOnNextLevel,
    getMapIdsAtLevel,
    getMaxCameraDistance,
    getPiecesRosterDisplayValue,
    getRootAttachedMiniId,
    getUpdatedMapFogRect,
    getVisibilityString,
    isFogOfWarAtPoint,
    isNameColumn,
    MAP_EPSILON,
    MapType,
    MiniType,
    MovementPathPoint,
    NEW_MAP_DELTA_Y,
    ObjectVector2,
    ObjectVector3,
    PiecesRosterColumn,
    SAME_LEVEL_MAP_DELTA_Y,
    ScenarioType,
    snapMap,
    snapMini,
    TabletopType
} from '../util/scenarioUtils';
import {SetCameraFunction} from './virtualGamingTabletop';
import {
    FileMetadata,
    FileSystemUser,
    GridType,
    PieceVisibilityEnum,
    TemplateProperties,
    TemplateShape
} from '../util/storage/storageContract';
import {FileAPIContext} from '../util/storage/storageContract';
import StayInsideContainer from '../container/stayInsideContainer';
import {TextureLoaderContext} from '../util/storage/providers/google/driveTextureLoader';
import * as constants from '../util/constants';
import {MINI_HEIGHT} from '../util/constants';
import InputField from './inputField';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import TabletopTemplateComponent from './tabletopTemplateComponent';
import InputButton from './inputButton';
import {joinAnd} from '../util/stringUtils';
import ColourPicker from './colourPicker';
import {updateTabletopAction, updateTabletopVideoMutedAction} from '../redux/tabletopReducer';
import TabletopGridComponent from './tabletopGridComponent';
import {GtoveDispatchProp} from '../redux/mainReducer';
import ControlledCamera from '../container/controlledCamera';
import Die from './dice/die';
import {addDiceAction, AddDieType, DiceReducerType, setDieResultAction} from '../redux/diceReducer';
import {addPingAction, PingReducerType} from '../redux/pingReducer';
import {ConnectedUserReducerType, updateUserRulerAction} from '../redux/connectedUserReducer';
import PingsComponent from './pingsComponent';
import {promiseSleep} from '../util/promiseSleep';
import VisibilitySlider from './visibilitySlider';
import Tooltip from './tooltip';
import {PaintState, PaintToolEnum} from './paintTools';
import ModalDialog from './modalDialog';
import TabletopPathComponent from './tabletopPathComponent';
import LabelSprite from './labelSprite';
import {isCloseTo} from '../util/mathsUtils';
import FogOfWarRectComponent from './fogOfWarRectComponent';
import ResizeDetector from 'react-resize-detector';
import {DisableGlobalKeyboardHandlerContext} from '../context/disableGlobalKeyboardHandlerContextBridge';
import CanvasContextBridge from '../context/CanvasContextBridge';
import MetadataLoaderContainer from '../container/metadataLoaderContainer';
import TextureService from '../service/textureService';
import { castMapProperties, castTemplateProperties, isMiniMetadata, isTemplateMetadata } from '../util/storage/storageUtils';

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
    return option.label !== undefined && option.title !== undefined && option.onClick;
}

type TabletopViewComponentMenuOption = TabletopViewComponentCustomMenuOption | TabletopViewComponentButtonMenuOption;

interface TabletopViewComponentSelected {
    mapId?: string;
    miniId?: string;
    dieRollId?: string;
    dieId?: string;
    multipleMiniIds?: string[];
    undoGroup?: string;
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
    fullWidth: number;
    fullHeight: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
}

interface TabletopViewComponentProps extends GtoveDispatchProp {
    fullDriveMetadata: {[key: string]: FileMetadata};
    scenario: ScenarioType;
    tabletop: TabletopType;
    setCamera: SetCameraFunction;
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    fogOfWarMode: boolean;
    endFogOfWarMode: () => void;
    measureDistanceMode: boolean;
    endMeasureDistanceMode: () => void;
    elasticBandMode: boolean;
    endElasticBandMode: () => void;
    snapToGrid: boolean;
    userIsGM: boolean;
    setFocusMapId: (mapId: string, panCamera?: boolean) => void;
    findPositionForNewMini: (allowHiddenMap: boolean, scale: number, basePosition?: THREE.Vector3 | ObjectVector3) => MovementPathPoint;
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
}

interface ElasticBandRectType {
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    colour: string;
    selectedMiniIds?: {[miniId: string]: boolean};
}

interface TabletopViewComponentState {
    width: number;
    height: number;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    selected?: TabletopViewComponentSelected,
    dragOffset?: ObjectVector3;
    defaultDragY?: number;
    defaultDragGridType: GridType;
    menuSelected?: TabletopViewComponentMenuSelected;
    editSelected?: TabletopViewComponentEditSelected;
    dragHandle: boolean;
    startedOnFog: boolean;
    fogOfWarRect?: {
        mapId: string;
        startPos: THREE.Vector3;
        endPos: THREE.Vector3;
        colour: string;
        position: THREE.Vector2;
        showButtons: boolean;
    };
    elasticBandRect?: ElasticBandRectType;
    autoPanInterval?: number;
    toastIds: {[message: string]: number | string};
    selectedNoteMiniId?: string;
    rteState?: EditorValue;
    dicePosition: {[rollId: string]: THREE.Vector3};
    diceRotation: {[rollId: string]: THREE.Euler};
}

type RayCastIntersectBase = {
    point: THREE.Vector3;
    position: THREE.Vector2;
    object: THREE.Object3D;
}

type RayCastIntersectMap = RayCastIntersectBase & {
    type: 'mapId';
    mapId: string;
}

type RayCastIntersectMini = RayCastIntersectBase & {
    type: 'miniId';
    miniId: string;
}

type RayCastIntersectDie = RayCastIntersectBase & {
    type: 'dieRollId';
    dieRollId: string;
    dieId: string;
}

type RayCastIntersect = RayCastIntersectMap | RayCastIntersectMini | RayCastIntersectDie;

type RayCastField = RayCastIntersect['type'];

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
        fileAPI: PropTypes.object,
        disableGlobalKeyboardHandler: PropTypes.func
    };

    context: TextureLoaderContext & PromiseModalContext & FileAPIContext & DisableGlobalKeyboardHandlerContext;

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
                if (this.state.menuSelected?.selected?.point) {
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
            show: (mapId: string) => (this.userIsGM() && getFocusMapIdAndFocusPointAtLevel(this.props.scenario.maps, this.props.scenario.maps[mapId]?.position.y).cameraFocusPoint !== undefined)
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
                return (this.props.tabletop.videoMuted[metadataId] === false);
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
                return (this.props.tabletop.videoMuted[metadataId] === true);
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
                        this.setState({dragHandle: false, selected: undefined});
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
            show: (mapId: string) => (this.userIsGM() && this.props.scenario.maps[mapId]?.metadata?.properties?.gridType !== GridType.NONE)
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
            show: (mapId: string) => (this.userIsGM() && this.props.scenario.maps[mapId]?.metadata?.properties?.gridType !== GridType.NONE)
        },
        {
            label: 'Enable transparent pixels',
            title: 'Respect transparent or translucent pixels in the map\'s image, and make fog of war transparent (hiding the map\'s overall shape/size).  Enabling may cause visual glitches from certain angles.',
            onClick: (mapId: string) => {
                this.props.dispatch(updateMapTransparencyAction(mapId, true));
            },
            show: (mapId: string) => (this.userIsGM() && !this.props.scenario.maps[mapId].transparent)
        },
        {
            label: 'Disable transparent pixels',
            title: 'Treat all pixels on this map as opaque.',
            onClick: (mapId: string) => {
                this.props.dispatch(updateMapTransparencyAction(mapId, false));
            },
            show: (mapId: string) => (this.userIsGM() && this.props.scenario.maps[mapId].transparent)
        },
        {
            label: 'Copy and reposition',
            title: 'Copy this map, and reposition the copy',
            onClick: (originalMapId: string, selected: TabletopViewComponentSelected) => {
                const map = this.props.scenario.maps[originalMapId];
                const mapId = v4();
                this.props.dispatch(addMapAction({...map}, mapId));
                this.setSelected({mapId, point: selected.point, finish: () => {
                        this.finaliseSelectedBy();
                        this.setState({dragHandle: false, selected: undefined});
                        this.props.setFocusMapId(mapId, false);
                    }});
                this.setState({menuSelected: undefined});
            },
            show: () => (this.userIsGM())
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
                const [hiddenMiniIdsOnMap, visibleMiniIdsOnMap] = partition(miniIdsOnMap, (miniId) => (this.props.scenario.minis[miniId].gmOnly));
                const undoGroupId = v4();
                let removeMiniIds: string[] = [];
                let remainingMiniIds: string[] = [];
                if (miniIdsOnMap.length > 0 && this.context.promiseModal?.isAvailable()) {
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
                    } else if (answer === removeAll) {
                        removeMiniIds = miniIdsOnMap;
                    } else if (removeFogged && answer === removeFogged) {
                        removeMiniIds = hiddenMiniIdsOnMap;
                        remainingMiniIds = visibleMiniIdsOnMap;
                    } else {
                        remainingMiniIds = miniIdsOnMap;
                    }
                }
                for (let miniId of removeMiniIds) {
                    this.props.dispatch(undoGroupThunk(removeMiniAction(miniId), undoGroupId));
                }
                if (remainingMiniIds.length > 0) {
                    const currentMapY = this.props.scenario.maps[mapId].position.y;
                    const nextMapDownId = getMapIdOnNextLevel(-1, this.props.scenario.maps, mapId);
                    if (nextMapDownId || currentMapY > 0) {
                        const newMapY = nextMapDownId ? this.props.scenario.maps[nextMapDownId].position.y : 0;
                        for (let miniId of remainingMiniIds) {
                            // Change the elevation of remaining minis so they're based on the next map down.
                            const mini = this.props.scenario.minis[miniId];
                            const elevation = mini.elevation + currentMapY - newMapY;
                            this.props.dispatch(undoGroupThunk(updateMiniElevationAction(miniId, elevation, null), undoGroupId));
                            this.props.dispatch(undoGroupThunk(updateMiniPositionAction(miniId, {...mini.position, y: newMapY}, null, nextMapDownId), undoGroupId));
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
            const firstVisibleColumn = this.props.tabletop.piecesRosterColumns.find((column) => (!!column.showNear));
            if (firstVisibleColumn) {
                return getPiecesRosterDisplayValue(firstVisibleColumn, {...mini.piecesRosterValues, ...mini.piecesRosterGMValues}) + suffix;
            }
        }
        return (mini.name || (mini.metadata.name + (isTemplateMetadata(mini.metadata) ? ' template' : ' miniature'))) + suffix;
    }

    private userOwnsMini(miniId: string): boolean {
        const driveFileOwners = this.props.scenario.minis[miniId] && this.props.scenario.minis[miniId].metadata.owners;
        return this.props.userIsGM ? !this.props.playerView :
            (driveFileOwners !== undefined && driveFileOwners.reduce<boolean>((acc: boolean, owner: FileSystemUser) => (!!acc || !!owner.me), false));
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
                this.context.disableGlobalKeyboardHandler(true);
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
                return (this.props.tabletop.videoMuted[metadataId] === false);
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
                return (this.props.tabletop.videoMuted[metadataId] === true);
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
            label: 'Make ungrabbable',
            title: 'Prevent this attached piece from registering gestures and mouse movement.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniLockedAction(miniId, true))},
            show: (miniId: string) => (this.userOwnsMini(miniId) && !!this.props.scenario.minis[miniId].attachMiniId && !this.props.scenario.minis[miniId].locked)
        },
        {
            label: 'Make grabbable',
            title: 'Allow this attached piece to register gestures and mouse movement again.',
            onClick: (miniId: string) => {this.props.dispatch(updateMiniLockedAction(miniId, false))},
            show: (miniId: string) => (this.userOwnsMini(miniId) && !!this.props.scenario.minis[miniId].attachMiniId && this.props.scenario.minis[miniId].locked)
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
                    finish: (value: string) => {
                        this.props.dispatch(updateMiniNameAction(miniId, value));
                    }
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
        this.onResize = this.onResize.bind(this);
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
        this.getShowNearColumns = memoizeOne(this.getShowNearColumns.bind(this));
        this.rayCaster = new THREE.Raycaster();
        this.rayPoint = new THREE.Vector2();
        this.offset = new THREE.Vector3();
        this.plane = new THREE.Plane();
        this.state = {
            width: 0,
            height: 0,
            dragHandle: false,
            startedOnFog: false,
            toastIds: {},
            defaultDragGridType: props.tabletop.defaultGrid,
            dicePosition: {},
            diceRotation: {}
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

    componentWillUnmount() {
        if (this.state.rteState) {
            this.context.disableGlobalKeyboardHandler(false);
        }
    }

    onResize(width?: number, height?: number) {
        if (width !== undefined && height !== undefined) {
            this.setState({width, height});
        }
    }
    
    selectionStillValid(data: {[key: string]: MapType | MiniType}, key?: string, props = this.props) {
        return (!key || (data[key] && (!data[key].selectedBy || data[key].selectedBy === props.myPeerId || props.userIsGM)));
    }

    selectionMissing(selection: TabletopViewComponentSelected, props = this.props) {
        return (selection.miniId && !props.scenario.minis[selection.miniId]) || (selection.mapId && !props.scenario.maps[selection.mapId]);
    }

    actOnProps(props: TabletopViewComponentProps) {
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
            this.context.disableGlobalKeyboardHandler(false);
            this.setState({selectedNoteMiniId: undefined, rteState: undefined});
        }
        if (this.state.editSelected && this.selectionMissing(this.state.editSelected.selected, props)) {
            this.setState({editSelected: undefined});
        }
        if (this.state.dragHandle && !props.fogOfWarMode && !this.isPaintActive(props) && !this.state.selected?.mapId
                && !props.measureDistanceMode && !props.elasticBandMode) {
            this.setState({dragHandle: false});
        }
        if (!props.fogOfWarMode && (this.state.fogOfWarRect || this.state.menuSelected?.buttons === this.fogOfWarOptions)) {
            this.setState({fogOfWarRect: undefined, menuSelected: undefined});
        }
        if (!props.elasticBandMode && this.state.elasticBandRect) {
            this.setState({elasticBandRect: undefined});
        }
        const dice = props.dice;
        if (dice && dice.rollIds.length > 0) {
            this.setState(({dicePosition, diceRotation}) => {
                const missingRollIds = dice.rollIds.filter((rollId) => (dicePosition[rollId] === undefined));
                if (missingRollIds.length > 0) {
                    const position = props.cameraLookAt.clone();
                    const rotation = new THREE.Euler();
                    dicePosition = {...dicePosition};
                    diceRotation = {...diceRotation};
                    for (let rollId of missingRollIds) {
                        const reRollId = dice.rolls[rollId].reRollId;
                        dicePosition[rollId] = (reRollId && dicePosition[reRollId]) || position;
                        diceRotation[rollId] = (reRollId && diceRotation[reRollId]) || rotation;
                    }
                    return {dicePosition, diceRotation};
                } else {
                    return null;
                }
            });
        }
    }

    setSelected(selected: TabletopViewComponentSelected | undefined) {
        if (selected !== this.state.selected) {
            this.state.selected?.finish && this.state.selected.finish();
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
        if (problemMinisIds.length > 0 && this.context.promiseModal?.isAvailable()) {
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
            this.rayPoint.x = 2 * position.x / this.state.width - 1;
            this.rayPoint.y = 1 - 2 * position.y / this.state.height;
            this.rayCaster.setFromCamera(this.rayPoint, this.state.camera);
            return this.rayCaster.intersectObjects(this.state.scene.children, true);
        } else {
            return [];
        }
    }

    private findAncestorWithUserDataFields(intersect: THREE.Intersection, fields: RayCastField[]): {object: THREE.Object3D, field: RayCastField} | null {
        for (let object: any = intersect.object; object && object.type !== 'LineSegments'; object = object.parent) {
            const field = object.userData && fields.find((field) => (object.userData[field]));
            if (field) {
                return {object, field};
            }
        }
        return null;
    }

    private mapIntersectionToRayCastIntersect<T extends RayCastField, U extends Extract<RayCastIntersect, {type: T}>>(
        intersection: THREE.Intersection, fieldsArray: T[], position: ObjectVector2
    ) {
        const ancestor = this.findAncestorWithUserDataFields(intersection, fieldsArray);
        if (ancestor) {
            const userData = ancestor.object.userData;
            if (userData.mapId && !this.props.fogOfWarMode) {
                const map = this.props.scenario.maps[userData.mapId];
                if (map.transparent) {
                    // A player raycast that hits Fog of War on a transparent map just passes through.
                    if ((!this.props.userIsGM || this.props.playerView) && isFogOfWarAtPoint(map, intersection.point)) {
                        return null;
                    }
                    // Likewise for a transparent pixel on the map's texture (if it has been loaded).
                    const textureResult = TextureService.getTextureSync(map.metadata);
                    if (textureResult && intersection.uv && textureResult.texture.image instanceof HTMLCanvasElement) {
                        const context = textureResult.texture.image.getContext('2d');
                        if (context) {
                            const x = Math.round(textureResult.texture.image.width * intersection.uv.x);
                            const y = Math.round(textureResult.texture.image.height * (1 - intersection.uv.y));
                            const imageData = context.getImageData(x, y, 1, 1);
                            if (imageData.data[3] === 0) {
                                return null;
                            }
                        }
                    }
                }
            }
            return {
                ...userData,
                type: ancestor.field,
                point: intersection.point,
                position,
                object: intersection.object
            } as U
        } else {
            return null;
        }
    }

    private rayCastForFirstUserDataFields<T extends RayCastField, U extends Extract<RayCastIntersect, {type: T}>>(
        position: ObjectVector2, fields: T | T[]
    ): U | null {
        const intersects = this.rayCastFromScreen(position);
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        return intersects.reduce<U | null>((selected, intersection) => (
            selected || this.mapIntersectionToRayCastIntersect(intersection, fieldsArray, position)
        ), null);
    }

    private rayCastForAllUserDataFields<T extends RayCastField, U extends Extract<RayCastIntersect, {type: T}>>(
        position: ObjectVector2, fields: T | T[]
    ): U[] {
        const intersects = this.rayCastFromScreen(position);
        const fieldsArray = Array.isArray(fields) ? fields : [fields];
        let inResult: any = {};
        return intersects
            .map((intersection) => (
                this.mapIntersectionToRayCastIntersect(intersection, fieldsArray, position)
            ))
            .filter((intersect): intersect is U => (intersect !== null))
            .filter((intersect: RayCastIntersect) => {
                let id = (intersect.type === 'dieRollId') ? intersect.dieId :
                    (intersect.type === 'mapId') ? intersect.mapId : intersect.miniId;
                if (inResult[id]) {
                    return false;
                } else {
                    inResult[id] = true;
                    return true;
                }
            });
    }

    async duplicateMini(miniId: string) {
        if (this.context.promiseModal?.isAvailable()) {
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
                        let position: MovementPathPoint = this.props.findPositionForNewMini(baseMini.visibility === PieceVisibilityEnum.HIDDEN, baseMini.scale, baseMini.position);
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
        if (this.context.promiseModal?.isAvailable()) {
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

    isMiniLocked(miniId: string): boolean {
        for (let id: string | undefined = miniId; id; id = this.props.scenario.minis[id].attachMiniId) {
            if (this.props.scenario.minis[id].locked) {
                return true;
            }
        }
        return false;
    }

    panMini(position: ObjectVector2, miniId: string, multipleMiniIds?: string[], undoGroupId?: string): boolean {
        const firstMap = this.rayCastForFirstUserDataFields(position, 'mapId');
        // If the ray intersects with a map, drag over the map (and the mini is "on" that map) - otherwise drag over starting plane.
        const dragY = (firstMap && firstMap.mapId) ? (this.props.scenario.maps[firstMap.mapId].position.y - this.state.dragOffset!.y) : this.state.defaultDragY!;
        this.plane.setComponents(0, -1, 0, dragY);
        if (!this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            return false;
        }
        this.offset.add(this.state.dragOffset as THREE.Vector3);
        const mini = this.props.scenario.minis[miniId];
        if (mini.attachMiniId) {
            // Need to reorient the drag position to be relative to the attachMiniId
            const snapMini = this.snapMini(mini.attachMiniId);
            if (snapMini) {
                const {positionObj, rotationObj} = snapMini;
                this.offset.sub(positionObj as THREE.Vector3).applyEuler(new THREE.Euler(-rotationObj.x, -rotationObj.y, -rotationObj.z, rotationObj.order));
            }
        }
        let actions = [];
        const onMapId = getMapIdAtPoint(this.offset, this.props.scenario.maps, mini.visibility === PieceVisibilityEnum.HIDDEN);
        actions.push(updateMiniPositionAction(miniId, this.offset, this.props.myPeerId, onMapId));
        if (multipleMiniIds) {
            // Also update the position of the other minis
            this.offset.sub(mini.position as THREE.Vector3);
            for (let otherMiniId of multipleMiniIds) {
                if (otherMiniId !== miniId) {
                    const otherMini = this.props.scenario.minis[otherMiniId];
                    if (otherMini) {
                        // Players might drag the elastic-banded minis into fog, losing some of them from their scenario.
                        const newPosition = buildVector3(otherMini.position).add(this.offset);
                        const newOnMapId = getMapIdAtPoint(newPosition, this.props.scenario.maps, otherMini.visibility === PieceVisibilityEnum.HIDDEN);
                        actions.push(updateMiniPositionAction(otherMiniId, newPosition, this.props.myPeerId, newOnMapId));
                    }
                }
            }
        }
        actions = undoGroupActionList(actions, undoGroupId);
        for (let action of actions) {
            this.props.dispatch(action);
        }
        return true;
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

    panDice(rollId: string, position: ObjectVector2) {
        if (this.state.dicePosition[rollId]) {
            this.plane.setComponents(0, -1, 0, this.state.defaultDragY || 0);
            this.rayCastFromScreen(position);
            if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
                this.offset.add(this.state.dragOffset as THREE.Vector3);
                this.setState(({dicePosition}) => ({dicePosition: {...dicePosition, [rollId]: this.offset.clone()}}));
            }
        }
    }

    rotateMini(delta: ObjectVector2, singleMiniId: string, startPos: ObjectVector2, currentPos: ObjectVector2, multipleMiniIds?: string[], undoGroupId?: string) {
        const quadrant14 = (currentPos.x - startPos.x > currentPos.y - startPos.y);
        const quadrant12 = (currentPos.x - startPos.x > startPos.y - currentPos.y);
        const amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
        // dragging across whole screen goes 360 degrees around
        const rotation = new THREE.Euler(0, 2 * Math.PI * amount / this.state.width, 0);
        const centre = buildVector3(this.props.scenario.minis[singleMiniId].position);
        let actions = [];
        for (let miniId of multipleMiniIds || [singleMiniId]) {
            const mini = this.props.scenario.minis[miniId];
            if (mini) {
                // Players might rotate the elastic-banded minis into fog, losing some of them from their scenario.
                const miniRotation = buildEuler(mini.rotation);
                miniRotation.y += rotation.y;
                actions.push(updateMiniRotationAction(miniId, miniRotation, this.props.myPeerId));
                if (miniId !== singleMiniId) {
                    const position = buildVector3(mini.position).sub(centre).applyEuler(rotation).add(centre);
                    actions.push(updateMiniPositionAction(miniId, position, this.props.myPeerId,
                        getMapIdAtPoint(position, this.props.scenario.maps, mini.visibility === PieceVisibilityEnum.HIDDEN)
                    ));
                }
            }
        }
        actions = undoGroupActionList(actions, undoGroupId);
        for (let action of actions) {
            this.props.dispatch(action);
        }
    }

    rotateMap(delta: ObjectVector2, mapId: string, currentPos: ObjectVector2) {
        const map = this.props.scenario.maps[mapId];
        this.raycastToMapOrPlane(currentPos, map.position.y);
        const quadrant14 = (this.offset.x - map.position.x > this.offset.z - map.position.z);
        const quadrant12 = (this.offset.x - map.position.x > map.position.z - this.offset.z);
        const amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
        let rotation = buildEuler(map.rotation);
        // dragging across whole screen goes 360 degrees around
        rotation.y += 2 * Math.PI * amount / this.state.width;
        this.props.dispatch(updateMapRotationAction(mapId, rotation, this.props.myPeerId));
    }

    rotateDice(delta: ObjectVector2, rollId: string, currentPos: ObjectVector2) {
        // Rotate around the point the gesture began
        const offset = buildVector3(this.state.dragOffset!);
        const position = this.state.dicePosition[rollId].clone().sub(offset);
        this.raycastToMapOrPlane(currentPos, position.y);
        const quadrant14 = (this.offset.x - position.x > this.offset.z - position.z);
        const quadrant12 = (this.offset.x - position.x > position.z - this.offset.z);
        const amount = (quadrant14 ? -1 : 1) * (quadrant14 !== quadrant12 ? delta.x : delta.y);
        const euler = new THREE.Euler(0, 2 * Math.PI * amount / this.state.width, 0);
        const rotation = this.state.diceRotation[rollId].clone();
        rotation.y += euler.y;
        offset.applyEuler(euler);
        position.add(offset);
        this.setState({
            dicePosition: {...this.state.dicePosition, [rollId]: position},
            diceRotation: {...this.state.diceRotation, [rollId]: rotation},
            dragOffset: {...offset}
        });
    }

    elevateMini(delta: ObjectVector2, singleMiniId: string, multipleMiniIds?: string[], undoGroupId?: string) {
        const deltaY = -delta.y / 20;
        let actions = [];
        for (let miniId of multipleMiniIds || [singleMiniId]) {
            const mini = this.props.scenario.minis[miniId];
            if (mini) {
                // Players might drag the elastic-banded minis into fog, losing some of them from their scenario.
                const snapMini = this.snapMini(mini.attachMiniId);
                const lowerLimit = (snapMini) ? -snapMini.elevation : 0;
                actions.push(updateMiniElevationAction(miniId, Math.max(lowerLimit, mini.elevation + deltaY), this.props.myPeerId));
            }
        }
        actions = undoGroupActionList(actions, undoGroupId);
        for (let action of actions) {
            this.props.dispatch(action);
        }
    }

    scaleMini(delta: ObjectVector2, id: string) {
        const {scale} = this.props.scenario.minis[id];
        // The smaller the mini's scale, the more fine-grained the adjustments
        const deltaScale = delta.y / Math.max(20, 20 / scale);
        this.props.dispatch(updateMiniScaleAction(id, Math.max(0.0625, scale - deltaScale), this.props.myPeerId));
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

    elevateDice(delta: ObjectVector2, rollId: string) {
        if (this.state.dicePosition[rollId]) {
            const deltaVector = {x: 0, y: -delta.y / 20, z: 0} as THREE.Vector3;
            this.offset.copy(this.state.dicePosition[rollId]).add(deltaVector);
            this.setState({dicePosition: {...this.state.dicePosition, [rollId]: this.offset.clone()}});
        }
    }

    autoPanForFogOfWarRect() {
        if ((!this.state.fogOfWarRect || this.state.fogOfWarRect.showButtons) && this.state.autoPanInterval) {
            clearInterval(this.state.autoPanInterval);
            this.setState({autoPanInterval: undefined});
        } else {
            let delta = {x: 0, y: 0};
            const dragBorder = Math.min(TabletopViewComponent.FOG_RECT_DRAG_BORDER, this.state.width / 10, this.state.height / 10);
            const {position} = this.state.fogOfWarRect!;
            if (position.x < dragBorder) {
                delta.x = dragBorder - position.x;
            } else if (position.x >= this.state.width - dragBorder) {
                delta.x = this.state.width - dragBorder - position.x;
            }
            if (position.y < dragBorder) {
                delta.y = dragBorder - position.y;
            } else if (position.y >= this.state.height - dragBorder) {
                delta.y = this.state.height - dragBorder - position.y;
            }
            if (this.state.camera && (delta.x || delta.y)) {
                this.props.setCamera(panCamera(delta, this.state.camera, this.props.cameraLookAt,
                    this.props.cameraPosition, this.state.width, this.state.height));
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
                if (map.metadata.properties!.gridType === GridType.NONE) {
                    this.showToastMessage('Map has no grid - Fog of War for it is disabled.');
                } else {
                    this.offset.copy(selected.point);
                    this.offset.y += TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST;
                    fogOfWarRect = {mapId: selected.mapId, startPos: this.offset.clone(), endPos: this.offset.clone(),
                        colour: map.metadata.properties!.gridColour || 'black',
                        position: new THREE.Vector2(position.x, position.y), showButtons: false};
                }
            }
            if (!fogOfWarRect) {
                return;
            } else {
                this.setState({autoPanInterval: window.setInterval(this.autoPanForFogOfWarRect, 100)});
            }
        }
        const mapY = this.props.scenario.maps[fogOfWarRect.mapId]?.position.y ?? 0;
        this.plane.setComponents(0, -1, 0, mapY + TabletopViewComponent.FOG_RECT_HEIGHT_ADJUST);
        this.rayCastFromScreen(position);
        if (this.rayCaster.ray.intersectPlane(this.plane, this.offset)) {
            this.setState({fogOfWarRect: {...fogOfWarRect, endPos: this.offset.clone(),
                    position: new THREE.Vector2(position.x, position.y), showButtons: false}});
        }
    }

    private raycastToMapOrPlane(position: ObjectVector2, planeY?: number): string | undefined {
        const intersection = this.rayCastForFirstUserDataFields(position, ['mapId']);
        if (intersection) {
            this.offset.copy(intersection.point);
            return intersection.mapId;
        }
        const focusMapY = planeY || (this.props.focusMapId && this.props.scenario.maps[this.props.focusMapId]
            ? this.props.scenario.maps[this.props.focusMapId].position.y : 0);
        this.plane.setComponents(0, -1, 0, focusMapY);
        this.rayCaster.ray.intersectPlane(this.plane, this.offset);
        return undefined;
    }

    private dragRuler(position: ObjectVector2, startPos: ObjectVector2) {
        if (this.props.myPeerId && this.props.connectedUsers) {
            let ruler = this.props.connectedUsers.users[this.props.myPeerId]?.ruler;
            const positionMapId = this.raycastToMapOrPlane(position);
            const gridType = this.getGridTypeOfMap(positionMapId);
            const snappedEnd = snapMini(this.props.snapToGrid, gridType, 1, vector3ToObject(this.offset), 0);
            if (ruler) {
                ruler = {
                    ...ruler,
                    end: {...snappedEnd.positionObj}
                }
            } else {
                this.raycastToMapOrPlane(startPos);
                const snappedStart = snapMini(this.props.snapToGrid, gridType, 1, vector3ToObject(this.offset), 0);
                ruler = {
                    start: {...snappedStart.positionObj, gridType},
                    end: {...snappedEnd.positionObj},
                    distance: '',
                    mapId: positionMapId
                }
            }
            this.props.dispatch(updateUserRulerAction(this.props.myPeerId, ruler));
        }
    }

    private betweenZeroAndLimit(value: number, limit: number, margin: number) {
        return (limit > 0) ? (value >= -margin && value <= limit + margin)
            : (value >= limit - margin && value <= margin);
    }

    private dragElasticBand(bandStartPos: ObjectVector2, position: ObjectVector2) {
        if (!this.state.camera) {
            return;
        }
        let startPos: THREE.Vector3;
        if (this.state.elasticBandRect) {
            startPos = this.state.elasticBandRect.startPos;
        } else {
            this.raycastToMapOrPlane(bandStartPos);
            startPos = this.offset.clone();
        }
        this.raycastToMapOrPlane(position);
        const endPos = this.offset.clone();
        const colour = this.state.elasticBandRect?.colour || '#ff00ff';
        const selectedMiniIds = {...this.state.elasticBandRect?.selectedMiniIds};
        const undoGroup = this.state.selected?.undoGroup || v4();
        const corner3 = new THREE.Vector3(endPos.x, startPos.y, endPos.z);
        const vectorDiagonal = corner3.clone().sub(startPos);
        const vectorRight = TabletopViewComponent.DIR_EAST.clone().applyQuaternion(this.state.camera.quaternion);
        const lengthRight = vectorDiagonal.dot(vectorRight);
        const vectorDown = new THREE.Vector3(-vectorRight.z, 0, vectorRight.x);
        const lengthDown = vectorDiagonal.dot(vectorDown);
        // We want to select/unselect minis as they enter or leave the elastic band rect, but also leave any existing
        // multipleMiniIds selections from previous elastic bands that haven't been deselected in the meantime.
        Object.keys(this.props.scenario.minis).forEach((miniId) => {
            let mini = this.props.scenario.minis[miniId];
            if (!mini.attachMiniId && !mini.locked && isCloseTo(mini.position.y, startPos.y)) {
                const margin = mini.scale / 3; // scale is a diameter, we want a radius, but a bit less.
                const miniOffsetFromStartPos = buildVector3(mini.position).sub(startPos);
                const distanceRight = miniOffsetFromStartPos.dot(vectorRight);
                const distanceDown = miniOffsetFromStartPos.dot(vectorDown);
                const inside = this.betweenZeroAndLimit(distanceRight, lengthRight, margin)
                    && this.betweenZeroAndLimit(distanceDown, lengthDown, margin);
                if (inside && !selectedMiniIds[miniId] && (mini.selectedBy === null || this.props.userIsGM)) {
                    selectedMiniIds[miniId] = true;
                    this.props.dispatch(undoGroupThunk(updateMiniPositionAction(miniId, mini.position, this.props.myPeerId, mini.onMapId), undoGroup));
                } else if (!inside && selectedMiniIds[miniId]) {
                    selectedMiniIds[miniId] = false;
                    if (mini.selectedBy === this.props.myPeerId) {
                        this.props.dispatch(undoGroupThunk(updateMiniPositionAction(miniId, mini.position, null, mini.onMapId), undoGroup));
                    }
                }
            }
        });
        const multipleMiniIds = (this.state.selected?.multipleMiniIds || [])
            .filter((miniId) => (selectedMiniIds[miniId] === undefined))
            .concat(
                Object.keys(selectedMiniIds)
                    .filter((miniId) => (selectedMiniIds[miniId]))
            );
        this.setState({
            selected: {multipleMiniIds, undoGroup, finish: () => {this.finaliseSelectedBy()}},
            elasticBandRect: {startPos, endPos, colour, selectedMiniIds}
        });
    }

    private async confirmLargeFogOfWarAction(mapIds: string[]): Promise<boolean> {
        const complexFogMapIds = mapIds.filter((mapId) => {
            const {fogOfWar} = this.props.scenario.maps[mapId] ?? {};
            return fogOfWar && fogOfWar.reduce<boolean>((complex, bitmask) => (complex || (!!bitmask && bitmask !== -1)), false);
        });
        if (complexFogMapIds.length > 0 && this.context.promiseModal?.isAvailable()) {
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

    private isPaintActive(props = this.props) {
        return (props.paintState.open && props.paintState.selected !== PaintToolEnum.NONE);
    }

    onGestureStart(gesturePosition: ObjectVector2) {
        this.setState({menuSelected: undefined});
        if (this.props.elasticBandMode) {
            return;
        }
        const fields: RayCastField[] = (this.state.selected?.mapId) ? ['mapId'] : ['miniId', 'mapId', 'dieRollId'];
        const selected = this.props.readOnly ? undefined : this.rayCastForAllUserDataFields(gesturePosition, fields)
            .find((intersection) => (
                // Ignore locked minis for the purposes of gesture starts
                intersection.type !== 'miniId' || !this.isMiniLocked(intersection.miniId)
            ));
        if (this.state.selected && selected && (
            (selected.type === 'mapId' && this.state.selected.mapId === selected.mapId)
            || (selected.type === 'miniId' && this.state.selected.miniId === selected.miniId)
            || (selected.type === 'miniId' && this.state.selected.multipleMiniIds?.find((miniId) => (miniId === selected.miniId)))
        )) {
            // reset dragOffset to the new offset
            const snapMini = selected.type === 'miniId' ? this.snapMini(selected.miniId) : undefined;
            if (!this.state.selected.mapId && !snapMini) {
                return;
            }
            const position = snapMini ? snapMini.positionObj : this.props.scenario.maps[this.state.selected.mapId!].position;
            this.offset.copy(position as THREE.Vector3).sub(selected.point);
            const defaultDragGridType = this.getGridTypeOfMap(selected.type === 'mapId' ? selected.mapId : undefined);
            if (selected.type === 'mapId') {
                this.offset.setY(0);
            }
            const dragOffset = {...this.offset};
            this.setState({dragOffset, defaultDragY: selected.point.y, defaultDragGridType});
            if (this.state.selected.multipleMiniIds && selected.type === 'miniId') {
                this.setState({selected: {...this.state.selected, miniId: selected.miniId}});
            }
            return;
        }
        if (selected?.type === 'miniId') {
            selected.miniId = getRootAttachedMiniId(selected.miniId, this.props.scenario.minis);
        }
        if (selected?.type === 'dieRollId') {
            this.setSelected(selected);
            this.offset.copy(this.state.dicePosition[selected.dieRollId]).sub(selected.point);
            this.setState({dragOffset: {...this.offset}, defaultDragY: selected.point.y});
        } else if (selected?.type === 'mapId') {
            if (this.isPaintActive()) {
                // The gesture start may have triggered the drag handle, but the state change may still be pending - wait on
                // state to settle before checking.
                this.setState({}, () => {
                    if (!this.state.dragHandle) {
                        this.props.updatePaintState({operationId: v4(), toolPositionStart: selected.point, toolMapId: selected.mapId});
                    }
                });
            }
            if (this.props.fogOfWarMode) {
                const map = this.props.scenario.maps[selected.mapId];
                const startedOnFog = isFogOfWarAtPoint(map, selected.point);
                this.setState({startedOnFog});
            }
        } else if (selected?.type === 'miniId' && !this.props.fogOfWarMode && this.allowSelectWithSelectedBy(this.props.scenario.minis[selected.miniId].selectedBy)) {
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
        if (this.props.elasticBandMode) {
            if (this.state.selected?.multipleMiniIds && this.state.selected.multipleMiniIds.length > 0 && !this.state.dragHandle) {
                this.props.endElasticBandMode();
            }
        } else if (!this.state.selected?.mapId) {
            this.setSelected(undefined);
        }
        this.setState({dragHandle: false, fogOfWarRect, elasticBandRect: undefined});
        this.props.updatePaintState({}, () => {
            this.props.updatePaintState({operationId: undefined, toolPositionStart: undefined, toolPosition: undefined, toolMapId: undefined});
        });
        if (this.props.measureDistanceMode && this.props.myPeerId) {
            this.props.dispatch(updateUserRulerAction(this.props.myPeerId));
        }
    }

    private finaliseSelectedBy() {
        const {selected} = this.state;
        if (selected) {
            let actions = [];
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
            } else if ((selected.miniId || selected.multipleMiniIds) && !this.props.elasticBandMode) {
                const multipleMiniIds = selected.multipleMiniIds || [selected.miniId!];
                for (let miniId of multipleMiniIds) {
                    const actionLength = actions.length;
                    const mini = this.props.scenario.minis[miniId];
                    if (!mini || mini.selectedBy !== this.props.myPeerId) {
                        continue;
                    }
                    const snapMini = this.snapMini(miniId);
                    if (!snapMini) {
                        continue;
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
                        actions.push(updateMiniRotationAction(miniId, rotationObj, null));
                    }
                    if (elevation !== mini.elevation) {
                        actions.push(updateMiniElevationAction(miniId, elevation, null));
                    }
                    if (scaleFactor !== mini.scale) {
                        actions.push(updateMiniScaleAction(miniId, scaleFactor, null));
                    }
                    if (actions.length === actionLength || !isEqual(positionObj, mini.position)) {
                        // Default to updating position if no others are needed, to reset selectedBy
                        actions.push(updateMiniPositionAction(miniId, positionObj, null, mini.onMapId));
                    }
                }
            }
            if (selected.undoGroup) {
                actions = undoGroupActionList(actions, selected.undoGroup);
            } else {
                actions.push(separateUndoGroupAction() as any);
            }
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
        const template: MiniType = this.props.scenario.minis[templateId] as MiniType;
        const templateProperties: TemplateProperties =
            castTemplateProperties(template.metadata.properties as TemplateProperties);
        const dy = templatePosition.y - miniPosition.y + templateElevation;
        const miniRadius = miniScale / 2;
        const templateWidth = templateProperties.width * templateScale;
        const templateHeight = templateProperties.height * templateScale;
        if (dy < -templateHeight / 2 - 0.5 || dy > templateHeight / 2 + MINI_HEIGHT * miniScale + elevation + 0.5) {
            return false;
        }
        const adjustedPos = new THREE.Vector3(templatePosition.x - miniPosition.x, 0, templatePosition.z - miniPosition.z)
            .applyQuaternion(new THREE.Quaternion().setFromEuler(buildEuler(templateRotation)).invert())
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

    private isCameraTooOblique() {
        const cameraVec = this.props.cameraPosition.clone().sub(this.props.cameraLookAt);
        return Math.abs(cameraVec.y * cameraVec.y / cameraVec.lengthSq()) < 0.04;
    }

    onTap(position: ObjectVector2) {
        if (this.state.dragHandle) {
            if (this.props.fogOfWarMode) {
                // show fog of war menu
                this.setState({
                    menuSelected: {
                        buttons: this.fogOfWarOptions,
                        selected: {position: new THREE.Vector2(position.x, position.y)},
                        label: 'Use this handle to pan the camera while in Fog of War mode.'
                    }
                });
            } else if (this.state.selected?.mapId) {
                // show reposition menu
                this.setState({
                    menuSelected: {
                        buttons: this.repositionMapOptions,
                        selected: {position: new THREE.Vector2(position.x, position.y)},
                        label: 'Use this handle to pan the camera while repositioning the map.'
                    }
                });
            } else if (this.props.measureDistanceMode) {
                this.props.endMeasureDistanceMode();
            } else if (this.props.elasticBandMode) {
                this.props.endElasticBandMode();
            }
        } else if (this.props.fogOfWarMode) {
            const selected = this.rayCastForFirstUserDataFields(position, 'mapId');
            if (selected && selected.mapId && this.props.scenario.maps[selected.mapId].metadata.properties!.gridType !== GridType.NONE) {
                this.changeFogOfWarBitmask(null, {mapId: selected.mapId, startPos: selected.point,
                    endPos: selected.point, position: new THREE.Vector2(position.x, position.y), colour: '', showButtons: false});
            }
        } else if (this.state.selected?.dieId && this.state.selected?.dieRollId && this.props.dice) {
            const rollId = this.state.selected.dieRollId;
            const dieId = this.state.selected.dieId;
            const dice = this.props.dice;
            // If the original dice roll has settled, allow whoever rolled it to re-roll.
            if (dice.rolls[rollId]?.peerId === this.props.myPeerId && dice.rolls[rollId].busy <= 0) {
                // Re-roll the clicked die, the others start with their current result.
                const diceReroll: AddDieType[] = dice.rolls[rollId].diceIds
                    .filter((id) => (id !== dieId))
                    .map((dieId) => (dice.rollingDice[dieId]))
                    .map((die) => ({...pick(die, 'dieType', 'dieColour', 'textColour'), fixedResult: die.definitiveResult || die.result}));
                diceReroll.push({
                    ...pick(dice.rollingDice[dieId], 'dieType', 'dieColour', 'textColour'),
                    initialPosition: dice.rollingDice[dieId].result?.position,
                    initialRotation: dice.rollingDice[dieId].result?.rotation
                });
                const reRollAction = addDiceAction(diceReroll, this.props.myPeerId, dice.rolls[rollId].name, rollId);
                this.props.dispatch(reRollAction);
            }
        } else if (this.isPaintActive()) {
            this.props.updatePaintState({toolPosition: this.props.paintState.toolPositionStart});
        } else if (!this.props.disableTapMenu) {
            const allSelected = this.rayCastForAllUserDataFields(position, ['mapId', 'miniId']);
            if (allSelected.length > 0) {
                const selected = allSelected[0];
                // Get all intersected minis before the first map, or all maps that are close-ish to the first
                const sameType = takeWhile(allSelected, (intersect) => (
                    (selected.type === intersect.type &&
                        (selected.type === 'miniId' || selected.point.clone().sub(intersect.point).lengthSq() < SAME_LEVEL_MAP_DELTA_Y * SAME_LEVEL_MAP_DELTA_Y))
                ));
                if (sameType.length > 1) {
                    // Click intersects with several maps or several minis
                    const buttons: TabletopViewComponentMenuOption[] = sameType
                        .map((intersect) => {
                            const name = intersect.type === 'mapId' ? this.props.scenario.maps[intersect.mapId].name : this.getPieceName(intersect.miniId);
                            return {
                                label: name,
                                title: 'Select ' + name,
                                onClick: () => {
                                    const buttons = ((intersect.type === 'miniId') ? this.selectMiniOptions : this.selectMapOptions);
                                    const id = intersect.type === 'mapId' ? intersect.mapId : intersect.miniId;
                                    this.setState({menuSelected: {buttons, selected: intersect, id}});
                                }
                            }
                        });
                    this.setState({menuSelected: {buttons, selected, label: 'Which do you want to select?'}});
                } else {
                    const buttons = ((selected.type === 'miniId') ? this.selectMiniOptions : this.selectMapOptions);
                    const id = selected.type === 'mapId' ? selected.mapId : selected.miniId;
                    this.setState({editSelected: undefined, menuSelected: {buttons, selected, id}});
                }
            }
            this.setSelected(undefined);
        }
    }

    onPan(delta: ObjectVector2, position: ObjectVector2, startPos: ObjectVector2) {
        let shouldPanCamera = false;
        if (!this.props.readOnly && !this.state.dragHandle && this.props.fogOfWarMode) {
            this.dragFogOfWarRect(position, startPos);
        } else if (!this.props.readOnly && !this.state.dragHandle && !this.state.selected && this.isPaintActive()) {
            const paintTarget = this.rayCastForFirstUserDataFields(position, ['mapId']);
            if (paintTarget) {
                this.props.updatePaintState({toolPosition: paintTarget.point, toolMapId: paintTarget.mapId});
            } else {
                shouldPanCamera = true;
            }
        } else if (!this.state.dragHandle && this.props.measureDistanceMode) {
            this.dragRuler(position, startPos);
        } else if (!this.props.readOnly && !this.state.dragHandle && this.props.elasticBandMode) {
            this.dragElasticBand(startPos, position);
        } else if (!this.state.selected || this.state.dragHandle) {
            shouldPanCamera = true;
        } else if (this.state.selected.dieRollId) {
            this.panDice(this.state.selected.dieRollId, position);
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
            shouldPanCamera = true;
        } else if (this.state.selected.miniId && !this.state.selected.scale) {
            if (this.isCameraTooOblique()) {
                this.showToastMessage('Your view is too oblique to safely move pieces.  Rotate your view to look down from further above the map.');
            } else if (!this.panMini(position, this.state.selected.miniId, this.state.selected.multipleMiniIds, this.state.selected.undoGroup)) {
                shouldPanCamera = true;
            }
        } else if (this.state.selected.mapId) {
            this.panMap(position, this.state.selected.mapId);
        } else {
            shouldPanCamera = true;
        }
        if (shouldPanCamera) {
            this.state.camera && this.props.setCamera(panCamera(delta, this.state.camera, this.props.cameraLookAt,
                this.props.cameraPosition, this.state.width, this.state.height));
        }
    }

    onZoom(delta: ObjectVector2) {
        let shouldZoomCamera = false;
        if (!this.state.selected) {
            shouldZoomCamera = true;
        } else if (this.state.selected.dieRollId) {
            this.elevateDice(delta, this.state.selected.dieRollId);
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
            shouldZoomCamera = true;
        } else if (this.state.selected.miniId) {
            if (this.state.selected.scale) {
                this.scaleMini(delta, this.state.selected.miniId);
            } else {
                this.elevateMini(delta, this.state.selected.miniId, this.state.selected.multipleMiniIds, this.state.selected.undoGroup);
            }
        } else if (this.state.selected.mapId) {
            this.elevateMap(delta, this.state.selected.mapId);
        } else {
            shouldZoomCamera = true;
        }
        if (shouldZoomCamera) {
            const maxDistance = getMaxCameraDistance(this.props.scenario.maps);
            this.state.camera && this.props.setCamera(zoomCamera(delta, this.props.cameraLookAt,
                this.props.cameraPosition, 2, maxDistance));
        }
    }

    onRotate(delta: ObjectVector2, currentPos: ObjectVector2, startPos: ObjectVector2) {
        let shouldRotateCamera = false;
        if (!this.props.readOnly && !this.state.dragHandle && this.props.fogOfWarMode) {
            const selected = this.rayCastForFirstUserDataFields(currentPos, 'mapId');
            if (selected) {
                this.changeFogOfWarBitmask(this.state.startedOnFog, {mapId: selected.mapId, startPos: selected.point,
                    endPos: selected.point, position: new THREE.Vector2(currentPos.x, currentPos.y), colour: '', showButtons: false});
            }
        } else if (!this.state.selected) {
            shouldRotateCamera = true;
        } else if (this.state.selected.dieRollId) {
            this.rotateDice(delta, this.state.selected.dieRollId, currentPos);
        } else if (this.props.readOnly) {
            // not allowed to do the below actions in read-only mode
            shouldRotateCamera = true;
        } else if (this.state.selected.miniId && !this.state.selected.scale) {
            this.rotateMini(delta, this.state.selected.miniId, startPos, currentPos, this.state.selected.multipleMiniIds, this.state.selected.undoGroup);
        } else if (this.state.selected.mapId) {
            this.rotateMap(delta, this.state.selected.mapId, currentPos);
        } else {
            shouldRotateCamera = true;
        }
        if (shouldRotateCamera) {
            this.state.camera && this.props.setCamera(rotateCamera(delta, this.state.camera, this.props.cameraLookAt,
                this.props.cameraPosition, this.state.width, this.state.height));
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
            const onMapId = pingTarget.type === 'miniId' ? this.props.scenario.minis[pingTarget.miniId].onMapId : undefined;
            const onMap = onMapId ? this.props.scenario.maps[onMapId] : undefined;
            focusMapId = (pingTarget.type === 'mapId') ? pingTarget.mapId : (onMap ? onMapId : undefined) || this.props.focusMapId;
        } else {
            // ping the intercept with the plane of the current focus map (or 0, if none)
            const focusMapY = this.props.focusMapId && this.props.scenario.maps[this.props.focusMapId]
                ? this.props.scenario.maps[this.props.focusMapId].position.y : 0;
            intercept = new THREE.Vector3();
            this.plane.setComponents(0, -1, 0, focusMapY);
            this.rayCaster.ray.intersectPlane(this.plane, intercept);
            focusMapId = this.props.focusMapId;
        }
        this.props.dispatch(addPingAction(vector3ToObject(intercept), this.props.myPeerId!, focusMapId));
    }

    /**
     * If cameraLookingDown is true, return the Y level just below the first map above the focus map, or one level above
     * the top map if the top map has the focus.  However, if we have a map selected, use that map's Y level if it's
     * higher.
     * If cameraLookingDown is false, reverse the above tests (above/higher instead of below/lower and vice versa,
     * bottom map instead of top etc.)
     */
    getInterestLevelY(cameraLookingDown: boolean) {
        const nextMapId = getMapIdOnNextLevel(cameraLookingDown ? 1 : -1, this.props.scenario.maps, this.props.focusMapId, false);
        const delta = cameraLookingDown ? TabletopViewComponent.DELTA : -TabletopViewComponent.DELTA;
        const offset = cameraLookingDown ? NEW_MAP_DELTA_Y : -NEW_MAP_DELTA_Y;
        const levelBeyondY = nextMapId ? this.props.scenario.maps[nextMapId].position.y - delta
            : this.props.focusMapId && this.props.scenario.maps[this.props.focusMapId]
                ? this.props.scenario.maps[this.props.focusMapId].position.y + offset
                : offset;
        if (this.state.selected && this.state.selected.mapId) {
            const selectedMapY = this.props.scenario.maps[this.state.selected.mapId].position.y;
            return cameraLookingDown ? Math.max(levelBeyondY, selectedMapY) : Math.min(levelBeyondY, selectedMapY);
        } else {
            return levelBeyondY;
        }
    }

    /**
     * Return the distance below (or above, if camera is looking up) a repositioning map that its drop shadow should
     * appear.
     * @param mapId The ID of the map being repositioned.
     * @param cameraLookingDown Indicates if the camera is above the map looking down (true), or below looking up
     */
    getDropShadowDistance(mapId: string, cameraLookingDown: boolean): number | undefined {
        let shadowY: number | undefined = undefined;
        const map = this.props.scenario.maps[mapId];
        const properties = castMapProperties(map.metadata?.properties);
        const {positionObj} = this.snapMap(mapId);
        const west = positionObj.x - properties.width / 2;
        const east = positionObj.x + properties.width / 2;
        const north = positionObj.z - properties.height / 2;
        const south = positionObj.z + properties.height / 2;
        for (let otherMapId of Object.keys(this.props.scenario.maps)) {
            if (otherMapId === mapId) {
                continue;
            }
            const otherMap = this.props.scenario.maps[otherMapId];
            if ((cameraLookingDown && otherMap.position.y < positionObj.y && (shadowY === undefined || otherMap.position.y > shadowY))
                || (!cameraLookingDown && otherMap.position.y > positionObj.y && (shadowY === undefined || otherMap.position.y < shadowY))
            ) {
                const otherProperties = castMapProperties(otherMap.metadata?.properties);
                if (otherMap.position.x + otherProperties.width / 2 >= west
                    && otherMap.position.x - otherProperties.width / 2 <= east
                    && otherMap.position.z + otherProperties.height / 2 >= north
                    && otherMap.position.z - otherProperties.height / 2 <= south) {
                    shadowY = otherMap.position.y;
                }
            }
        }
        return (shadowY === undefined) ? undefined : (positionObj.y - shadowY);
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
            <group position={TabletopMapComponent.MAP_OFFSET_DOWN}>
                <TabletopGridComponent width={size} height={size} dx={dx} dy={dy} gridType={grid} colour='#444444' renderOrder={0} />
            </group>
        );
    }

    renderMaps(interestLevelY: number, cameraLookingDown: boolean) {
        const renderedMaps = Object.keys(this.props.scenario.maps)
            .filter((mapId) => (cameraLookingDown
                ? this.props.scenario.maps[mapId].position.y <= interestLevelY
                : this.props.scenario.maps[mapId].position.y >= interestLevelY
            ))
            .map((mapId) => {
                const {metadata, gmOnly, fogOfWar, selectedBy, name, paintLayers, transparent} = this.props.scenario.maps[mapId];
                const dropShadowDistance = (this.state.selected?.mapId === mapId) ? this.getDropShadowDistance(mapId, cameraLookingDown) : undefined;
                return (gmOnly && this.props.playerView) ? null :
                    (metadata.properties) ? (
                        <TabletopMapComponent
                            dispatch={this.props.dispatch}
                            key={mapId}
                            name={name}
                            mapId={mapId}
                            metadata={metadata}
                            snapMap={this.snapMap}
                            fogBitmap={fogOfWar}
                            gmView={this.props.userIsGM && !this.props.playerView}
                            highlight={!selectedBy ? null : (selectedBy === this.props.myPeerId ? TabletopViewComponent.HIGHLIGHT_COLOUR_ME : TabletopViewComponent.HIGHLIGHT_COLOUR_OTHER)}
                            opacity={gmOnly ? 0.5 : 1.0}
                            paintState={this.props.paintState}
                            paintLayers={paintLayers}
                            transparent={transparent}
                            dropShadowDistance={dropShadowDistance}
                            cameraLookingDown={cameraLookingDown}
                        />
                    ) : (
                        <MetadataLoaderContainer key={'loader-' + mapId} tabletopId={mapId}
                                                 metadata={metadata}
                                                 calculateProperties={calculateMapProperties}
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
                this.context.disableGlobalKeyboardHandler(true);
                this.setState({rteState: RichTextEditor.createValueFromString(markdown, 'markdown')});
            }
        }
    }

    renderMinis(interestLevelY: number, cameraLookingDown: boolean) {
        this.offset.copy(this.props.cameraLookAt).sub(this.props.cameraPosition).normalize();
        const topDown = this.offset.dot(TabletopViewComponent.DIR_DOWN) > constants.TOPDOWN_DOT_PRODUCT;
        // In top-down mode, we want to counter-rotate labels.  Find camera inverse rotation around the Y axis.
        const cameraInverseQuat = this.getInverseCameraQuaternion();
        let templateY = {};
        const {showMiniNames, nearColumns, simpleNearColumns} = this.getShowNearColumns(!this.props.userIsGM || this.props.playerView, this.props.tabletop.piecesRosterColumns);
        return Object.keys(this.props.scenario.minis)
            .map((miniId) => {
                const {metadata, gmOnly, name, selectedBy, attachMiniId, piecesRosterValues, piecesRosterGMValues,
                    piecesRosterSimple, gmNoteMarkdown, onMapId} = this.props.scenario.minis[miniId];
                let {movementPath} = this.props.scenario.minis[miniId];
                const snapMini = this.snapMini(miniId);
                if (!snapMini) {
                    return null;
                }
                let {positionObj, rotationObj, scaleFactor, elevation} = snapMini;
                // Adjust templates drawing at the same Y level upwards to try to minimise Z-fighting.
                let elevationOffset = 0;
                if (isTemplateMetadata(metadata)) {
                    const y = positionObj.y + elevation + Number(metadata.properties!.offsetY);
                    while ((templateY as any)[y + elevationOffset]) {
                        elevationOffset += 0.001;
                    }
                    (templateY as any)[y + elevationOffset] = true;
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
                const onMapProperties = !onMapId ? undefined : this.props.scenario.maps[onMapId]?.metadata.properties;
                return ((gmOnly && this.props.playerView) || (cameraLookingDown ? positionObj.y > interestLevelY : positionObj.y < interestLevelY)) ? null : (
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
                                    distanceMode={onMapProperties?.distanceMode ?? this.props.tabletop.distanceMode ?? DistanceMode.STRAIGHT}
                                    distanceRound={onMapProperties?.distanceRound ?? this.props.tabletop.distanceRound ?? DistanceRound.ROUND_OFF}
                                    gridScale={onMapProperties?.gridScale ?? this.props.tabletop.gridScale}
                                    gridUnit={onMapProperties?.gridUnit ?? this.props.tabletop.gridUnit}
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
                                    distanceMode={onMapProperties?.distanceMode ?? this.props.tabletop.distanceMode ?? DistanceMode.STRAIGHT}
                                    distanceRound={onMapProperties?.distanceRound ?? this.props.tabletop.distanceRound ?? DistanceRound.ROUND_OFF}
                                    gridScale={onMapProperties?.gridScale ?? this.props.tabletop.gridScale}
                                    gridUnit={onMapProperties?.gridUnit ?? this.props.tabletop.gridUnit}
                                    roundToGrid={this.props.snapToGrid || false}
                                    metadata={metadata}
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
                            ) : (
                                <MetadataLoaderContainer key={'loader-' + miniId} tabletopId={miniId}
                                                         metadata={metadata}
                                                         calculateProperties={calculatePieceProperties}
                                />
                            )
                        }
                        {
                            this.state.selectedNoteMiniId !== miniId || this.state.rteState ? null : (
                                <Html distanceFactor={10} position={buildVector3(positionObj)} className='templateNote'
                                      style={{transform: 'translate3d(-50%,0,0)'}}>
                                    <div className='material-icons menuCancel'
                                         onClick={this.closeGMNote} onTouchStart={this.closeGMNote}>close</div>
                                    <div className='material-icons menuEdit'
                                         onClick={this.editGMNote} onTouchStart={this.editGMNote}>edit</div>
                                    <ReactMarkdown linkTarget='_blank'>{gmNoteMarkdown || '\n'}</ReactMarkdown>
                                </Html>
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
                camera.setViewOffset(this.state.width, this.state.height, 0, 0, this.state.width, this.state.height);
                camera.clearViewOffset();
            }
        }
    }

    object3DToScreenCoords(object: THREE.Object3D) {
        object.getWorldPosition(this.offset);
        const projected = this.offset.project(this.state.camera!);
        return {x: (1 + projected.x) * this.state.width / 2, y: (1 - projected.y) * this.state.height / 2};
    }

    renderFogOfWarRect() {
        const fogOfWarRect = this.state.fogOfWarRect;
        if (fogOfWarRect) {
            const map = this.props.scenario.maps[fogOfWarRect.mapId];
            const rotation = buildEuler(map.rotation);
            const {startPos, endPos} = getMapGridRoundedVectors(map, rotation, fogOfWarRect.startPos, fogOfWarRect.endPos);
            const position = buildVector3(map.position);
            return (
                <group position={position} rotation={rotation}>
                    <FogOfWarRectComponent gridType={map.metadata.properties!.gridType}
                                           cornerPos1={startPos} cornerPos2={endPos} colour={fogOfWarRect.colour}
                    />
                </group>
            );
        } else {
            return null;
        }
    }


    renderDice(interestLevelY: number) {
        const dice = this.props.dice;
        return !dice || dice.rollIds.length === 0 ? null : (
            <>
                {
                    Object.keys(dice.rolls).map((rollId) => {
                        const position = this.state.dicePosition[rollId];
                        const rotation = this.state.diceRotation[rollId];
                        return !position ? null : (
                            <group position={position} rotation={rotation} key={'dice-for-rollId-' + rollId}>
                                <Physics gravity={[0, -20, 0]} step={1/50} allowSleep={true}>
                                    <DiceRollSurface/>
                                    {
                                        dice.rolls[rollId].diceIds
                                            .map((dieId) => {
                                                const die = dice.rollingDice[dieId];
                                                return (
                                                    <Die key={dieId} seed={dieId}
                                                         type={die.dieType}
                                                         dieColour={die.dieColour}
                                                         fontColour={die.textColour}
                                                         index={die.index}
                                                         result={die.result}
                                                         override={die.definitiveResult && die.result && die.definitiveResult.index !== die.result.index ? die.definitiveResult : undefined}
                                                         initialPosition={die.initialPosition}
                                                         initialRotation={die.initialRotation}
                                                         onResult={(resultIndex, position, rotation) => {
                                                             this.props.dispatch(setDieResultAction(dieId, resultIndex, position, rotation));
                                                         }}
                                                         hidden={position.y > interestLevelY}
                                                         userData={{dieRollId: rollId, dieId}}
                                                    />
                                                );
                                            })
                                    }
                                </Physics>
                            </group>
                        );
                    })
                }
            </>
        );
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

    renderRulers() {
        const {connectedUsers, myPeerId} = this.props;
        if (connectedUsers && myPeerId) {
            const rulerPeerIds = Object.keys(connectedUsers.users).filter((peerId) => (
                connectedUsers.users[peerId].ruler
            ));
            if (rulerPeerIds.length > 0) {
                return rulerPeerIds.map((peerId) => {
                    const ruler = connectedUsers.users[peerId].ruler!;
                    const vectorStart = buildVector3(ruler.start);
                    const vectorEnd = buildVector3(ruler.end);
                    const length = vectorStart.distanceTo(vectorEnd);
                    const labelPosition = vectorEnd.add(vectorStart).multiplyScalar(0.5);
                    labelPosition.y = Math.max(ruler.end.y, ruler.start.y) + 0.5;
                    const mapProperties = !ruler.mapId ? undefined : this.props.scenario.maps[ruler.mapId]?.metadata.properties;
                    return (
                        <Fragment key={'ruler_' + peerId}>
                            <TabletopPathComponent
                                miniId={peerId}
                                positionObj={ruler.end}
                                movementPath={[ruler.start]}
                                distanceMode={this.props.snapToGrid ? mapProperties?.distanceMode ?? this.props.tabletop.distanceMode : DistanceMode.STRAIGHT}
                                distanceRound={mapProperties?.distanceRound ?? this.props.tabletop.distanceRound}
                                gridScale={mapProperties?.gridScale ?? this.props.tabletop.gridScale}
                                gridUnit={mapProperties?.gridUnit ?? this.props.tabletop.gridUnit}
                                roundToGrid={this.props.snapToGrid}
                                updateMovedSuffix={(distance) => {
                                    if (myPeerId === peerId) {
                                        this.props.dispatch(updateUserRulerAction(myPeerId, {...ruler, distance}))
                                    }
                                }}
                            />
                            <LabelSprite position={labelPosition} renderOrder={labelPosition.y} label={ruler.distance}
                                         labelSize={this.props.labelSize * Math.max(2, length / 2)}
                            />
                        </Fragment>
                    );
                });
            }
        }
        return null;
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
        const fogOfWar = getUpdatedMapFogRect(map, fogOfWarRect.startPos, fogOfWarRect.endPos, reveal);
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
                                 this.context.disableGlobalKeyboardHandler(false);
                                 return {rteState: undefined};
                             });
                         }}
            >
                {
                    !this.state.rteState ? null : (
                        <RichTextEditor editorClassName='gmNoteEditor' value={this.state.rteState}
                                        onChange={(rteState) => {this.setState({rteState})}}/>
                    )
                }
            </ModalDialog>
        )
    }

    renderDragHandle() {
        const dragHandleTooltip = (this.props.fogOfWarMode) ? 'Use this handle to pan the camera without leaving Fog of War mode.'
            : (this.isPaintActive()) ? 'Use this handle to pan the camera without leaving paint mode.'
            : (this.state.selected?.mapId) ? 'Use this handle to pan the camera while repositioning the map.'
            : (this.props.measureDistanceMode) ? 'Use this handle to pan the camera while measuring distances.'
            : (this.props.elasticBandMode) ? 'Use this handle to pan the camera while in elastic band mode.'
            : undefined;
        return (
            (!dragHandleTooltip) ? null : (
                <div
                    className='cameraDragHandle'
                    onMouseDown={() => {this.setState({dragHandle: true})}}
                    onTouchStart={() => {this.setState({dragHandle: true})}}
                >
                    <Tooltip tooltip={dragHandleTooltip}>
                        <div className='material-icons'>pan_tool</div>
                    </Tooltip>
                </div>
            )
        )
    }

    render() {
        const cameraLookingDown = (this.props.cameraLookAt.y < this.props.cameraPosition.y);
        const interestLevelY = this.getInterestLevelY(cameraLookingDown);
        const maxCameraDistance = getMaxCameraDistance(this.props.scenario.maps);
        return (
            <div className='canvas'>
                <ResizeDetector handleWidth={true} handleHeight={true} onResize={this.onResize} />
                <GestureControls
                    onGestureStart={this.onGestureStart}
                    onGestureEnd={this.onGestureEnd}
                    onTap={this.onTap}
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onRotate={this.onRotate}
                    onPress={this.onPress}
                >
                    <CanvasContextBridge
                        style={{width: this.state.width || 0, height: this.state.height || 0}}
                        frameloop='demand'
                        onCreated={({gl, camera, scene}) => {
                            gl.setClearColor(TabletopViewComponent.BACKGROUND_COLOUR);
                            gl.setClearAlpha(1);
                            this.setState({camera: camera as THREE.PerspectiveCamera, scene});
                        }}
                        linear={true}
                    >
                        <ControlledCamera position={this.props.cameraPosition} lookAt={this.props.cameraLookAt} near={0.1} far={maxCameraDistance}/>
                        <ambientLight />
                        <pointLight intensity={0.6} position={this.props.cameraPosition} />
                        {this.renderMaps(interestLevelY, cameraLookingDown)}
                        {this.renderMinis(interestLevelY, cameraLookingDown)}
                        {this.renderFogOfWarRect()}
                        <RenderElasticBandRect elasticBandRect={this.state.elasticBandRect}/>
                        {this.renderDice(interestLevelY)}
                        {this.renderPings()}
                        {this.renderRulers()}
                    </CanvasContextBridge>
                    {this.renderDragHandle()}
                </GestureControls>
                {this.renderMenuSelected()}
                {this.renderEditSelected()}
                {this.renderFogOfWarButtons()}
                {this.renderNoteEditor()}
            </div>
        );
    }
}

export default TabletopViewComponent;

function RenderElasticBandRect({elasticBandRect}: {elasticBandRect?: ElasticBandRectType}) {
    const {camera} = useThree();
    const quaternion = camera.quaternion;
    const points = useMemo(() => {
        if (elasticBandRect) {
            const {startPos, endPos} = elasticBandRect;
            const corner1 = new THREE.Vector3(startPos.x, startPos.y + 0.1, startPos.z);
            const corner3 = new THREE.Vector3(endPos.x, corner1.y, endPos.z);
            const vectorDiagonal = corner3.clone().sub(corner1);
            const vectorRight = TabletopViewComponent.DIR_EAST.clone().applyQuaternion(quaternion);
            const width = vectorDiagonal.dot(vectorRight);
            const corner2 = corner1.clone().addScaledVector(vectorRight, width);
            const corner4 = corner3.clone().addScaledVector(vectorRight, -width);
            return [corner1, corner2, corner3, corner4, corner1];
        } else {
            return [];
        }
    }, [elasticBandRect, quaternion]);
    const length = useMemo(() => (
        elasticBandRect ? 2 * Math.abs(elasticBandRect.startPos.x - elasticBandRect.endPos.x) +
            2 * Math.abs(elasticBandRect.startPos.z - elasticBandRect.endPos.z) : 0
    ), [elasticBandRect]);
    const computeLineDistances = useCallback((line) => (line.computeLineDistances()), []);
    const setFromPoints = useCallback((lineMaterial) => {lineMaterial.setFromPoints(points)}, [points]);
    if (elasticBandRect) {
        return (
            <lineSegments onUpdate={computeLineDistances}>
                <bufferGeometry attach='geometry' onUpdate={setFromPoints}/>
                <lineDashedMaterial attach="material" color={elasticBandRect.colour} linewidth={10}
                                    linecap={'round'} linejoin={'round'} dashSize={1} gapSize={1}
                                    scale={length * 20}
                />
            </lineSegments>
        );
    } else {
        return null;
    }
}

function DiceRollSurface() {
    const [ref] = usePlane(() => ({mass: 0, rotation: [-Math.PI / 2, 0, 0]}));
    return (<mesh ref={ref}/>);
}
