import {FunctionComponent, useCallback, useContext, useEffect} from 'react';
import {useSelector, useStore} from 'react-redux';

import {getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {uploadFromPlaceholder} from '../util/uploadPlaceholderUtils';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';

const UploadPlaceholderContainer: FunctionComponent = () => {
    const {entities, ids} = useSelector(getUploadPlaceholdersFromStore);
    const nextId = ids.find((id) => (entities[id]?.upload));
    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);
    const uploadPlaceholder = useCallback(async (nextId) => {
        const {entities, ids, uploading} = getUploadPlaceholdersFromStore(store.getState());
        if (uploading && nextId) {
            const placeholder = entities[nextId];
            if (placeholder) {
                await uploadFromPlaceholder(store, fileAPI, placeholder, true);
            }
        } else if (ids.length > 0) {
            // Clean up - work backwards to deal with files before their parent folders.
            for (let index = ids.length - 1; index >= 0; --index) {
                const placeholder = entities[ids[index]];
                if (placeholder?.upload) {
                    await uploadFromPlaceholder(store, fileAPI, placeholder, false);
                }
            }
        }
    }, [store, fileAPI]);
    useEffect(() => {
        uploadPlaceholder(nextId);
    }, [nextId, uploadPlaceholder]);
    return null;
};

export default UploadPlaceholderContainer;