import './screenControlPanelAndTabletop.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {DragDropPasteUploadContainer} from '../container/dragDropPasteUploadContainer';
import KeyDownHandler from '../container/keyDownHandler';
import TabletopMoveableWindows from '../container/tabletopMoveableWindows';
import {DisableGlobalKeyboardHandlerContextBridge} from '../context/disableGlobalKeyboardHandlerContextBridge';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import {
    getConnectedUsersFromStore,
    getDiceFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore,
    getUndoableHistoryFromStore
} from '../redux/mainReducer';
import {redoAction, undoAction, updateConfirmMovesAction, updateSnapToGridAction} from '../redux/scenarioReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {toggleTabletopStateDragModeAction, toggleTabletopStatePlayerViewAction} from '../redux/tabletopStateReducer';
import {DragModeType} from '../redux/tabletopStateReducerTypes';
import {FOLDER_MINI} from '../util/constants';
import {isTabletopLockedForPeer, selectConfirmMovesAndSnapToGridFromScenario} from '../util/scenarioUtils';
import {FileMetadata, MiniProperties} from '../util/storage/storageContract';
import AvatarsComponent from './avatarsComponent';
import FileErrorModalComponent from './fileErrorModalComponent';
import {GToveMode} from './gTove';
import MenuControlPanel from './menuControlPanel';
import TabletopViewComponent from './tabletopViewComponent';

interface ScreenControlPanelAndTabletopProps {
    hidden: boolean;
    readOnly: boolean;
    replaceMapImage?: (metadataId: string) => void;
    changeFocusLevel: (direction: 1 | -1) => void;
    fullScreen: boolean;
    setFullScreen: (set: boolean) => void;
    setCurrentScreen: (state: GToveMode) => void;
    isGMConnected: boolean;
    savingTabletop: number;
    hasUnsavedChanges: boolean;
    replaceMetadata: (isMap: boolean, metadataId: string) => void;
    placeMini: (metadata: FileMetadata<void, MiniProperties>) => void;
    saveTabletop: () => void;
}

const ScreenControlPanelAndTabletop: FunctionComponent<ScreenControlPanelAndTabletopProps> = ({
                                                                                                  hidden,
                                                                                                  readOnly,
                                                                                                  replaceMapImage,
                                                                                                  changeFocusLevel,
                                                                                                  fullScreen,
                                                                                                  setFullScreen,
                                                                                                  setCurrentScreen,
                                                                                                  isGMConnected,
                                                                                                  savingTabletop,
                                                                                                  hasUnsavedChanges,
                                                                                                  replaceMetadata,
                                                                                                  placeMini,
                                                                                                  saveTabletop
                                                                                              }) => {
    const tabletop = useSelector(getTabletopFromStore);
    const loggedInUser = useSelector(getLoggedInUserFromStore)!;
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const {confirmMoves, snapToGrid} = useSelector(selectConfirmMovesAndSnapToGridFromScenario, shallowEqual);

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
    const {playerView} = useSelector(getTabletopStateFromStore);
    const toggleDragMode = useCallback((mode?: DragModeType) => {
        dispatch(toggleTabletopStateDragModeAction(mode));
    }, [dispatch]);
    const onDropMinis = useCallback((metadataList: FileMetadata[]) => {
        for (const metadata of metadataList) {
            placeMini(metadata as FileMetadata<void, MiniProperties>);
        }
    }, [placeMini]);
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
    const [diceBagOpen, setDiceBagOpen] = useState(false);
    const [showPiecesRoster, setShowPiecesRoster] = useState(false);
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
                    'm': {callback: () => {loggedInUserIsGM && dispatch(updateConfirmMovesAction(!confirmMoves))}},
                    's': {callback: () => {loggedInUserIsGM && dispatch(updateSnapToGridAction(!snapToGrid))}},
                    'v': {callback: () => {loggedInUserIsGM && dispatch(toggleTabletopStatePlayerViewAction())}}
                }}/>
                <MenuControlPanel
                    readOnly={readOnly}
                    loggedInUserIsGM={loggedInUserIsGM}
                    canUndo={history.past.length > 0}
                    canRedo={history.future.length > 0}
                    dispatchUndoRedoAction={dispatchUndoRedoAction}
                    labelSize={labelSize}
                    setLabelSize={setLabelSize}
                    changeFocusLevel={changeFocusLevel}
                    fullScreen={fullScreen}
                    setFullScreen={setFullScreen}
                    setDiceBagOpen={setDiceBagOpen}
                    setShowPiecesRoster={setShowPiecesRoster}
                    isCurrentUserPlayer={!loggedInUserIsGM}
                    setCurrentScreen={setCurrentScreen}
                />
                <AvatarsComponent connectedUsers={connectedUsers}
                                  loggedInUser={loggedInUser}
                                  myPeerId={myPeerId}
                                  setCurrentScreen={setCurrentScreen}
                                  tabletop={tabletop}
                                  gmConnected={isGMConnected}
                                  savingTabletop={savingTabletop}
                                  hasUnsavedChanges={hasUnsavedChanges}
                />
                <FileErrorModalComponent loggedInUserIsGM={loggedInUserIsGM} replaceMetadata={replaceMetadata} hidden={hidden} />
                <div className='mainArea'>
                    <DragDropPasteUploadContainer topDirectory={FOLDER_MINI} onPlaceholdersCreated={onDropMinis} disabled={hidden}>
                        <TabletopViewComponent
                            readOnly={readOnly}
                            disableTapMenu={readOnly}
                            snapToGrid={snapToGrid}
                            userIsGM={loggedInUserIsGM}
                            playerView={playerView}
                            labelSize={labelSize}
                            replaceMapImageFn={replaceMapImage}
                        />
                    </DragDropPasteUploadContainer>
                </div>
                <TabletopMoveableWindows diceBagOpen={myPeerId !== null && diceBagOpen}
                                         setDiceBagOpen={setDiceBagOpen}
                                         showPiecesRoster={showPiecesRoster}
                                         setShowPiecesRoster={setShowPiecesRoster}
                                         userIsGM={loggedInUserIsGM}
                                         readOnly={readOnly}
                />
            </DisableGlobalKeyboardHandlerContextBridge>
        </div>
    );
};

export default ScreenControlPanelAndTabletop;