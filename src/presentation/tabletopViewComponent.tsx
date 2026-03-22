import './tabletopViewComponent.scss';

import takeWhile from 'lodash/takeWhile';
import {FunctionComponent, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import ResizeDetector from 'react-resize-detector';
import {Camera, Color, LinearEncoding, NoToneMapping, Object3D, Scene, Vector2, Vector3} from 'three';

import ControlledCamera from '../container/controlledCamera';
import GestureControls from '../container/gestureControls';
import PaintGestureHandler from '../container/paintGestureHandler';
import CanvasContextBridge from '../context/CanvasContextBridge';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import {useThreeRaycast} from '../hooks/useRaycast';
import {getScenarioFromStore, getTabletopFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducerTypes';
import {addPingAction} from '../redux/pingReducer';
import {updateMiniVisibilityAction} from '../redux/scenarioReducer';
import {MAP_DELTA, NEW_MAP_DELTA_Y, SAME_LEVEL_MAP_DELTA_Y} from '../util/constants';
import {ContextMenuOption} from '../util/contextMenuTypes';
import {
    getMapIdOnNextLevel,
    getPieceName,
    getVisibilityString,
    MiniType,
    MovementPathPoint,
    ObjectVector2,
    ObjectVector3,
    ScenarioType
} from '../util/scenarioUtils';
import {PieceVisibilityEnum} from '../util/storage/storageContract';
import {joinAnd} from '../util/stringUtils';
import {isTopDown, vector3ToObject} from '../util/threeUtils';
import GmNoteEditor from './gmNoteEditor';
import TabletopContextMenu from './tabletopContextMenu';
import TabletopDiceLayer from './tabletopDiceLayer';
import TabletopDragHandle from './tabletopDragHandle';
import TabletopEditSelected from './tabletopEditSelected';
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
    point?: Vector3;
    scale?: boolean;
    position?: Vector2;
    finish?: () => void;
    object?: Object3D;
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

type RayCastIntersectBase = {
    point: Vector3;
    position: Vector2;
    object: Object3D;
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

const BACKGROUND_COLOUR = new Color(0x808080);

const DRAG_HANDLE_CLASSNAME = 'dragCameraHandle';

interface TabletopViewComponentProps {
    setCamera: SetCameraFunction;
    cameraPosition: Vector3;
    cameraLookAt: Vector3;
    snapToGrid: boolean;
    userIsGM: boolean;
    setFocusMapId: (mapId: string, panCamera?: boolean) => void;
    findPositionForNewMini: (allowHiddenMap: boolean, scale: number, basePosition?: Vector3 | ObjectVector3) => MovementPathPoint;
    findUnusedMiniName: (baseName: string, suffix?: number, space?: boolean) => [string, number];
    focusMapId?: string;
    readOnly: boolean;
    playerView: boolean;
    labelSize: number;
    myPeerId: MyPeerIdReducerType;
    disableTapMenu?: boolean;
    cameraView?: TabletopViewComponentCameraView;
    replaceMapImageFn?: (metadataId: string) => void;
    sideMenuOpen?: boolean;
}

const TabletopViewComponent: FunctionComponent<TabletopViewComponentProps> = ({
                                                                                  setCamera,
                                                                                  cameraPosition,
                                                                                  cameraLookAt,
                                                                                  snapToGrid,
                                                                                  userIsGM,
                                                                                  setFocusMapId,
                                                                                  findPositionForNewMini,
                                                                                  findUnusedMiniName,
                                                                                  focusMapId,
                                                                                  readOnly,
                                                                                  playerView,
                                                                                  labelSize,
                                                                                  myPeerId,
                                                                                  disableTapMenu,
                                                                                  cameraView,
                                                                                  replaceMapImageFn,
                                                                                  sideMenuOpen,
}) => {
    
    const dispatch = useDispatch();
    const store = useStore();
    const maxCameraDistance = useSelector(selectMaxCameraDistance);

    const promiseModal = useContext(PromiseModalContextObject);

    const [menuSelected, setMenuSelected] = useState<undefined | TabletopViewComponentMenuSelected>();
    const [editSelected, setEditSelected] = useState<undefined | TabletopViewComponentEditSelected>();
    const clearEditSelected = useCallback(() => {
        setEditSelected(undefined);
    }, []);
    const [size, setSize] = useState({width: 0, height: 0});
    const onResize = useCallback((width?: number, height?: number) => {
        setSize({width: width ?? 0, height: height ?? 0});
    }, []);

    const [threeCamera, setThreeCamera] = useState<Camera>(new Camera());
    const [threeScene, setThreeScene] = useState<Scene>(new Scene());
    const {raycastForAllUserDataFields, raycastForFirstUserDataFields, raycastToPlane} = useThreeRaycast(threeCamera, threeScene, size.width, size.height);
    
    // For menu and edit selections, ensure it's still present.
    const selectIsMenuSelectedValid = useCallback((state: ReduxStoreType) => {
        const scenario = getScenarioFromStore(state);
        return isSelectionValid(scenario, menuSelected?.selected);
    }, [menuSelected]);
    const menuSelectedValid = useSelector(selectIsMenuSelectedValid);
    useEffect(() => {
        if (!menuSelectedValid) {
            setMenuSelected(undefined);
        }
    }, [menuSelectedValid]);
    const selectIsEditSelectedValid = useCallback((state: ReduxStoreType) => {
        const scenario = getScenarioFromStore(state);
        return isSelectionValid(scenario, editSelected?.selected);
    }, [editSelected]);
    const editSelectedValid = useSelector(selectIsEditSelectedValid);
    useEffect(() => {
        if (!editSelectedValid) {
            setEditSelected(undefined);
        }
    }, [editSelectedValid]);

    const getPieceNameById = useCallback((miniId: string): string => {
        const scenario = getScenarioFromStore(store.getState());
        const tabletop = getTabletopFromStore(store.getState());
        return getPieceName(miniId, scenario.minis, tabletop.piecesRosterColumns);
    }, [store]);

    const verifyMiniVisibility = useCallback(async (miniId: string, visibility: PieceVisibilityEnum) => {
        const scenario = getScenarioFromStore(store.getState());
        const mini = scenario.minis[miniId];
        // A piece can only attach to pieces with the same or higher visibility.
        const problemMinisIds = [];
        for (let attachMiniId = mini.attachMiniId; attachMiniId; attachMiniId = attachMiniId && scenario.minis[attachMiniId].attachMiniId) {
            const attachMini = scenario.minis[attachMiniId];
            if (attachMini.visibility < visibility) {
                problemMinisIds.push(attachMiniId);
            } else {
                attachMiniId = undefined;
            }
        }
        addAttachedMinisWithHigherVisibility(scenario.minis, miniId, visibility, problemMinisIds);
        if (problemMinisIds.length > 0 && promiseModal?.isAvailable()) {
            const fixProblems = 'Change the visibility of all affected pieces';
            const visibilityString = getVisibilityString(visibility);
            const response = await promiseModal({
                children: (
                    <div>
                        <p>
                            A piece can only attach to pieces with the same or higher visibility.  Changing the
                            visibility of {mini.name} to {visibilityString} will thus cause problems for the
                            following {problemMinisIds.length === 1 ? 'piece' : 'pieces'}:
                            {joinAnd(problemMinisIds.map((miniId) => ('"' + scenario.minis[miniId].name + '"')))}
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
                    dispatch(updateMiniVisibilityAction(otherMiniId, visibility));
                }
                return true;
            }
            return false;
        }
        return true;
    }, [dispatch, promiseModal, store]);

    const isMiniLocked = useCallback((miniId: string): boolean => {
        const scenario = getScenarioFromStore(store.getState());
        for (let id: string | undefined = miniId; id; id = scenario.minis[id].attachMiniId) {
            if (scenario.minis[id].locked) {
                return true;
            }
        }
        return false;
    }, [store]);

    const confirmLargeFogOfWarAction = useCallback(async (mapIds: string[]): Promise<boolean> => {
        const scenario = getScenarioFromStore(store.getState());
        const complexFogMapIds = mapIds.filter((mapId) => {
            const {fogOfWar} = scenario.maps[mapId] ?? {};
            return fogOfWar && fogOfWar.reduce<boolean>((complex, bitmask) => (complex || (!!bitmask && bitmask !== -1)), false);
        });
        if (complexFogMapIds.length > 0 && promiseModal?.isAvailable()) {
            const mapNames = complexFogMapIds.length === 1
                ? 'Map "' + scenario.maps[complexFogMapIds[0]].name + '" has'
                : 'Maps "' + joinAnd(complexFogMapIds.map((mapId) => (scenario.maps[mapId].name)), '", "', '" and "') + '" have';
            const proceed = 'Proceed';
            const response = await promiseModal({
                children: `${mapNames} detailed fog-of-war coverage.  Are you sure you want to discard it?`,
                options: [proceed, 'Cancel']
            });
            return response === proceed;
        }
        return true;
    }, [promiseModal, store]);

    const buildGestureContext = useCallback((position?: ObjectVector2, targetElement?: Element): TabletopViewGestureContext => {
        const scenario = getScenarioFromStore(store.getState());
        const mapSelected = !myPeerId ? false : Object.values(scenario.maps).some(({selectedBy}) => (selectedBy === myPeerId));
        const fields: RayCastField[] = mapSelected ? ['mapId'] : ['miniId', 'mapId', 'dieRollId'];
        const intersect = readOnly || !position ? undefined
            : raycastForAllUserDataFields(position, fields)
                .find((intersection) => (
                    // Ignore locked minis for the purposes of gesture starts
                    intersection.type !== 'miniId' || !isMiniLocked(intersection.miniId)
                ));
        return {
            intersect,
            readOnly: readOnly,
            dragHandle: !!targetElement?.closest(`.${DRAG_HANDLE_CLASSNAME}`)
        };
    }, [isMiniLocked, myPeerId, raycastForAllUserDataFields, readOnly, store]);

    // Default gesture handler
    const onGestureStart = useCallback(() => {
        setMenuSelected(undefined);
    }, []);
    const onTap = useCallback((position: ObjectVector2) => {
        if (!disableTapMenu) {
            const scenario = getScenarioFromStore(store.getState());
            const allSelected = raycastForAllUserDataFields(position, ['mapId', 'miniId']);
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
                        name: intersect.type === 'mapId' ? scenario.maps[intersect.mapId].name : getPieceNameById(intersect.miniId)
                    }));
                    const selectIdType = sameType[0].type;
                    setMenuSelected({selected: {...selected, selectIdType, selectIds}, label: 'Which do you want to select?'});
                } else {
                    setMenuSelected({selected});
                    setEditSelected(undefined);
                }
            }
        }
    }, [disableTapMenu, getPieceNameById, raycastForAllUserDataFields, store]);
    const onPress = useCallback((position: ObjectVector2) => {
        // Long-press creates a ping on the position.
        const tabletop = getTabletopFromStore(store.getState());
        if (tabletop.gmOnlyPing && !userIsGM) {
            // unless the GM has disabled pings for players and they're a player.
            return;
        }
        let intercept: Vector3;
        let nextFocusMapId: string | undefined;
        const pingTarget = raycastForFirstUserDataFields(position, ['mapId', 'miniId']);
        const scenario = getScenarioFromStore(store.getState());
        if (pingTarget) {
            intercept = pingTarget.point;
            const onMapId = pingTarget.type === 'miniId' ? scenario.minis[pingTarget.miniId].onMapId : undefined;
            const onMap = onMapId ? scenario.maps[onMapId] : undefined;
            nextFocusMapId = (pingTarget.type === 'mapId') ? pingTarget.mapId : (onMap ? onMapId : undefined) || nextFocusMapId;
        } else {
            // ping the intercept with the plane of the current focus map (or 0, if none)
            const focusMapY = nextFocusMapId && scenario.maps[nextFocusMapId]
                ? scenario.maps[nextFocusMapId].position.y : 0;
            const planePoint = raycastToPlane(position, focusMapY);
            if (!planePoint) {
                return;
            }
            intercept = planePoint;
            nextFocusMapId = focusMapId;
        }
        dispatch(addPingAction(vector3ToObject(intercept), myPeerId!, nextFocusMapId));
    }, [dispatch, focusMapId, myPeerId, raycastForFirstUserDataFields, raycastToPlane, store, userIsGM]);
    const defaultGestureHandler = useMemo(() => ({
        id: 'tabletopViewHandler',
        onGestureStart,
        onTap,
        onPress
    }), [onGestureStart, onPress, onTap]);

    const cameraLookingDown = (cameraLookAt.y < cameraPosition.y);

    const selectInterestLevelY = useCallback((state: ReduxStoreType) => {
        // If the camera is looking down, return the Y level just below the first map above the focus map, or one level
        // above the top map if the top map has the focus.  However, if we have a map selected, use that map's Y level
        // if it's higher.
        // Otherwise, reverse the above tests (above/higher instead of below/lower and vice versa, bottom map instead of
        // top etc.)
        const scenario = getScenarioFromStore(state);
        const nextMapId = getMapIdOnNextLevel(cameraLookingDown ? 1 : -1, scenario.maps, focusMapId, false);
        const delta = cameraLookingDown ? MAP_DELTA : -MAP_DELTA;
        const offset = cameraLookingDown ? NEW_MAP_DELTA_Y : -NEW_MAP_DELTA_Y;
        const levelBeyondY = nextMapId ? scenario.maps[nextMapId].position.y - delta
            : focusMapId && scenario.maps[focusMapId]
                ? scenario.maps[focusMapId].position.y + offset
                : offset;
        const mapId = !myPeerId ? undefined : Object.keys(scenario.maps)
            .find((mapId) => (scenario.maps[mapId].selectedBy === myPeerId));
        if (mapId) {
            const selectedMapY = scenario.maps[mapId].position.y;
            return cameraLookingDown ? Math.max(levelBeyondY, selectedMapY) : Math.min(levelBeyondY, selectedMapY);
        } else {
            return levelBeyondY;
        }
    }, [cameraLookingDown, focusMapId, myPeerId]);
    const interestLevelY = useSelector(selectInterestLevelY);

    const topDown = useMemo(() => (
        isTopDown(cameraPosition, cameraLookAt)
    ), [cameraLookAt, cameraPosition]);

    return (
        <div className='canvas'>
            <ResizeDetector handleWidth={true} handleHeight={true} onResize={onResize} />
            <GestureControls buildContext={buildGestureContext} defaultHandler={defaultGestureHandler}>
                <CanvasContextBridge
                    style={size}
                    frameloop='demand'
                    onCreated={({gl, camera, scene}) => {
                        gl.setClearColor(BACKGROUND_COLOUR);
                        gl.setClearAlpha(1);
                        gl.toneMapping = NoToneMapping;
                        gl.outputEncoding = LinearEncoding;
                        setThreeCamera(camera);
                        setThreeScene(scene);
                    }}
                    linear={true} flat={true}
                >
                    <ControlledCamera position={cameraPosition}
                                      lookAt={cameraLookAt}
                                      near={0.1}
                                      far={maxCameraDistance}
                                      setCamera={setCamera}
                                      cameraView={cameraView}
                    />
                    <ambientLight />
                    <pointLight intensity={0.6} position={cameraPosition} />
                    <TabletopMapLayer interestLevelY={interestLevelY}
                                      cameraLookingDown={cameraLookingDown}
                                      gmView={userIsGM && !playerView}
                                      snapToGrid={snapToGrid}
                                      dispatch={dispatch}
                                      setCamera={setCamera}
                    />
                    <TabletopMiniLayer snapToGrid={snapToGrid}
                                       interestLevelY={interestLevelY}
                                       cameraLookingDown={cameraLookingDown}
                                       topDown={topDown}
                                       gmView={userIsGM && !playerView}
                                       labelSize={labelSize}
                    />
                    <TabletopFogOfWar setCamera={setCamera}
                                      setMenuSelected={setMenuSelected}
                    />
                    <TabletopElasticBand userIsGM={userIsGM}
                                         focusMapId={focusMapId}
                    />
                    <TabletopDiceLayer interestLevelY={interestLevelY} />
                    <TabletopPingsComponent setCamera={setCamera}
                                            sideMenuOpen={sideMenuOpen}
                    />
                    <TabletopRulers snapToGrid={snapToGrid}
                                    labelSize={labelSize}
                    />
                    <PaintGestureHandler />
                </CanvasContextBridge>
                <TabletopDragHandle className={DRAG_HANDLE_CLASSNAME}
                                    setMenuSelected={setMenuSelected}
                />
            </GestureControls>
            <TabletopContextMenu menuSelected={menuSelected}
                                 setMenuSelected={setMenuSelected}
                                 setEditSelected={setEditSelected}
                                 setCamera={setCamera}
                                 focusMapId={focusMapId}
                                 setFocusMapId={setFocusMapId}
                                 confirmLargeFogOfWarAction={confirmLargeFogOfWarAction}
                                 replaceMapImageFn={replaceMapImageFn}
                                 verifyMiniVisibility={verifyMiniVisibility}
                                 userIsGM={userIsGM && !playerView}
                                 findPositionForNewMini={findPositionForNewMini}
                                 findUnusedMiniName={findUnusedMiniName}
            />
            <TabletopEditSelected editSelected={editSelected}
                                  clearEditSelected={clearEditSelected}
                                  camera={threeCamera}
                                  width={size.width}
                                  height={size.height}
            />
            <GmNoteEditor />
        </div>
    );
}

export default TabletopViewComponent;

function isSelectionValid(scenario: ScenarioType, selected?: TabletopViewComponentSelected) {
    return !selected ? true
        : selected.miniId ? scenario.minis[selected.miniId] !== undefined
            : selected.mapId ? scenario.maps[selected.mapId] !== undefined
                : true;
}

function addAttachedMinisWithHigherVisibility(minis: {[miniId: string]: MiniType}, miniId: string, visibility: PieceVisibilityEnum, miniIds: string[]) {
    for (let otherMiniId of Object.keys(minis)) {
        const otherMini = minis[otherMiniId];
        if (otherMini.attachMiniId === miniId && otherMini.visibility > visibility) {
            miniIds.push(otherMiniId);
            addAttachedMinisWithHigherVisibility(minis, otherMiniId, visibility, miniIds);
        }
    }
}

function selectMaxCameraDistance(state: ReduxStoreType) {
    const maps = getScenarioFromStore(state).maps;
    const maxMapDimension = Object.keys(maps).reduce((max, mapId) => {
        const {width, height} = maps[mapId].metadata.properties || {width: 10, height: 10};
        return Math.max(max, width, height);
    }, 0);
    return Math.max(2 * maxMapDimension, 50);
}
