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
    const upload = useCallback(async (nextId) => {
        const {entities, ids, uploading} = getUploadPlaceholdersFromStore(store.getState());
        if (nextId) {
            const nextPlaceholder = entities[nextId];
            if (nextPlaceholder) {
                await uploadFromPlaceholder(store, fileAPI, nextPlaceholder, uploading);
            }
        } else if (ids.length > 0) {
            // We've apparently exhausted all placeholders marked for upload, so clean up.
            for (let id of ids) {
                const placeholder = entities[id];
                if (placeholder) {
                    await uploadFromPlaceholder(store, fileAPI, placeholder, false);
                }
            }
        }
    }, [store, fileAPI]);
    useEffect(() => {
        upload(nextId);
    }, [nextId, upload]);
    return null;
};

export default UploadPlaceholderContainer;