import './tabletopViewComponent.scss';

import {useContextBridge} from '@react-three/drei';
import {Canvas} from '@react-three/fiber';
import {FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react';
import {ReactReduxContext, useDispatch, useSelector, useStore} from 'react-redux';
import ResizeDetector from 'react-resize-detector';
import {Camera, Color, LinearEncoding, NoToneMapping, Object3D, Scene, Vector2, Vector3} from 'three';

import ControlledCamera from '../container/controlledCamera';
import GestureControls from '../container/gestureControls';
import PaintGestureHandler from '../container/paintGestureHandler';
import {CameraParametersContextObject} from '../context/cameraParametersProvider';
import {FileAPIContextObject, TextureLoaderContextObject} from '../context/fileAPIProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {RayCastField, RayCastIntersect, useThreeRaycast} from '../hooks/useRaycast';
import {
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {addPingAction} from '../redux/pingReducer';
import {DragModeType} from '../redux/tabletopStateReducerTypes';
import {MAP_DELTA, NEW_MAP_DELTA_Y} from '../util/constants';
import {getMapIdOnNextLevel, ObjectVector2, ScenarioType} from '../util/scenarioUtils';
import {vector3ToObject} from '../util/threeUtils';
import CameraPointLight from './cameraPointLight';
import GmNoteEditor from './gmNoteEditor';
import TabletopDiceLayer from './tabletopDiceLayer';
import TabletopDragHandle from './tabletopDragHandle';
import TabletopEditSelected from './tabletopEditSelected';
import TabletopElasticBand from './tabletopElasticBand';
import TabletopFogOfWar from './tabletopFogOfWar';
import {TabletopMapLayer} from './tabletopMapLayer';
import {TabletopMiniLayer} from './tabletopMiniLayer';
import TabletopPingsComponent from './tabletopPingsComponent';
import TabletopRulers from './tabletopRulers';
import TabletopTapMenu, {TabletopTapMenuGestureHandler} from './tabletopTapMenu';
import {ToastContextObject} from './toastProvider';

export interface TabletopViewComponentSelected {
    mapId?: string;
    miniId?: string;
    position?: Vector2;
    object?: Object3D;
}

export interface TabletopViewComponentEditSelected {
    selected: TabletopViewComponentSelected;
    value: string;
    finish: (value: string) => void;
}

export type TabletopViewGestureContext<Intersect extends RayCastIntersect | undefined = RayCastIntersect | undefined> = {
    allIntersects: RayCastIntersect[];
    intersect: Intersect;
    readOnly: boolean;
    dragHandle: boolean;
    dragMode?: DragModeType;
};

const BACKGROUND_COLOUR = new Color(0x808080);
const DRAG_HANDLE_CLASSNAME = 'dragCameraHandle';
const TAP_MENU_ID = 'tap-menu-target';

interface TabletopViewComponentProps {
    userIsGM: boolean;
    readOnly: boolean;
    playerView: boolean;
    labelSize: number;
    disableTapMenu?: boolean;
}

const TabletopViewComponent: FunctionComponent<TabletopViewComponentProps> = ({
                                                                                  userIsGM,
                                                                                  readOnly,
                                                                                  playerView,
                                                                                  labelSize,
                                                                                  disableTapMenu,
}) => {
    
    const dispatch = useDispatch();
    const store = useStore();
    const maxCameraDistance = useSelector(selectMaxCameraDistance);

    const [editSelected, setEditSelected] = useState<undefined | TabletopViewComponentEditSelected>();
    const clearEditSelected = useCallback(() => {
        setEditSelected(undefined);
    }, []);
    const [size, setSize] = useState({width: 0, height: 0});
    const onResize = useCallback((width?: number, height?: number) => {
        setSize({width: width ?? 0, height: height ?? 0});
    }, []);

    const [threeCamera, setThreeCamera] = useState(new Camera());
    const [threeScene, setThreeScene] = useState(new Scene());
    const {raycastForAllUserDataFields, raycastForFirstUserDataFields, raycastToPlane} = useThreeRaycast(threeCamera, threeScene, size.width, size.height);
    
    // Ensure edit selection is still present.
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

    const isMiniLocked = useCallback((miniId: string): boolean => {
        const scenario = getScenarioFromStore(store.getState());
        for (let id: string | undefined = miniId; id; id = scenario.minis[id].attachMiniId) {
            if (scenario.minis[id].locked) {
                return true;
            }
        }
        return false;
    }, [store]);

    const buildGestureContext = useCallback((position?: ObjectVector2, targetElement?: Element): TabletopViewGestureContext => {
        const scenario = getScenarioFromStore(store.getState());
        const myPeerId = getMyPeerIdFromStore(store.getState());
        const {dragMode} = getTabletopStateFromStore(store.getState());
        const mapSelected = !myPeerId ? false : Object.values(scenario.maps).some(({selectedBy}) => (selectedBy === myPeerId));
        const fields: RayCastField[] = mapSelected ? ['mapId'] : ['miniId', 'mapId', 'dieRollId'];
        const allIntersects = readOnly || !position ? []
            : raycastForAllUserDataFields(position, fields);
        const intersect = allIntersects
            .find((intersection) => (
                // Ignore locked minis for the purposes of gesture starts
                intersection.type !== 'miniId' || !isMiniLocked(intersection.miniId)
            ));
        return {
            allIntersects,
            intersect,
            readOnly: readOnly,
            dragHandle: !!targetElement?.closest(`.${DRAG_HANDLE_CLASSNAME}`),
            dragMode
        };
    }, [isMiniLocked, raycastForAllUserDataFields, readOnly, store]);

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
        const {focusMapId} = getTabletopStateFromStore(store.getState());
        const myPeerId = getMyPeerIdFromStore(store.getState());
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
    }, [dispatch, raycastForFirstUserDataFields, raycastToPlane, store, userIsGM]);
    const defaultGestureHandler = useMemo(() => ({
        id: 'tabletopViewHandler',
        onPress
    }), [onPress]);

    const selectInterestLevelY = useCallback((state: ReduxStoreType) => {
        // If the camera is looking down, return the Y level just below the first map above the focus map, or one level
        // above the top map if the top map has the focus.  However, if we have a map selected, use that map's Y level
        // if it's higher.
        // Otherwise, reverse the above tests (above/higher instead of below/lower and vice versa, bottom map instead of
        // top etc.)
        const scenario = getScenarioFromStore(state);
        const {isLookingDown, focusMapId} = getTabletopStateFromStore(state);
        const myPeerId = getMyPeerIdFromStore(state);
        const nextMapId = getMapIdOnNextLevel(isLookingDown ? 1 : -1, scenario.maps, focusMapId, false);
        const delta = isLookingDown ? MAP_DELTA : -MAP_DELTA;
        const offset = isLookingDown ? NEW_MAP_DELTA_Y : -NEW_MAP_DELTA_Y;
        const levelBeyondY = nextMapId ? scenario.maps[nextMapId].position.y - delta
            : focusMapId && scenario.maps[focusMapId]
                ? scenario.maps[focusMapId].position.y + offset
                : offset;
        const mapId = !myPeerId ? undefined : Object.keys(scenario.maps)
            .find((mapId) => (scenario.maps[mapId].selectedBy === myPeerId));
        if (mapId) {
            const selectedMapY = scenario.maps[mapId].position.y;
            return isLookingDown ? Math.max(levelBeyondY, selectedMapY) : Math.min(levelBeyondY, selectedMapY);
        } else {
            return levelBeyondY;
        }
    }, []);
    const interestLevelY = useSelector(selectInterestLevelY);

    // Context is lost inside the Canvas renderer: https://github.com/pmndrs/react-three-fiber/issues/43
    // The workaround is to explicitly forward context defined outside the Canvas to components inside, which is exactly
    // what this Drei hook does.
    const ContextBridge = useContextBridge(
        ReactReduxContext,
        FileAPIContextObject,
        TextureLoaderContextObject,
        PromiseModalContextObject,
        ToastContextObject,
        CameraParametersContextObject,
    );

    return (
        <div className='tabletopViewComponent'>
            <ResizeDetector handleWidth={true} handleHeight={true} onResize={onResize} />
            <TabletopTapMenu disableTapMenu={disableTapMenu} userIsGM={userIsGM}>
                <GestureControls buildContext={buildGestureContext} defaultHandler={defaultGestureHandler}>
                    <TabletopTapMenuGestureHandler />
                    <Canvas
                        style={size}
                        frameloop='demand'
                        onCreated={({gl, camera, scene}) => {
                            gl.setClearColor(BACKGROUND_COLOUR);
                            gl.setClearAlpha(1);
                            gl.toneMapping = NoToneMapping;
                            gl.outputEncoding = LinearEncoding;
                            // Stop R3F from auto-setting the camera's aspect ratio, because we're using viewOffsets
                            camera.manual = true;
                            setThreeCamera(camera);
                            setThreeScene(scene);
                        }}
                        linear={true} flat={true}
                    >
                        <ContextBridge>
                            <ControlledCamera near={0.1} far={maxCameraDistance} />
                            <ambientLight />
                            <CameraPointLight />
                            <TabletopMapLayer interestLevelY={interestLevelY}
                                              gmView={userIsGM && !playerView}
                            />
                            <TabletopMiniLayer interestLevelY={interestLevelY}
                                               gmView={userIsGM && !playerView}
                                               labelSize={labelSize}
                                               setEditSelected={setEditSelected}
                            />
                            <TabletopFogOfWar />
                            <TabletopElasticBand userIsGM={userIsGM} />
                            <TabletopDiceLayer interestLevelY={interestLevelY} />
                            <TabletopPingsComponent />
                            <TabletopRulers labelSize={labelSize} />
                            <PaintGestureHandler />
                        </ContextBridge>
                    </Canvas>
                    <TabletopDragHandle className={DRAG_HANDLE_CLASSNAME} />
                </GestureControls>
            </TabletopTapMenu>
            <TabletopEditSelected editSelected={editSelected}
                                  clearEditSelected={clearEditSelected}
                                  camera={threeCamera}
                                  width={size.width}
                                  height={size.height}
            />
            <GmNoteEditor />
            <div id={TAP_MENU_ID} />
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

function selectMaxCameraDistance(state: ReduxStoreType) {
    const maps = getScenarioFromStore(state).maps;
    const maxMapDimension = Object.keys(maps).reduce((max, mapId) => {
        const {width, height} = maps[mapId].metadata.properties || {width: 10, height: 10};
        return Math.max(max, width, height);
    }, 0);
    return Math.max(2 * maxMapDimension, 50);
}
