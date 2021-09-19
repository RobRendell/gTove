import {FunctionComponent} from 'react';
import classNames from 'classnames';
import {useDispatch} from 'react-redux';

import InputButton from './inputButton';
import {isTabletopLockedForPeer, ScenarioType, TabletopType} from '../util/scenarioUtils';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {updateConfirmMovesAction, updateSnapToGridAction} from '../redux/scenarioReducer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {PaintState} from './paintTools';
import {DragModeType} from './controlPanelAndTabletopScreen';

export interface MenuGmOnlyProps {
    readOnly: boolean;
    loggedInUserIsGM: boolean;
    myPeerId: MyPeerIdReducerType;
    connectedUsers: ConnectedUserReducerType;
    tabletop: TabletopType;
    scenario: ScenarioType;
    canUndo: boolean;
    canRedo: boolean;
    dispatchUndoRedoAction: (undo: boolean) => void;
    fogOfWarMode: boolean;
    toggleDragMode: (mode?: DragModeType) => void;
    paintState: PaintState;
    updatePaintState: (update: Partial<PaintState>, callback?: () => void) => void;
    playerView: boolean;
    setPlayerView: (set: boolean) => void;
}

const MenuGmOnly: FunctionComponent<MenuGmOnlyProps> = (props) => {
    const {
        readOnly, loggedInUserIsGM, myPeerId, connectedUsers, tabletop, scenario, canUndo, canRedo, dispatchUndoRedoAction,
        fogOfWarMode, toggleDragMode, paintState, updatePaintState, playerView, setPlayerView
    } = props;
    const dispatch = useDispatch();
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
                             onChange={() => {updatePaintState({open: !paintState.open})}}>
                    <span className='material-icons'>brush</span>
                </InputButton>
            </div>
            <hr/>
            <InputButton type='checkbox' fillWidth={true} selected={scenario.snapToGrid} disabled={readOnly} onChange={() => {
                dispatch(updateSnapToGridAction(!scenario.snapToGrid));
            }} tooltip='Snap minis to the grid when moving them.'>Grid Snap</InputButton>
            <InputButton type='checkbox' fillWidth={true} selected={fogOfWarMode} disabled={readOnly} onChange={() => {
                toggleDragMode('fogOfWarMode');
            }} tooltip='Cover or reveal map sections with the fog of war.'>Edit Fog</InputButton>
            <InputButton type='checkbox' fillWidth={true} selected={!scenario.confirmMoves} disabled={readOnly} onChange={() => {
                dispatch(updateConfirmMovesAction(!scenario.confirmMoves));
            }} tooltip='Toggle whether movement needs to be confirmed.'>Free Move</InputButton>
            <InputButton type='checkbox' fillWidth={true} selected={!playerView} disabled={readOnly} onChange={() => {
                setPlayerView(!playerView);
            }} tooltip='Toggle between the "see everything" GM View and what players can see.'>GM View</InputButton>
        </div>
    );
};

export default MenuGmOnly;