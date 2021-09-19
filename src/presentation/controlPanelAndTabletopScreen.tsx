import {FunctionComponent, useCallback, useContext, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import classNames from 'classnames';
import THREE from 'three';

import './controlPanelAndTabletopScreen.scss';

import {
    getFocusMapIdAndFocusPointAtLevel,
    getNetworkHubId,
    getUserDiceColours,
    isTabletopLockedForPeer,
    MovementPathPoint,
    ObjectVector3
} from '../util/scenarioUtils';
import {
    getAllFilesFromStore,
    getConnectedUsersFromStore,
    getDiceFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getPingsFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getUndoableHistoryFromStore
} from '../redux/mainReducer';
import KeyDownHandler from '../container/keyDownHandler';
import {redoAction, undoAction, updateConfirmMovesAction, updateSnapToGridAction} from '../redux/scenarioReducer';
import TabletopViewComponent, {TabletopViewComponentCameraView} from './tabletopViewComponent';
import MovableWindow from './movableWindow';
import DiceBag from './diceBag';
import PiecesRoster from './piecesRoster';
import {buildVector3} from '../util/threeUtils';
import PaintTools, {initialPaintState, PaintState} from './paintTools';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import {DisableGlobalKeyboardHandlerContextBridge} from '../context/disableGlobalKeyboardHandlerContextBridge';
import {
    SetCameraFunction,
    VirtualGamingTabletopCameraState,
    VirtualGamingTabletopMode
} from './virtualGamingTabletop';
import MenuControlPanel from './menuControlPanel';
import AvatarsComponent from './avatarsComponent';
import FileErrorModalComponent from './fileErrorModalComponent';
import {useStateWithCallback} from '../util/reactUtils';

interface ControlPanelAndTabletopScreenProps {
    hidden: boolean;
    readOnly: boolean;
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    setCamera: SetCameraFunction;
    focusMapId?: string;
    setFocusMapId: (mapId: string, panCamera?: boolean) => void;
    findPositionForNewMini: (allowHiddenMap: boolean, scale: number, basePosition?: THREE.Vector3 | ObjectVector3) => MovementPathPoint;
    findUnusedMiniName: (baseName: string, suffix?: number, space?: boolean) => [string, number];
    cameraView?: TabletopViewComponentCameraView;
    replaceMapImage?: (metadataId: string) => void;
    changeFocusLevel: (direction: 1 | -1) => void;
    getDefaultCameraFocus: (levelMapId?: string | null) => VirtualGamingTabletopCameraState;
    fullScreen: boolean;
    setFullScreen: (set: boolean) => void;
    setCurrentScreen: (state: VirtualGamingTabletopMode) => void;
    isGMConnected: boolean;
    savingTabletop: number;
    hasUnsavedChanges: boolean;
    updateVersionNow: () => void;
    replaceMetadata: (isMap: boolean, metadataId: string) => void;
}

export type DragModeType = 'measureDistanceMode' | 'elasticBandMode' | 'fogOfWarMode';

const ControlPanelAndTabletopScreen: FunctionComponent<ControlPanelAndTabletopScreenProps> = (props) => {
    const {
        hidden, readOnly, cameraPosition, cameraLookAt, setCamera, focusMapId, setFocusMapId,
        findPositionForNewMini, findUnusedMiniName, cameraView, replaceMapImage,
        changeFocusLevel, getDefaultCameraFocus, fullScreen, setFullScreen, setCurrentScreen,
        isGMConnected, savingTabletop, hasUnsavedChanges, updateVersionNow, replaceMetadata
    } = props;
    const tabletop = useSelector(getTabletopFromStore);
    const scenario = useSelector(getScenarioFromStore);
    const files = useSelector(getAllFilesFromStore);
    const loggedInUser = useSelector(getLoggedInUserFromStore)!;
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const [disableGlobalKeyboardHandler, setDisableGlobalKeyboardHandler] = useState(false);
    const loggedInUserIsGM = useMemo(() => (
        loggedInUser?.emailAddress === tabletop.gm
    ), [loggedInUser, tabletop]);
    const dispatch = useDispatch();
    const promiseModal = useContext(PromiseModalContextObject);
    const dispatchUndoRedoAction = useCallback(async (undo: boolean) => {
        if (!loggedInUserIsGM) {
            return;
        } else if (Object.keys(connectedUsers.users).length > 1 && tabletop.tabletopLockedPeerId !== myPeerId) {
            if (!promiseModal?.isAvailable()) {
                return;
            }
            const canLock = !isTabletopLockedForPeer(tabletop, connectedUsers.users, myPeerId, true);
            const lockTabletop = 'Lock the tabletop';
            const response = await promiseModal({
                children: 'You cannot undo or redo changes to the tabletop while other people are connected, unless you lock the tabletop for everyone else first.',
                options: canLock ? [lockTabletop, 'OK'] : ['OK']
            });
            if (response === lockTabletop) {
                dispatch(updateTabletopAction({tabletopLockedPeerId: myPeerId!}));
            }
        } else {
            dispatch(undo ? undoAction() : redoAction());
        }
    }, [connectedUsers, dispatch, loggedInUserIsGM, myPeerId, promiseModal, tabletop]);
    const networkHubId = getNetworkHubId(loggedInUser.emailAddress, myPeerId, tabletop.gm, connectedUsers.users) || undefined;
    const [dragMode, setDragMode] = useState<undefined | DragModeType>();
    const toggleDragMode = useCallback((mode?: DragModeType) => {
        setDragMode((dragMode) => (
            (dragMode === mode) ? undefined : mode
        ));
    }, []);
    const [playerView, setPlayerView] = useState(false);
    const [labelSize, setLabelSize] = useState(0.35);
    const dice = useSelector(getDiceFromStore);
    const pings = useSelector(getPingsFromStore);
    const [panelOpen, setPanelOpen] = useState(true);
    const [diceBagOpen, setDiceBagOpen] = useState(false);
    const [pinDiceBag, setPinDiceBag] = useState(false);
    const [showPiecesRoster, setShowPiecesRoster] = useState(false);
    const [paintState, setPaintState] = useStateWithCallback(initialPaintState);
    const updatePaintState = useCallback((update: Partial<PaintState>, callback?: () => void) => {
        setPaintState((old) => ({...old, ...update}), callback);
    }, [setPaintState]);
    const history = useSelector(getUndoableHistoryFromStore);
    const disableKeyDownHandler = useCallback(() => (
        disableGlobalKeyboardHandler || !promiseModal?.isAvailable()
    ), [disableGlobalKeyboardHandler, promiseModal])
    return (
        <div className={classNames('controlFrame', {hidden})}>
            <DisableGlobalKeyboardHandlerContextBridge value={setDisableGlobalKeyboardHandler}>
                <KeyDownHandler disabled={disableKeyDownHandler} keyMap={{
                    'z': {modifiers: {metaKey: true}, callback: () => (dispatchUndoRedoAction(true))},
                    'y': {modifiers: {metaKey: true}, callback: () => (dispatchUndoRedoAction(false))},
                    'r': {callback: () => {toggleDragMode('measureDistanceMode')}},
                    'e': {callback: () => {toggleDragMode('elasticBandMode')}},
                    'f': {callback: () => {loggedInUserIsGM && toggleDragMode('fogOfWarMode')}},
                    'm': {callback: () => {loggedInUserIsGM && dispatch(updateConfirmMovesAction(!scenario.confirmMoves))}},
                    's': {callback: () => {loggedInUserIsGM && dispatch(updateSnapToGridAction(!scenario.snapToGrid))}},
                    'v': {callback: () => {loggedInUserIsGM && setPlayerView((playerView) => (!playerView))}}
                }}/>
                <MenuControlPanel
                    panelOpen={panelOpen}
                    setPanelOpen={setPanelOpen}
                    readOnly={readOnly}
                    loggedInUserIsGM={loggedInUserIsGM}
                    myPeerId={myPeerId}
                    connectedUsers={connectedUsers}
                    tabletop={tabletop}
                    scenario={scenario}
                    focusMapId={focusMapId}
                    canUndo={history.past.length > 0}
                    canRedo={history.future.length > 0}
                    dispatchUndoRedoAction={dispatchUndoRedoAction}
                    fogOfWarMode={dragMode === 'fogOfWarMode'}
                    toggleDragMode={toggleDragMode}
                    paintState={paintState}
                    updatePaintState={updatePaintState}
                    playerView={playerView}
                    setPlayerView={setPlayerView}
                    labelSize={labelSize}
                    setLabelSize={setLabelSize}
                    changeFocusLevel={changeFocusLevel}
                    setCamera={setCamera}
                    getDefaultCameraFocus={getDefaultCameraFocus}
                    fullScreen={fullScreen}
                    setFullScreen={setFullScreen}
                    diceBagOpen={diceBagOpen}
                    setDiceBagOpen={setDiceBagOpen}
                    pinDiceBag={pinDiceBag}
                    setPinDiceBag={setPinDiceBag}
                    setShowPiecesRoster={setShowPiecesRoster}
                    measureDistanceMode={dragMode === 'measureDistanceMode'}
                    elasticBandMode={dragMode === 'elasticBandMode'}
                    isCurrentUserPlayer={!loggedInUserIsGM}
                    setCurrentScreen={setCurrentScreen}
                    clearDragMode={toggleDragMode}
                />
                <AvatarsComponent connectedUsers={connectedUsers}
                                  loggedInUser={loggedInUser}
                                  myPeerId={myPeerId}
                                  setCurrentScreen={setCurrentScreen}
                                  tabletop={tabletop}
                                  gmConnected={isGMConnected}
                                  savingTabletop={savingTabletop}
                                  hasUnsavedChanges={hasUnsavedChanges}
                                  updateVersionNow={updateVersionNow}
                />
                <FileErrorModalComponent loggedInUserIsGM={loggedInUserIsGM} replaceMetadata={replaceMetadata} />
                <div className='mainArea'>
                    <TabletopViewComponent
                        scenario={scenario}
                        tabletop={tabletop}
                        fullDriveMetadata={files.driveMetadata}
                        dispatch={dispatch}
                        cameraPosition={cameraPosition}
                        cameraLookAt={cameraLookAt}
                        setCamera={setCamera}
                        focusMapId={focusMapId}
                        setFocusMapId={setFocusMapId}
                        readOnly={readOnly}
                        disableTapMenu={readOnly}
                        fogOfWarMode={dragMode === 'fogOfWarMode'}
                        endFogOfWarMode={toggleDragMode}
                        measureDistanceMode={dragMode === 'measureDistanceMode'}
                        endMeasureDistanceMode={toggleDragMode}
                        elasticBandMode={dragMode === 'elasticBandMode'}
                        endElasticBandMode={toggleDragMode}
                        snapToGrid={scenario.snapToGrid}
                        userIsGM={loggedInUserIsGM}
                        playerView={playerView}
                        labelSize={labelSize}
                        findPositionForNewMini={findPositionForNewMini}
                        findUnusedMiniName={findUnusedMiniName}
                        myPeerId={myPeerId}
                        cameraView={cameraView}
                        replaceMapImageFn={replaceMapImage}
                        dice={dice}
                        networkHubId={networkHubId}
                        pings={pings}
                        connectedUsers={connectedUsers}
                        sideMenuOpen={panelOpen}
                        paintState={paintState}
                        updatePaintState={updatePaintState}
                    />
                </div>
                {
                    !diceBagOpen || !myPeerId ? null : (
                        <MovableWindow title='Dice Bag' onClose={() => {setDiceBagOpen(false)}}>
                            <DiceBag dice={dice} dispatch={dispatch} pinOpen={pinDiceBag}
                                     userDiceColours={getUserDiceColours(tabletop, loggedInUser.emailAddress)}
                                     myPeerId={myPeerId} connectedUsers={connectedUsers}
                                     onClose={() => {setDiceBagOpen(false)}}
                            />
                        </MovableWindow>
                    )
                }
                {
                    !showPiecesRoster ? null : (
                        <MovableWindow title='Tabletop Pieces Roster' onClose={() => {setShowPiecesRoster(false)}}>
                            <PiecesRoster minis={scenario.minis}
                                          piecesRosterColumns={tabletop.piecesRosterColumns}
                                          playerView={!loggedInUserIsGM || playerView}
                                          readOnly={readOnly}
                                          focusCamera={(position: ObjectVector3) => {
                                              const newCameraLookAt = buildVector3(position);
                                              const {focusMapId} = getFocusMapIdAndFocusPointAtLevel(scenario.maps, position.y);
                                              // Simply shift the cameraPosition by the same delta as we're shifting the cameraLookAt.
                                              const newCameraPosition = newCameraLookAt.clone().sub(cameraLookAt).add(cameraPosition);
                                              setCamera({cameraLookAt: newCameraLookAt, cameraPosition: newCameraPosition}, 1000, focusMapId);
                                          }}
                            />
                        </MovableWindow>
                    )
                }
                {
                    !paintState.open ? null : (
                        <MovableWindow title='Paint' onClose={() => {updatePaintState({open: false})}}>
                            <PaintTools
                                paintState={paintState}
                                updatePaintState={updatePaintState}
                                paintToolColourSwatches={tabletop.paintToolColourSwatches}
                                updatePaintToolColourSwatches={(paintToolColourSwatches) => {
                                    dispatch(updateTabletopAction({paintToolColourSwatches}));
                                }}
                            />
                        </MovableWindow>
                    )
                }
            </DisableGlobalKeyboardHandlerContextBridge>
        </div>
    );
};

export default ControlPanelAndTabletopScreen;