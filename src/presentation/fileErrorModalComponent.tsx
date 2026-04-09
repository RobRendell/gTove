import {FunctionComponent} from 'react';
import Modal from 'react-modal';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import {ERROR_FILE_NAME, removeFileAction, setFileContinueAction} from '../redux/fileIndexReducer';
import {getScenarioFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {
    setTabletopStateCurrentPageAction,
    setTabletopStateScenarioReplaceStateAction
} from '../redux/tabletopStateReducer';
import {GToveMode} from '../redux/tabletopStateReducerTypes';
import InputButton from './inputButton';

interface FileErrorModalComponentProps {
    loggedInUserIsGM: boolean;
    hidden: boolean;
}

const FileErrorModalComponent: FunctionComponent<FileErrorModalComponentProps> = ({loggedInUserIsGM, hidden}) => {
    const dispatch = useDispatch();
    const {metadataId, label, name} = useSelector(selectErrorMapOrMiniMetadataId, shallowEqual);
    if (hidden || !loggedInUserIsGM || !metadataId) {
        return null;
    }
    return (
        <Modal
            isOpen={true}
            className='modalDialog'
            overlayClassName='overlay'
        >
            <div>
                <p>Error loading the image for {label} {name} - it may have been deleted from Drive.</p>
                <p>You can remove {name} (and any other {label}s using the same image) from your
                    tabletop, use a different image in its place, or continue on without the image if you think
                    this is a transient error.</p>
            </div>
            <div className='modalButtonDiv'>
                <InputButton type='button' onChange={() => {dispatch(removeFileAction({id: metadataId}))}}>Remove anything using image</InputButton>
                <InputButton type='button' onChange={() => {
                    dispatch(setTabletopStateScenarioReplaceStateAction(
                        (label === 'map') ? {mapMetadataId: metadataId} : {miniMetadataId: metadataId}
                    ));
                    dispatch(setTabletopStateCurrentPageAction((label === 'map') ? GToveMode.MAP_SCREEN : GToveMode.MINIS_SCREEN));
                }}>Replace with different image</InputButton>
                <InputButton type='button' onChange={() => {dispatch(setFileContinueAction(metadataId))}}>Continue without image</InputButton>
            </div>
        </Modal>
    );
};

export default FileErrorModalComponent;

function selectErrorMapOrMiniMetadataId(state: ReduxStoreType): {metadataId?: string, label?: 'map' | 'mini', name?: string} {
    const scenario = getScenarioFromStore(state);
    const placeholders = getUploadPlaceholdersFromStore(state);

    const errorMap = Object.values(scenario.maps).find((map) => (
        map.metadata.name === ERROR_FILE_NAME && placeholders.entities[map.metadata.id] === undefined
    ));
    if (errorMap) {
        return {metadataId: errorMap.metadata.id, label: 'map', name: errorMap.name};
    }
    const errorMini = Object.values(scenario.minis).find((mini) => (
        mini.metadata.name === ERROR_FILE_NAME && placeholders.entities[mini.metadata.id] === undefined
    ));
    return !errorMini ? {} : {metadataId: errorMini.metadata.id, label: 'mini', name: errorMini.name};
}