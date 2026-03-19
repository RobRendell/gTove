import './tabletopViewComponent.scss';

import takeWhile from 'lodash/takeWhile';
import memoizeOne from 'memoize-one';
import * as PropTypes from 'prop-types';
import {Component} from 'react';
import ResizeDetector from 'react-resize-detector';
import {toast, ToastOptions} from 'react-toastify';
import * as THREE from 'three';
import {v4} from 'uuid';

import ControlledCamera from '../container/controlledCamera';
import GestureControls, {GestureHandler} from '../container/gestureControls';
import PaintGestureHandler from '../container/paintGestureHandler';
import CanvasContextBridge from '../context/CanvasContextBridge';
import {DisableGlobalKeyboardHandlerContext} from '../context/disableGlobalKeyboardHandlerContextBridge';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {ConnectedUserReducerType} from '../redux/connectedUserReducerTypes';
import {GtoveDispatchProp} from '../redux/mainReducerTypes';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducerTypes';
import {addPingAction} from '../redux/pingReducer';
import {PingReducerType} from '../redux/pingReducerTypes';
import {undoGroupThunk, updateMiniPositionAction, updateMiniVisibilityAction} from '../redux/scenarioReducer';
import {DragModeType} from '../redux/tabletopStateReducerTypes';
import TextureService from '../service/textureService';
import * as constants from '../util/constants';
import {MAP_DELTA, NEW_MAP_DELTA_Y, SAME_LEVEL_MAP_DELTA_Y} from '../util/constants';
import {ContextMenuOption} from '../util/contextMenuTypes';
import {panCamera, rotateCamera, zoomCamera} from '../util/orbitCameraUtils';
import {
    getMapIdOnNextLevel,
    getMaxCameraDistance,
    getPieceName,
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
    TabletopType
} from '../util/scenarioUtils';
import {TextureLoaderContext} from '../util/storage/providers/google/driveTextureLoader';
import {FileAPIContext, FileMetadata, PieceVisibilityEnum} from '../util/storage/storageContract';
import {joinAnd} from '../util/stringUtils';
import {vector3ToObject} from '../util/threeUtils';
import GmNoteEditor from './gmNoteEditor';
import InputButton from './inputButton';
import InputField from './inputField';
import TabletopContextMenu from './tabletopContextMenu';
import TabletopDiceLayer from './tabletopDiceLayer';
import TabletopDragHandle from './tabletopDragHandle';
import TabletopElasticBand from './tabletopElasticBand';
import TabletopFogOfWar from './tabletopFogOfWar';
import {TabletopMapLayer} from './tabletopMapLayer';
import {TabletopMiniLayer} from './tabletopMiniLayer';
import TabletopPingsComponent from './tabletopPingsComponent';
import TabletopRulers from './tabletopRulers';
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
    repositionMap?: boolean;
    selectIdType?: 'miniId' | 'mapId';
    selectIds?: {mapId?: string; miniId?: string;}[];
    attachIds?: string[];
}

export interface TabletopViewComponentMenuSelected {
    selected: TabletopViewComponentSelected;
    label?: string;
    options?: ContextMenuOption[];
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
    dragMode?: DragModeType;
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
    networkHubId?: string;
    pings?: PingReducerType;
    connectedUsers?: ConnectedUserReducerType;
    sideMenuOpen?: boolean;
    selectedNoteMiniId?: string | null;
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
    menuSelected?: TabletopViewComponentMenuSelected;
    editSelected?: TabletopViewComponentEditSelected;
    autoPanInterval?: number;
    toastIds: {[message: string]: number | string};
}

type RayCastIntersectBase = {
    point: THREE.Vector3;
    position: THREE.Vector2;
    object: THREE.Object3D;
}

export type RayCastIntersectMap = RayCastIntersectBase & {
    type: 'mapId';
    mapId: string;
}

export type RayCastIntersectMini = RayCastIntersectBase & {
    type: 'miniId';
    miniId: string;
}

export type RayCastIntersectDie = RayCastIntersectBase & {
    type: 'dieRollId';
    dieRollId: string;
    dieId: string;
}

export type RayCastIntersect = RayCastIntersectMap | RayCastIntersectMini | RayCastIntersectDie;

export type RayCastField = RayCastIntersect['type'];

export type TabletopViewGestureContext<Intersect extends RayCastIntersect | undefined = RayCastIntersect | undefined> = {
    intersect: Intersect;
    readOnly: boolean;
    dragHandle: boolean;
};

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

    static DRAG_HANDLE_CLASSNAME = 'dragCameraHandle';

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
    private readonly gestureHandler: GestureHandler<TabletopViewGestureContext>;

    constructor(props: TabletopViewComponentProps) {
        super(props);
        this.onResize = this.onResize.bind(this);
        this.getShowNearColumns = memoizeOne(this.getShowNearColumns.bind(this));
        this.confirmLargeFogOfWarAction = this.confirmLargeFogOfWarAction.bind(this);
        this.verifyMiniVisibility = this.verifyMiniVisibility.bind(this);
        this.setMenuSelected = this.setMenuSelected.bind(this);
        this.setEditSelected = this.setEditSelected.bind(this);
        this.setSelected = this.setSelected.bind(this);
        this.finaliseSelectedBy = this.finaliseSelectedBy.bind(this);
        this.buildGestureContext = this.buildGestureContext.bind(this);
        this.setSelectedMiniIds = this.setSelectedMiniIds.bind(this);
        this.showToastMessage = this.showToastMessage.bind(this);
        this.rayCaster = new THREE.Raycaster();
        this.rayPoint = new THREE.Vector2();
        this.offset = new THREE.Vector3();
        this.plane = new THREE.Plane();
        this.state = {
            width: 0,
            height: 0,
            toastIds: {},
        };
        this.gestureHandler = {
            id: 'tabletopViewHandler',
            onGestureStart: this.onGestureStart.bind(this),
            onGestureEnd: this.onGestureEnd.bind(this),
            onTap: this.onTap.bind(this),
            onPan: this.onPan.bind(this),
            onZoom: this.onZoom.bind(this),
            onRotate: this.onRotate.bind(this),
            onPress: this.onPress.bind(this)
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

    private getPieceName(miniId: string): string {
        return getPieceName(miniId, this.props.scenario.minis, this.props.tabletop.piecesRosterColumns);
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
    ): U | null {
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

    private setSelectedMiniIds(selectedMiniIds: {[miniId: string]: boolean}) {
        const undoGroup = this.state.selected?.undoGroup || v4();
        const multipleMiniIds = (this.state.selected?.multipleMiniIds || [])
            .filter((miniId) => (selectedMiniIds[miniId] === undefined))
            .concat(
                Object.keys(selectedMiniIds)
                    .filter((miniId) => (selectedMiniIds[miniId]))
            );
        for (const miniId in selectedMiniIds) {
            const mini = this.props.scenario.minis[miniId];
            if (selectedMiniIds[miniId] && mini.selectedBy !== this.props.myPeerId) {
                this.props.dispatch(undoGroupThunk(updateMiniPositionAction(miniId, mini.position, this.props.myPeerId, mini.onMapId), undoGroup));
            } else if (!selectedMiniIds[miniId] && mini.selectedBy === this.props.myPeerId) {
                this.props.dispatch(undoGroupThunk(updateMiniPositionAction(miniId, mini.position, null, mini.onMapId), undoGroup));
            }
        }
        this.setState({
            selected: {multipleMiniIds, undoGroup, finish: () => {this.finaliseSelectedBy()}},
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

    buildGestureContext(position?: ObjectVector2, targetElement?: Element): TabletopViewGestureContext {
        const fields: RayCastField[] = (this.state.selected?.mapId) ? ['mapId'] : ['miniId', 'mapId', 'dieRollId'];
        const intersect = this.props.readOnly || !position ? undefined
            : this.rayCastForAllUserDataFields(position, fields)
                .find((intersection) => (
                    // Ignore locked minis for the purposes of gesture starts
                    intersection.type !== 'miniId' || !this.isMiniLocked(intersection.miniId)
                ));
        return {
            intersect,
            readOnly: this.props.readOnly,
            dragHandle: !!targetElement?.closest(`.${TabletopViewComponent.DRAG_HANDLE_CLASSNAME}`)
        };
    }

    onGestureStart() {
        this.setState({menuSelected: undefined});
    }

    onGestureEnd() {
        this.finaliseSelectedBy();
        if (!this.state.selected?.mapId) {
            this.setSelected(undefined);
        }
    }

    private finaliseSelectedBy(alsoClearHandles?: boolean) {
        if (alsoClearHandles) {
            this.setState({selected: undefined});
        }
    }

    onTap(position: ObjectVector2) {
        if (!this.props.disableTapMenu) {
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

    onPan(delta: ObjectVector2) {
        this.state.camera && this.props.setCamera(panCamera(delta, this.state.camera, this.props.cameraLookAt,
            this.props.cameraPosition, this.state.width, this.state.height));
    }

    onZoom(delta: ObjectVector2) {
        const maxDistance = getMaxCameraDistance(this.props.scenario.maps);
        this.state.camera && this.props.setCamera(zoomCamera(delta, this.props.cameraLookAt,
            this.props.cameraPosition, 2, maxDistance));
    }

    onRotate(delta: ObjectVector2) {
        this.state.camera && this.props.setCamera(rotateCamera(delta, this.state.camera, this.props.cameraLookAt,
            this.props.cameraPosition, this.state.width, this.state.height));
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
                <GestureControls buildContext={this.buildGestureContext} defaultHandler={this.gestureHandler}>
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
                                          userIsGM={this.props.userIsGM}
                                          gmView={this.props.userIsGM && !this.props.playerView}
                                          snapToGrid={this.props.snapToGrid}
                                          dispatch={this.props.dispatch}
                                          selectedMapId={this.state.selected?.mapId}
                                          setCamera={this.props.setCamera}
                                          undoGroupId={this.state.selected?.undoGroup}
                        />
                        <TabletopMiniLayer defaultGrid={this.props.tabletop.defaultGrid}
                                           snapToGrid={this.props.snapToGrid}
                                           adjustingScale={this.state.selected?.scale !== undefined}
                                           showMiniNames={showMiniNames}
                                           interestLevelY={interestLevelY}
                                           cameraLookingDown={cameraLookingDown}
                                           topDown={topDown}
                                           gmView={this.props.userIsGM && !this.props.playerView}
                                           nearColumns={nearColumns}
                                           simpleNearColumns={simpleNearColumns}
                                           tabletop={this.props.tabletop}
                                           labelSize={this.props.labelSize}
                                           selectedMiniId={this.state.selected?.miniId}
                                           multipleMiniIds={this.state.selected?.multipleMiniIds}
                                           undoGroupId={this.state.selected?.undoGroup}
                        />
                        <TabletopFogOfWar setCamera={this.props.setCamera}
                                          showToastMessage={this.showToastMessage}
                                          setMenuSelected={this.setMenuSelected}
                        />
                        <TabletopElasticBand setSelectedMiniIds={this.setSelectedMiniIds}
                                             userIsGM={this.props.userIsGM}
                                             focusMapId={this.props.focusMapId}
                        />
                        <TabletopDiceLayer interestLevelY={interestLevelY} />
                        <TabletopPingsComponent setCamera={this.props.setCamera}
                                                sideMenuOpen={this.props.sideMenuOpen}
                        />
                        <TabletopRulers snapToGrid={this.props.snapToGrid}
                                        labelSize={this.props.labelSize}
                        />
                        <PaintGestureHandler />
                    </CanvasContextBridge>
                    <TabletopDragHandle className={TabletopViewComponent.DRAG_HANDLE_CLASSNAME}
                                        setMenuSelected={this.setMenuSelected}
                                        repositionMap={this.state.selected?.mapId !== undefined}
                    />
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