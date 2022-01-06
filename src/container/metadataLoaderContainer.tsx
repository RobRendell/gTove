import {PropsWithChildren, useContext, useEffect} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';

import {DriveMetadata, MapProperties, MiniProperties, TemplateProperties} from '../util/googleDriveUtils';
import {getAllFilesFromStore} from '../redux/mainReducer';
import MetadataLoaderService from '../service/metadataLoaderService';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {setFileErrorAction, updateFileAction} from '../redux/fileIndexReducer';

interface MetadataLoaderContainerProps<T> {
    tabletopId: string;
    metadata: DriveMetadata<void, T>;
    calculateProperties: (properties: T) => T;
}

const MetadataLoaderContainer = <T extends MiniProperties | TemplateProperties | MapProperties>(
    {tabletopId, metadata, calculateProperties}: PropsWithChildren<MetadataLoaderContainerProps<T>>
    ) => {
    const {driveMetadata} = useSelector(getAllFilesFromStore);
    const metadataId = metadata.id;
    const myMetadata = driveMetadata[metadataId];
    const fileAPI = useContext(FileAPIContextObject);
    const store = useStore();
    const dispatch = useDispatch();
    useEffect(() => {
        (async () => {
            if (!myMetadata || !myMetadata.properties) {
                try {
                    const loadedMetadata = await MetadataLoaderService.loadMetadata(metadataId, fileAPI);
                    if (loadedMetadata.trashed) {
                        dispatch(setFileErrorAction(metadataId));
                    } else {
                        if (!loadedMetadata.properties) {
                            // Attempt to incorporate any width/height updates that have come through from loading
                            // textures.
                            const {driveMetadata} = getAllFilesFromStore(store.getState());
                            const updatedMetadata = driveMetadata[metadataId] as DriveMetadata<void, T>;
                            loadedMetadata.properties = calculateProperties(updatedMetadata?.properties || {});
                        }
                        dispatch(updateFileAction(loadedMetadata));
                    }
                } catch (e) {
                    dispatch(setFileErrorAction(metadataId));
                }
            }
        })();
    }, [tabletopId, metadataId, fileAPI, store, dispatch, calculateProperties, myMetadata]);
    return null;
};

export default MetadataLoaderContainer;