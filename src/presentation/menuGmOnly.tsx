import classNames from 'classnames';
import {FunctionComponent, useCallback} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {
    getConnectedUsersFromStore,
    getMyPeerIdFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {updateConfirmMovesAction, updateSnapToGridAction} from '../redux/scenarioReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {
    setTabletopStatePaintOpenAction,
    toggleTabletopStateDragModeAction,
    toggleTabletopStatePlayerViewAction
} from '../redux/tabletopStateReducer';
import {DragModeType} from '../redux/tabletopStateReducerTypes';
import {isTabletopLockedForPeer, selectConfirmMovesAndSnapToGridFromScenario} from '../util/scenarioUtils';
import InputButton from './inputButton';

export interface MenuGmOnlyProps {
    readOnly: boolean;
    loggedInUserIsGM: boolean;
    canUndo: boolean;
    canRedo: boolean;
    dispatchUndoRedoAction: (undo: boolean) => void;
}

const MenuGmOnly: FunctionComponent<MenuGmOnlyProps> = ({
                                                            readOnly, loggedInUserIsGM, canUndo, canRedo, dispatchUndoRedoAction
                                                        }) => {
    const {dragMode, playerView} = useSelector(getTabletopStateFromStore);
    const dispatch = useDispatch();
    const tabletop = useSelector(getTabletopFromStore);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const {confirmMoves, snapToGrid} = useSelector(selectConfirmMovesAndSnapToGridFromScenario, shallowEqual);
    
    const togglePaintState = useCallback(() => {
        dispatch(setTabletopStatePaintOpenAction());
    }, [dispatch]);
    const toggleDragMode = useCallback((mode: DragModeType) => {
        dispatch(toggleTabletopStateDragModeAction(mode));
    }, [dispatch]);
    
    return (!loggedInUserIsGM) ? null : (
        <div>
            <div className='controlsRow'>
                <InputButton type='button'
                             tooltip={tabletop.tabletopLockedPeerId === myPeerId ? 'Unlock the tabletop.' : 'Lock the tabletop so that only this client can make changes.'}
                             className={classNames({myLock: tabletop.tabletopLockedPeerId === myPeerId})}
                             onChange={() => {
                                 if (myPeerId && !isTabletopLockedForPeer(tabletop, connectedUsers.users, myPeerId, true)) {
                                     const tabletopLockedPeerId = tabletop.tabletopLockedPeerId === myPeerId ? undefined : myPeerId;
                                     dispatch(updateTabletopAction({tabletopLockedPeerId}));
                                 }
                             }}>
                    <span className='material-icons'>{tabletop.tabletopLockedPeerId ? 'lock' : 'lock_open'}</span>
                </InputButton>
                <InputButton type='button'
                             tooltip='Undo'
                             disabled={!canUndo}
                             onChange={() => (dispatchUndoRedoAction(true))}>
                    <span className='material-icons'>undo</span>
                </InputButton>
                <InputButton type='button'
                             tooltip='Redo'
                             disabled={!canRedo}
                             onChange={() => (dispatchUndoRedoAction(false))}>
                    <span className='material-icons'>redo</span>
                </InputButton>
            </div>
            <div className='controlsRow'>
                <InputButton type='button'
                             tooltip='Paint on maps with your mouse or finger'
                             onChange={togglePaintState}>
                    <span className='material-icons'>brush</span>
                </InputButton>
            </div>
            <hr/>
            <InputButton type='checkbox' fillWidth={true} selected={snapToGrid} disabled={readOnly} onChange={() => {
                dispatch(updateSnapToGridAction(!snapToGrid));
            }} tooltip='Snap minis to the grid when moving them.'>Grid Snap</InputButton>
            <InputButton type='checkbox' fillWidth={true} selected={dragMode === 'fogOfWarMode'} disabled={readOnly} onChange={() => {
                toggleDragMode('fogOfWarMode');
            }} tooltip='Cover or reveal map sections with the fog of war.'>Edit Fog</InputButton>
            <InputButton type='checkbox' fillWidth={true} selected={!confirmMoves} disabled={readOnly} onChange={() => {
                dispatch(updateConfirmMovesAction(!confirmMoves));
            }} tooltip='Toggle whether movement needs to be confirmed.'>Free Move</InputButton>
            <InputButton type='checkbox' fillWidth={true} selected={!playerView} disabled={readOnly} onChange={() => {
                dispatch(toggleTabletopStatePlayerViewAction());
            }} tooltip='Toggle between the "see everything" GM View and what players can see.'>GM View</InputButton>
        </div>
    );
};

export default MenuGmOnly;