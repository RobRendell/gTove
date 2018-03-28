import {updateFileMetadataOnDrive} from './googleAPIUtils';
import {updateFileAction} from '../redux/fileIndexReducer';

export function updateFileMetadataAndDispatch(metadata, dispatch) {
    return updateFileMetadataOnDrive(metadata)
        .then((driveMetadata) => {
            if (driveMetadata.appProperties.gmFile) {
                // If there's an associated gmFile, update it as well
                dispatch(updateFileAction(driveMetadata));
                return updateFileMetadataOnDrive({...metadata, id: driveMetadata.appProperties.gmFile});
            } else {
                return driveMetadata;
            }
        })
        .then((driveMetadata) => {
            dispatch(updateFileAction(driveMetadata));
        });
}

export function splitFileName(fileName) {
    const match = fileName.match(/^(.*)(\.[a-zA-Z]*)?$/);
    if (match) {
        return {name: match[1] || '', suffix: match[2] || ''};
    } else {
        return {name: '', suffix: ''};
    }
}