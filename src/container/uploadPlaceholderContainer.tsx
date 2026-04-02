import {FunctionComponent, useCallback, useContext, useEffect} from 'react';
import {useSelector, useStore} from 'react-redux';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {clearUploadingPlaceholderDataAction} from '../redux/uploadPlaceholderReducer';
import {uploadFromPlaceholder} from '../util/uploadUtils';

const UploadPlaceholderContainer: FunctionComponent = () => {
    const {entities, ids} = useSelector(getUploadPlaceholdersFromStore);
    const nextId = ids.find((id: string) => (entities[id]?.upload));
    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);
    const uploadPlaceholder = useCallback(async (nextId: string) => {
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
        if (nextId) {
            void uploadPlaceholder(nextId);
        }
    }, [nextId, uploadPlaceholder]);
    return null;
};

export default UploadPlaceholderContainer;