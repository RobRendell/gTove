import './screenControlPanelAndTabletop.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {DragDropPasteUploadContainer} from '../container/dragDropPasteUploadContainer';
import KeyDownHandler from '../container/keyDownHandler';
import TabletopMoveableWindows from '../container/tabletopMoveableWindows';
import DisableGlobalKeyboardHandlerProvider from '../context/disableGlobalKeyboardHandlerProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {
    getConnectedUsersFromStore,
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
import MenuControlPanel from './menuControlPanel';
import TabletopViewComponent from './tabletopViewComponent';

interface ScreenControlPanelAndTabletopProps {
    hidden: boolean;
    readOnly: boolean;
    isGMConnected: boolean;
    savingTabletop: number;
    hasUnsavedChanges: boolean;
    placeMini: (metadata: FileMetadata<void, MiniProperties>) => void;
}

const ScreenControlPanelAndTabletop: FunctionComponent<ScreenControlPanelAndTabletopProps> = ({
                                                                                                  hidden,
                                                                                                  readOnly,
                                                                                                  isGMConnected,
                                                                                                  savingTabletop,
                                                                                                  hasUnsavedChanges,
                                                                                                  placeMini,
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
    const history = useSelector(getUndoableHistoryFromStore);
    const disableKeyDownHandler = useCallback(() => (
        disableGlobalKeyboardHandler || !promiseModal?.isAvailable() || hidden
    ), [disableGlobalKeyboardHandler, promiseModal, hidden])
    return (
        <div className={classNames('controlFrame', {hidden})}>
            <DisableGlobalKeyboardHandlerProvider value={setDisableGlobalKeyboardHandler}>
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
                    isCurrentUserPlayer={!loggedInUserIsGM}
                />
                <AvatarsComponent connectedUsers={connectedUsers}
                                  loggedInUser={loggedInUser}
                                  myPeerId={myPeerId}
                                  tabletop={tabletop}
                                  gmConnected={isGMConnected}
                                  savingTabletop={savingTabletop}
                                  hasUnsavedChanges={hasUnsavedChanges}
                />
                <FileErrorModalComponent loggedInUserIsGM={loggedInUserIsGM} hidden={hidden} />
                <div className='mainArea'>
                    <DragDropPasteUploadContainer topDirectory={FOLDER_MINI} onPlaceholdersCreated={onDropMinis} disabled={hidden}>
                        <TabletopViewComponent
                            readOnly={readOnly}
                            disableTapMenu={readOnly}
                            userIsGM={loggedInUserIsGM}
                            playerView={playerView}
                            labelSize={labelSize}
                        />
                    </DragDropPasteUploadContainer>
                </div>
                <TabletopMoveableWindows userIsGM={loggedInUserIsGM} readOnly={readOnly} />
            </DisableGlobalKeyboardHandlerProvider>
        </div>
    );
};

export default ScreenControlPanelAndTabletop;