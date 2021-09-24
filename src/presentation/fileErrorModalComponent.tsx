import {FunctionComponent} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {getScenarioFromStore} from '../redux/mainReducer';
import Modal from 'react-modal';

import {ERROR_FILE_NAME, removeFileAction, setFileContinueAction} from '../redux/fileIndexReducer';
import InputButton from './inputButton';

interface FileErrorModalComponentProps {
    loggedInUserIsGM: boolean;
    replaceMetadata: (isMap: boolean, metadataId: string) => void;
    hidden: boolean;
}

const FileErrorModalComponent: FunctionComponent<FileErrorModalComponentProps> = ({loggedInUserIsGM, replaceMetadata, hidden}) => {
    const scenario = useSelector(getScenarioFromStore);
    const dispatch = useDispatch();
    if (hidden || !loggedInUserIsGM) {
        return null;
    }
    let errorId = Object.keys(scenario.maps).reduce<string | false>((errorId, mapId) => (
        errorId || (scenario.maps[mapId].metadata.name === ERROR_FILE_NAME && mapId)
    ), false);
    let isMap = true;
    if (!errorId) {
        isMap = false;
        errorId = Object.keys(scenario.minis).reduce<string | false>((errorId, miniId) => (
            errorId || (scenario.minis[miniId].metadata.name === ERROR_FILE_NAME && miniId)
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
                    replaceMetadata(isMap, metadataId);
                }}>Replace with different image</InputButton>
                <InputButton type='button' onChange={() => {dispatch(setFileContinueAction(metadataId))}}>Continue without image</InputButton>
            </div>
        </Modal>
    );
};

export default FileErrorModalComponent;