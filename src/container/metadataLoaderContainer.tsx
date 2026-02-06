import {PropsWithChildren, useContext, useEffect} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';

import {FileMetadata, MapProperties, MiniProperties, TemplateProperties} from '../util/storage/storageContract';
import {getAllFilesFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import MetadataLoaderService from '../service/metadataLoaderService';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {setFileErrorAction, updateFileAction} from '../redux/fileIndexReducer';

interface MetadataLoaderContainerProps<T> {
    tabletopId: string;
    metadata: FileMetadata<void, T>;
    calculateProperties: (properties: T) => T;
}

const MetadataLoaderContainer = <T extends MiniProperties | TemplateProperties | MapProperties>(
    {tabletopId, metadata, calculateProperties}: PropsWithChildren<MetadataLoaderContainerProps<T>>
    ) => {
    const {fileMetadata: driveMetadata} = useSelector(getAllFilesFromStore);
    const placeholders = useSelector(getUploadPlaceholdersFromStore);
    const metadataId = metadata.id;
    const myMetadata = driveMetadata[metadataId];
    const fileAPI = useContext(FileAPIContextObject);
    const store = useStore();
    const dispatch = useDispatch();
    useEffect(() => {
        (async () => {
            if (myMetadata?.properties) {
                // Dispatch the same metadata so it gets set on the scenario if needed.
                dispatch(updateFileAction(myMetadata));
            } else if (!placeholders.entities[myMetadata?.id]) {
                // Don't try to load metadata of placeholders from Drive.
                try {
                    const loadedMetadata = await MetadataLoaderService.loadMetadata(metadataId, fileAPI);
                    if (loadedMetadata.trashed) {
                        dispatch(setFileErrorAction(metadataId));
                    } else {
                        if (!loadedMetadata.properties) {
                            // Attempt to incorporate any width/height updates that have come through from loading
                            // textures.
                            const {fileMetadata: driveMetadata} = getAllFilesFromStore(store.getState());
                            const updatedMetadata = driveMetadata[metadataId] as FileMetadata<void, T>;
                            loadedMetadata.properties = calculateProperties(updatedMetadata?.properties || {} as T);
                        }
                        dispatch(updateFileAction(loadedMetadata));
                    }
                } catch (e) {
                    dispatch(setFileErrorAction(metadataId));
                }
            }
        })();
    }, [tabletopId, metadataId, placeholders, fileAPI, store, dispatch, calculateProperties, myMetadata]);
    return null;
};

export default MetadataLoaderContainer;