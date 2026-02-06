import {FunctionComponent, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import classNames from 'classnames';
import THREE from 'three';

import './screenControlPanelAndTabletop.scss';

import {
    getNetworkHubId,
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
import {initialPaintState, PaintState} from './paintTools';
import TabletopMoveableWindows from '../container/tabletopMoveableWindows';
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
import {FileMetadata, MiniProperties} from '../util/storage/storageContract';
import {DragDropPasteUploadContainer} from '../container/dragDropPasteUploadContainer';
import {FOLDER_MINI} from '../util/constants';

interface ScreenControlPanelAndTabletopProps {
    hidden: boolean;
    readOnly: boolean;
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
    setCamera: SetCameraFunction;
    focusMapId?: string;
    setFocusMapId: (mapId: string, panCamera?: boolean) => void;
    findPositionForNewMini: (allowHiddenMap: boolean, scale?: number, basePosition?: THREE.Vector3 | ObjectVector3) => MovementPathPoint;
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
    placeMini: (metadata: FileMetadata<void, MiniProperties>) => void;
    saveTabletop: () => void;
}

export type DragModeType = 'measureDistanceMode' | 'elasticBandMode' | 'fogOfWarMode';

const ScreenControlPanelAndTabletop: FunctionComponent<ScreenControlPanelAndTabletopProps> = (props) => {
    const {
        hidden, readOnly, cameraPosition, cameraLookAt, setCamera, focusMapId, setFocusMapId,
        findPositionForNewMini, findUnusedMiniName, cameraView, replaceMapImage,
        changeFocusLevel, getDefaultCameraFocus, fullScreen, setFullScreen, setCurrentScreen,
        isGMConnected, savingTabletop, hasUnsavedChanges, updateVersionNow, replaceMetadata,
        placeMini, saveTabletop
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
    const onDropMinis = useCallback((metadataList: FileMetadata[]) => {
        for (const metadata of metadataList) {
            placeMini(metadata as FileMetadata<void, MiniProperties>);
        }
    }, [placeMini]);
    const [playerView, setPlayerView] = useState(false);
    const [labelSize, setLabelSize] = useState(tabletop.defaultLabelSize ?? 0.35);
    useEffect(() => {
        if (tabletop.defaultLabelSize) {
            setLabelSize(tabletop.defaultLabelSize);
        }
    }, [tabletop.defaultLabelSize]);
    const dice = useSelector(getDiceFromStore);
    useEffect(() => {
        if (dice.historyIds.length) {
            saveTabletop();
        }
    }, [dice, saveTabletop]);
    const pings = useSelector(getPingsFromStore);
    const [panelOpen, setPanelOpen] = useState(true);
    const [diceBagOpen, setDiceBagOpen] = useState(false);
    const [showPiecesRoster, setShowPiecesRoster] = useState(false);
    const [paintState, setPaintState] = useStateWithCallback(initialPaintState);
    const updatePaintState = useCallback((update: Partial<PaintState>, callback?: () => void) => {
        setPaintState((old) => ({...old, ...update}), callback);
    }, [setPaintState]);
    const history = useSelector(getUndoableHistoryFromStore);
    const disableKeyDownHandler = useCallback(() => (
        disableGlobalKeyboardHandler || !promiseModal?.isAvailable() || hidden
    ), [disableGlobalKeyboardHandler, promiseModal, hidden])
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
                    setDiceBagOpen={setDiceBagOpen}
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
                <FileErrorModalComponent loggedInUserIsGM={loggedInUserIsGM} replaceMetadata={replaceMetadata} hidden={hidden} />
                <div className='mainArea'>
                    <DragDropPasteUploadContainer topDirectory={FOLDER_MINI} onPlaceholdersCreated={onDropMinis} disabled={hidden}>
                        <TabletopViewComponent
                            scenario={scenario}
                            tabletop={tabletop}
                            fullDriveMetadata={files.fileMetadata}
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
                    </DragDropPasteUploadContainer>
                </div>
                <TabletopMoveableWindows diceBagOpen={myPeerId !== null && diceBagOpen}
                                         setDiceBagOpen={setDiceBagOpen}
                                         showPiecesRoster={showPiecesRoster}
                                         setShowPiecesRoster={setShowPiecesRoster}
                                         playerView={!loggedInUserIsGM || playerView}
                                         readOnly={readOnly}
                                         cameraLookAt={cameraLookAt}
                                         cameraPosition={cameraPosition}
                                         setCamera={setCamera}
                                         paintState={paintState}
                                         updatePaintState={updatePaintState}
                />
            </DisableGlobalKeyboardHandlerContextBridge>
        </div>
    );
};

export default ScreenControlPanelAndTabletop;