import './tabletopMiniGMNote.scss';

import {Html} from '@react-three/drei';
import {FunctionComponent, useCallback, useEffect} from 'react';
import ReactMarkdown from 'react-markdown';
import {useDispatch, useSelector} from 'react-redux';
import {Vector3} from 'three';

import {getTabletopStateFromStore} from '../redux/mainReducer';
import {
    setTabletopStateEditingNoteAction,
    setTabletopStateSelectedNoteMiniIdAction
} from '../redux/tabletopStateReducer';

interface TabletopMiniGMNoteProps {
    miniId: string;
    positionVector: Vector3;
    gmNoteMarkdown?: string;
}

const TabletopMiniGMNote: FunctionComponent<TabletopMiniGMNoteProps> = ({
                                                                            miniId,
                                                                            positionVector,
                                                                            gmNoteMarkdown
                                                                        }) => {
    const {selectedNoteMiniId, editingNote} = useSelector(getTabletopStateFromStore);

    const dispatch = useDispatch();
    useEffect(() => {
        if (miniId === selectedNoteMiniId && gmNoteMarkdown === undefined) {
            dispatch(setTabletopStateEditingNoteAction(true));
        }
    }, [dispatch, gmNoteMarkdown, miniId, selectedNoteMiniId]);

    const closeGMNote = useCallback(() => {
        dispatch(setTabletopStateSelectedNoteMiniIdAction(null));
        dispatch(setTabletopStateEditingNoteAction(false));
    }, [dispatch]);

    const editGMNote = useCallback(() => {
        dispatch(setTabletopStateEditingNoteAction(true));
    }, [dispatch]);

    return (selectedNoteMiniId !== miniId || editingNote) ? null : (
        <Html distanceFactor={10} position={positionVector} className='tabletopMiniGMNote'
              style={{transform: 'translate3d(-50%,0,0)'}}>
            <div className='material-icons menuCancel'
                 onClick={closeGMNote} onTouchStart={closeGMNote}>close
            </div>
            <div className='material-icons menuEdit'
                 onClick={editGMNote} onTouchStart={editGMNote}>edit
            </div>
            <ReactMarkdown linkTarget='_blank'>{gmNoteMarkdown ?? '\n'}</ReactMarkdown>
        </Html>
    )
};

export default TabletopMiniGMNote;

