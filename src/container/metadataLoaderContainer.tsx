import {FunctionComponent, useContext, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {DriveMetadata} from '../util/googleDriveUtils';
import {getAllFilesFromStore} from '../redux/mainReducer';
import MetadataLoaderService from '../service/metadataLoaderService';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {setFileErrorAction, updateFileAction} from '../redux/fileIndexReducer';

interface MetadataLoaderContainerProps {
    tabletopId: string;
    metadata: DriveMetadata;
}

const MetadataLoaderContainer: FunctionComponent<MetadataLoaderContainerProps> = ({tabletopId, metadata}) => {
    const {driveMetadata} = useSelector(getAllFilesFromStore);
    const metadataId = metadata.id;
    const myMetadata = driveMetadata[metadataId];
    const fileAPI = useContext(FileAPIContextObject);
    const dispatch = useDispatch();
    useEffect(() => {
        (async () => {
            if (!myMetadata || !myMetadata.properties) {
                try {
                    const loadedMetadata = await MetadataLoaderService.loadMetadata(metadataId, fileAPI);
                    if (loadedMetadata.trashed) {
                        dispatch(setFileErrorAction(metadataId));
                    } else {
                        dispatch(updateFileAction(loadedMetadata));
                    }
                } catch (e) {
                    dispatch(setFileErrorAction(metadataId));
                }
            }
        })();
    }, [tabletopId, metadataId, fileAPI, dispatch, myMetadata]);
    return null;
};

export default MetadataLoaderContainer;