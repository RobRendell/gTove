import {FunctionComponent, useCallback, useContext, useEffect} from 'react';
import {useSelector, useStore} from 'react-redux';

import {getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {uploadFromPlaceholder} from '../util/uploadUtils';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {clearUploadingPlaceholderDataAction} from '../redux/uploadPlaceholderReducer';

const UploadPlaceholderContainer: FunctionComponent = () => {
    const {entities, ids} = useSelector(getUploadPlaceholdersFromStore);
    const nextId = ids.find((id) => (entities[id]?.upload));
    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);
    const uploadPlaceholder = useCallback(async (nextId) => {
        const {entities, ids, uploading} = getUploadPlaceholdersFromStore(store.getState());
        if (nextId) {
            const placeholder = entities[nextId];
            if (placeholder) {
                await uploadFromPlaceholder(store, fileAPI, placeholder, uploading);
            }
        } else if (ids.length > 0) {
            // Should never happen, but is relatively harmless
            store.dispatch(clearUploadingPlaceholderDataAction());
        }
    }, [store, fileAPI]);
    useEffect(() => {
        uploadPlaceholder(nextId);
    }, [nextId, uploadPlaceholder]);
    return null;
};

export default UploadPlaceholderContainer;