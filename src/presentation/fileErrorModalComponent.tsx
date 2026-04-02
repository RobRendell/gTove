import {FunctionComponent} from 'react';
import Modal from 'react-modal';
import {useDispatch, useSelector} from 'react-redux';

import {ERROR_FILE_NAME, removeFileAction, setFileContinueAction} from '../redux/fileIndexReducer';
import {getScenarioFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {
    setTabletopStateCurrentPageStateAction,
    setTabletopStateScenarioReplaceStateAction
} from '../redux/tabletopStateReducer';
import {GToveMode} from '../redux/tabletopStateReducerTypes';
import InputButton from './inputButton';

interface FileErrorModalComponentProps {
    loggedInUserIsGM: boolean;
    hidden: boolean;
}

const FileErrorModalComponent: FunctionComponent<FileErrorModalComponentProps> = ({loggedInUserIsGM, hidden}) => {
    const scenario = useSelector(getScenarioFromStore);
    const placeholders = useSelector(getUploadPlaceholdersFromStore);
    const dispatch = useDispatch();
    if (hidden || !loggedInUserIsGM) {
        return null;
    }
    let errorId = Object.keys(scenario.maps).reduce<string | false>((errorId, mapId) => (
        errorId || (scenario.maps[mapId].metadata.name === ERROR_FILE_NAME
            && placeholders.entities[scenario.maps[mapId].metadata.id] === undefined && mapId)
    ), false);
    let isMap = true;
    if (!errorId) {
        isMap = false;
        errorId = Object.keys(scenario.minis).reduce<string | false>((errorId, miniId) => (
            errorId || (scenario.minis[miniId].metadata.name === ERROR_FILE_NAME
                && placeholders.entities[scenario.minis[miniId].metadata.id] === undefined && miniId)
        ), false);
    }
    if (!errorId) {
        return null;
    }
    const mapOrMini = isMap ? 'map' : 'mini';
    const name = isMap ? scenario.maps[errorId].name : scenario.minis[errorId].name;
    const metadataId = isMap ? scenario.maps[errorId].metadata.id : scenario.minis[errorId].metadata.id;
    return (
        <Modal
            isOpen={true}
            className='modalDialog'
            overlayClassName='overlay'
        >
            <div>
                <p>Error loading the image for {mapOrMini} {name} - it may have been deleted from Drive.</p>
                <p>You can remove {name} (and any other {mapOrMini}s using the same image) from your tabletop,
                    use a different image in its place, or continue on without the image if you think
                    this is a transient error.</p>
            </div>
            <div className='modalButtonDiv'>
                <InputButton type='button' onChange={() => {dispatch(removeFileAction({id: metadataId}))}}>Remove anything using image</InputButton>
                <InputButton type='button' onChange={() => {
                    dispatch(setTabletopStateScenarioReplaceStateAction(
                        isMap ? {mapMetadataId: metadataId} : {miniMetadataId: metadataId}
                    ));
                    dispatch(setTabletopStateCurrentPageStateAction(isMap ? GToveMode.MAP_SCREEN : GToveMode.MINIS_SCREEN));
                }}>Replace with different image</InputButton>
                <InputButton type='button' onChange={() => {dispatch(setFileContinueAction(metadataId))}}>Continue without image</InputButton>
            </div>
        </Modal>
    );
};

export default FileErrorModalComponent;