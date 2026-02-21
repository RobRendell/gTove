import './tabletopViewComponent.scss';

import {Physics, usePlane} from '@react-three/cannon';
import {useThree} from '@react-three/fiber';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import takeWhile from 'lodash/takeWhile';
import memoizeOne from 'memoize-one';
import * as PropTypes from 'prop-types';
import {Component, Fragment, useLayoutEffect, useMemo, useRef} from 'react';
import ResizeDetector from 'react-resize-detector';
import {toast, ToastOptions} from 'react-toastify';
import * as THREE from 'three';
import {v4} from 'uuid';

import ControlledCamera from '../container/controlledCamera';
import GestureControls from '../container/gestureControls';
import CanvasContextBridge from '../context/CanvasContextBridge';
import {DisableGlobalKeyboardHandlerContext} from '../context/disableGlobalKeyboardHandlerContextBridge';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {tmpGetMapPathDataFromMaps} from '../hooks/useMapPathData';
import {updateUserRulerAction} from '../redux/connectedUserReducer';
import {ConnectedUserReducerType} from '../redux/connectedUserReducerTypes';
import {addDiceAction, setDieResultAction} from '../redux/diceReducer';
import {AddDieType, DiceReducerType} from '../redux/diceReducerTypes';
import {GtoveDispatchProp} from '../redux/mainReducerTypes';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducerTypes';
import {addPingAction} from '../redux/pingReducer';
import {PingReducerType} from '../redux/pingReducerTypes';
import {
    separateUndoGroupAction,
    undoGroupActionList,
    undoGroupThunk,
    updateMapFogOfWarAction,
    updateMapPositionAction,
    updateMapRotationAction,
    updateMiniElevationAction,
    updateMiniPositionAction,
    updateMiniRotationAction,
    updateMiniScaleAction,
    updateMiniVisibilityAction
} from '../redux/scenarioReducer';
import {updateTabletopPaintStateAction} from '../redux/tabletopStateReducer';
import {PaintState} from '../redux/tabletopStateReducerTypes';
import TextureService from '../service/textureService';
import * as constants from '../util/constants';
import {MAP_DELTA, NEW_MAP_DELTA_Y, SAME_LEVEL_MAP_DELTA_Y} from '../util/constants';
import {isCloseTo} from '../util/mathsUtils';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {
    DistanceMode,
    getAbsoluteMiniPosition,
    getBaseCameraParameters,
    getGridTypeOfMap,
    getMapGridRoundedVectors,
    getMapIdAtPoint,
    getMapIdOnNextLevel,
    getMaxCameraDistance,
    getPieceName,
    getRootAttachedMiniId,
    getUpdatedMapFogRect,
    getVisibilityString,
    isFogOfWarAtPoint,
    isNameColumn,
    MapType,
    MiniType,
    MovementPathPoint,
    ObjectVector2,
    ObjectVector3,
    PiecesRosterColumn,
    ScenarioType,
    snapMap,
    snapMini,
    TabletopType
} from '../util/scenarioUtils';
import {TextureLoaderContext} from '../util/storage/providers/google/driveTextureLoader';
import {FileAPIContext, FileMetadata, GridType, PieceVisibilityEnum} from '../util/storage/storageContract';
import {castMapProperties} from '../util/storage/storageUtils';
import {joinAnd} from '../util/stringUtils';
import {buildEuler, buildVector3, vector3ToObject} from '../util/threeUtils';
import Die from './dice/die';
import FogOfWarRectComponent from './fogOfWarRectComponent';
import GmNoteEditor from './gmNoteEditor';
import InputButton from './inputButton';
import InputField from './inputField';
import LabelSprite from './labelSprite';
import {PaintToolEnum} from './paintTools';
import PingsComponent from './pingsComponent';
import TabletopContextMenu from './tabletopContextMenu';
import {TabletopMapLayer} from './tabletopMapLayer';
import {TabletopMiniLayer} from './tabletopMiniLayer';
import TabletopPathComponent from './tabletopPathComponent';
import Tooltip from './tooltip';
import {SetCameraFunction} from './virtualGamingTabletop';

export interface TabletopViewComponentSelected {
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
    name?: string;
    fogOfWarHandle?: boolean;
    fogOfWarRect?: boolean;
    repositionMap?: boolean;
    selectIdType?: 'miniId' | 'mapId';
    selectIds?: {mapId?: string; miniId?: string;}[];
    attachIds?: string[];
}

export interface TabletopViewComponentMenuSelected {
    selected: TabletopViewComponentSelected;
    label?: string;
}

export interface TabletopViewComponentEditSelected {
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
    findUnusedMiniName: (baseName: string, suffix?: number, space?: boolean) => [string, number];
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
    selectedNoteMiniId?: string | null;
}

interface ElasticBandRectType {
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    colour: string;
    selectedMiniIds?: {[miniId: string]: boolean};
}

export interface FogOfWarRectState {
    mapId: string;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    colour: string;
    position: THREE.Vector2;
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
    fogOfWarRect?: FogOfWarRectState;
    elasticBandRect?: ElasticBandRectType;
    autoPanInterval?: number;
    toastIds: {[message: string]: number | string};
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

class TabletopViewComponent extends Component<TabletopViewComponentProps, TabletopViewComponentState> {

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

    declare context: TextureLoaderContext & PromiseModalContext & FileAPIContext & DisableGlobalKeyboardHandlerContext;

    private rayCaster: THREE.Raycaster;
    private readonly rayPoint: THREE.Vector2;
    private readonly offset: THREE.Vector3;
    private readonly plane: THREE.Plane;

    private getPieceName(miniId: string): string {
        return getPieceName(miniId, this.props.scenario.minis, this.props.tabletop.piecesRosterColumns);
    }

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
        this.getShowNearColumns = memoizeOne(this.getShowNearColumns.bind(this));
        this.confirmLargeFogOfWarAction = this.confirmLargeFogOfWarAction.bind(this);
        this.verifyMiniVisibility = this.verifyMiniVisibility.bind(this);
        this.setMenuSelected = this.setMenuSelected.bind(this);
        this.setEditSelected = this.setEditSelected.bind(this);
        this.setSelected = this.setSelected.bind(this);
        this.finaliseSelectedBy = this.finaliseSelectedBy.bind(this);
        this.changeFogOfWarBitmask = this.changeFogOfWarBitmask.bind(this);
        this.cancelFogOfWarRect = this.cancelFogOfWarRect.bind(this);
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
        if (this.state.editSelected && this.selectionMissing(this.state.editSelected.selected, props)) {
            this.setState({editSelected: undefined});
        }
        if (this.state.dragHandle && !props.fogOfWarMode && !this.isPaintActive(props) && !this.state.selected?.mapId
                && !props.measureDistanceMode && !props.elasticBandMode) {
            this.setState({dragHandle: false});
        }
        if (!props.fogOfWarMode && (this.state.fogOfWarRect || this.state.menuSelected?.selected.fogOfWarHandle)) {
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

    setSelected(selected?: TabletopViewComponentSelected) {
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

    private setMenuSelected(menuSelected?: TabletopViewComponentMenuSelected) {
        this.state.selected?.finish?.();
        this.setState({menuSelected});
    }

    private setEditSelected(editSelected?: TabletopViewComponentEditSelected) {
        this.setState({editSelected});
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
        if ((!this.state.fogOfWarRect || this.state.menuSelected?.selected.fogOfWarRect) && this.state.autoPanInterval) {
            clearInterval(this.state.autoPanInterval);
            this.setState({autoPanInterval: undefined});
        } else if (this.state.fogOfWarRect) {
            let delta = {x: 0, y: 0};
            const dragBorder = Math.min(TabletopViewComponent.FOG_RECT_DRAG_BORDER, this.state.width / 10, this.state.height / 10);
            const {position} = this.state.fogOfWarRect;
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
                        position: new THREE.Vector2(position.x, position.y)};
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
                    position: new THREE.Vector2(position.x, position.y)}});
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
                    start: {...snappedStart.positionObj, onMapId: positionMapId},
                    end: snappedEnd.positionObj,
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
                        this.props.dispatch(updateTabletopPaintStateAction({operationId: v4(), toolPositionStart: selected.point, toolMapId: selected.mapId}));
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
            this.setSelected({...selected, name: this.getPieceName(selected.miniId)});
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
        const menuSelected: TabletopViewComponentMenuSelected | undefined = !this.state.fogOfWarRect ? undefined : {
            selected: {fogOfWarRect: true, position: this.state.fogOfWarRect.position},
        };
        if (this.props.elasticBandMode) {
            if (this.state.selected?.multipleMiniIds && this.state.selected.multipleMiniIds.length > 0 && !this.state.dragHandle) {
                this.props.endElasticBandMode();
            }
        } else if (!this.state.selected?.mapId) {
            this.setSelected(undefined);
        }
        this.setState({dragHandle: false, menuSelected, elasticBandRect: undefined});
        setTimeout(() => {
            this.props.dispatch(updateTabletopPaintStateAction({operationId: undefined, toolPositionStart: undefined, toolPosition: undefined, toolMapId: undefined}));
        }, 1);
        if (this.props.measureDistanceMode && this.props.myPeerId) {
            this.props.dispatch(updateUserRulerAction(this.props.myPeerId));
        }
    }

    private finaliseSelectedBy(alsoClearHandles?: boolean) {
        const {selected} = this.state;
        if (selected) {
            let actions = [];
            if (selected.mapId) {
                const map = this.props.scenario.maps[selected.mapId];
                if (map.selectedBy !== this.props.myPeerId) {
                    if (alsoClearHandles) {
                        this.setState({dragHandle: false, selected: undefined});
                    }
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
        if (alsoClearHandles) {
            this.setState({dragHandle: false, selected: undefined});
        }
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
                        selected: {position: new THREE.Vector2(position.x, position.y), fogOfWarHandle: true},
                        label: 'Use this handle to pan the camera while in Fog of War mode.'
                    }
                });
            } else if (this.state.selected?.mapId) {
                // show reposition menu
                this.setState({
                    menuSelected: {
                        selected: {position: new THREE.Vector2(position.x, position.y), repositionMap: true},
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
                    endPos: selected.point, position: new THREE.Vector2(position.x, position.y), colour: ''});
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
            this.props.dispatch(updateTabletopPaintStateAction({toolPosition: this.props.paintState.toolPositionStart}));
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
                    const selectIds = sameType.map((intersect) => ({
                        mapId: intersect.type === 'mapId' ? intersect.mapId : undefined,
                        miniId: intersect.type === 'miniId' ? intersect.miniId : undefined,
                        name: intersect.type === 'mapId' ? this.props.scenario.maps[intersect.mapId].name : this.getPieceName(intersect.miniId)
                    }));
                    const selectIdType = sameType[0].type;
                    this.setState({menuSelected: {selected: {...selected, selectIdType, selectIds}, label: 'Which do you want to select?'}});
                } else {
                    this.setState({editSelected: undefined, menuSelected: {selected}});
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
                this.props.dispatch(updateTabletopPaintStateAction({toolPosition: paintTarget.point, toolMapId: paintTarget.mapId}));
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
                    endPos: selected.point, position: new THREE.Vector2(currentPos.x, currentPos.y), colour: ''});
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
        const delta = cameraLookingDown ? MAP_DELTA : -MAP_DELTA;
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
                                <Physics gravity={[0, -20, 0]} stepSize={1/50} allowSleep={true}>
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
                                // TODO clean this up when converting to a functional component
                                mapPathData={tmpGetMapPathDataFromMaps(this.props.scenario.maps)}
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
                <div className='menuEditSelected' style={{top: position.y, left: position.x}}>
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
        this.cancelFogOfWarRect();
    }

    cancelFogOfWarRect() {
        this.setState({fogOfWarRect: undefined});
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
        const {showMiniNames, nearColumns, simpleNearColumns} = this.getShowNearColumns(!this.props.userIsGM || this.props.playerView, this.props.tabletop.piecesRosterColumns);
        this.offset.copy(this.props.cameraLookAt).sub(this.props.cameraPosition).normalize();
        const topDown = this.offset.dot(TabletopViewComponent.DIR_DOWN) > constants.TOPDOWN_DOT_PRODUCT;

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
                            gl.toneMapping = THREE.NoToneMapping;
                            gl.outputEncoding = THREE.LinearEncoding;
                            this.setState({camera: camera as THREE.PerspectiveCamera, scene});
                        }}
                        linear={true} flat={true}
                    >
                        <ControlledCamera position={this.props.cameraPosition} lookAt={this.props.cameraLookAt} near={0.1} far={maxCameraDistance}/>
                        <ambientLight />
                        <pointLight intensity={0.6} position={this.props.cameraPosition} />
                        <TabletopMapLayer interestLevelY={interestLevelY}
                                          cameraLookingDown={cameraLookingDown}
                                          defaultGrid={this.props.tabletop.defaultGrid}
                                          gmView={this.props.userIsGM && !this.props.playerView}
                                          snapToGrid={this.props.snapToGrid}
                                          dispatch={this.props.dispatch}
                                          selectedMapId={this.state.selected?.mapId}
                        />
                        <TabletopMiniLayer defaultGrid={this.props.tabletop.defaultGrid} snapToGrid={this.props.snapToGrid}
                                           adjustingScale={this.state.selected?.scale !== undefined}
                                           showMiniNames={showMiniNames} interestLevelY={interestLevelY}
                                           cameraLookingDown={cameraLookingDown} topDown={topDown}
                                           gmView={this.props.userIsGM && !this.props.playerView}
                                           nearColumns={nearColumns} simpleNearColumns={simpleNearColumns}
                                           tabletop={this.props.tabletop} labelSize={this.props.labelSize}
                        />
                        {this.renderFogOfWarRect()}
                        <RenderElasticBandRect elasticBandRect={this.state.elasticBandRect}/>
                        {this.renderDice(interestLevelY)}
                        {this.renderPings()}
                        {this.renderRulers()}
                    </CanvasContextBridge>
                    {this.renderDragHandle()}
                </GestureControls>
                <TabletopContextMenu menuSelected={this.state.menuSelected}
                                     setMenuSelected={this.setMenuSelected}
                                     setEditSelected={this.setEditSelected}
                                     setSelected={this.setSelected}
                                     setCamera={this.props.setCamera}
                                     focusMapId={this.props.focusMapId}
                                     setFocusMapId={this.props.setFocusMapId}
                                     confirmLargeFogOfWarAction={this.confirmLargeFogOfWarAction}
                                     finaliseSelectedBy={this.finaliseSelectedBy}
                                     replaceMapImageFn={this.props.replaceMapImageFn}
                                     verifyMiniVisibility={this.verifyMiniVisibility}
                                     userIsGM={this.props.userIsGM && !this.props.playerView}
                                     endFogOfWarMode={this.props.endFogOfWarMode}
                                     changeFogOfWarBitmask={this.changeFogOfWarBitmask}
                                     cancelFogOfWarRect={this.cancelFogOfWarRect}
                                     findPositionForNewMini={this.props.findPositionForNewMini}
                                     findUnusedMiniName={this.props.findUnusedMiniName}
                />
                {this.renderEditSelected()}
                <GmNoteEditor />
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
    const lineLoopRef = useRef<THREE.LineLoop>(null);
    const bufferGeometryRef = useRef<THREE.BufferGeometry>(null);
    useLayoutEffect(() => {
        if (bufferGeometryRef.current) {
            bufferGeometryRef.current.setFromPoints(points);
            if (bufferGeometryRef.current.attributes.position) {
                bufferGeometryRef.current.attributes.position.needsUpdate = true;
            }
            // Recompute bounding volume so it's not culled by the frustum check.
            bufferGeometryRef.current.computeBoundingSphere();
            // Compute dash distances.
            lineLoopRef.current?.computeLineDistances();
        }
    }, [points])
    return !elasticBandRect ? null : (
        <lineLoop ref={lineLoopRef}>
            <bufferGeometry attach='geometry' ref={bufferGeometryRef}/>
            <lineDashedMaterial attach="material" color={elasticBandRect.colour} linecap={'round'} linejoin={'round'}
                                scale={1} dashSize={0.5} gapSize={0.5}
            />
        </lineLoop>
    );
}

function DiceRollSurface() {
    const [ref] = usePlane(() => ({mass: 0, rotation: [-Math.PI / 2, 0, 0]}));
    return (<mesh ref={ref as any}/>);
}
