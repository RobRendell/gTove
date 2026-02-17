import './gmNoteEditor.scss';

import {FunctionComponent, lazy, Suspense, useRef} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import type {RichTextEditorImplementationHandle} from '../container/richTextEditorImplementation';
import {getScenarioFromStore, getTabletopFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {updateMiniNoteMarkdownAction} from '../redux/scenarioReducer';
import {setTabletopStateEditingNoteAction} from '../redux/tabletopStateReducer';
import {getPieceName} from '../util/scenarioUtils';
import ModalDialog from './modalDialog';

// This dynamic import causes the rich text editor to go into a separate bundle which is only loaded on demand.
const RichTextEditor = lazy(() => import('../container/richTextEditorImplementation'));

function selectNoteDataFromStore(store: ReduxStoreType) {
    const {selectedNoteMiniId, editingNote} = getTabletopStateFromStore(store);
    const scenario = getScenarioFromStore(store);
    const tabletop = getTabletopFromStore(store);
    const gmNoteMarkdown = !selectedNoteMiniId ? undefined : scenario.minis[selectedNoteMiniId]?.gmNoteMarkdown;
    const miniName = !selectedNoteMiniId ? undefined : getPieceName(selectedNoteMiniId, scenario.minis, tabletop.piecesRosterColumns);
    return {selectedNoteMiniId, editingNote, gmNoteMarkdown, miniName}
}

const GmNoteEditor: FunctionComponent = () => {
    const {selectedNoteMiniId, editingNote, gmNoteMarkdown, miniName} = useSelector(selectNoteDataFromStore, shallowEqual);

    const dispatch = useDispatch();
    
    const okResponse = 'Ok';
    const editorHandle = useRef<RichTextEditorImplementationHandle | null>(null);
    
    return (
        <ModalDialog isOpen={editingNote}
                     heading={'GM Note for ' + miniName}
                     options={[okResponse, 'Cancel']}
                     setResult={(response: string) => {
                         if (response === okResponse && selectedNoteMiniId && editorHandle.current) {
                             const newMarkdown = editorHandle.current.finalise();
                             dispatch(updateMiniNoteMarkdownAction(selectedNoteMiniId, newMarkdown));
                         }
                         dispatch(setTabletopStateEditingNoteAction(false));
                     }}
        >
            <Suspense fallback={(
                <textarea value={gmNoteMarkdown ?? '\n'} readOnly={true} />
            )}>
                <RichTextEditor ref={editorHandle} className='gmNoteEditor' value={gmNoteMarkdown ?? '\n'}/>
            </Suspense>
        </ModalDialog>
    )
}

export default GmNoteEditor;