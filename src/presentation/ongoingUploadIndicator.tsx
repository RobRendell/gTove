import {FunctionComponent, useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import './ongoingUploadIndicator.scss';

import {getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {cancelUploadPlaceholderUploadingAction} from '../redux/uploadPlaceholderReducer';
import Spinner from './spinner';
import InputButton from './inputButton';

const OngoingUploadIndicator: FunctionComponent = () => {
    const dispatch = useDispatch();

    const uploadPlaceholder = useSelector(getUploadPlaceholdersFromStore);

    const cancelUploads = useCallback(() => {
        dispatch(cancelUploadPlaceholderUploadingAction());
    }, [dispatch]);

    const uploadCount = useMemo(() => {
        const rootCounts = uploadPlaceholder.ids.reduce<{[name: string]: number}>((counts, id) => {
            const placeholder = uploadPlaceholder.entities[id];
            if (placeholder?.upload && !placeholder.deleted) {
                const withoutS = placeholder.rootFolder.replace(/s$/, '');
                counts[withoutS] = counts[withoutS] ? counts[withoutS] + 1 : 1;
            }
            return counts;
        }, {});
        return Object.keys(rootCounts)
            .map((root) => (`${rootCounts[root]} ${root}${rootCounts[root] === 1 ? '' : 's'}`))
            .join(', ');
    }, [uploadPlaceholder.ids, uploadPlaceholder.entities]);

    return (uploadPlaceholder.ids.length === 0) ? null : (
        <span className='ongoingUpload'>
            {
                uploadPlaceholder.uploading ? (
                    <>
                        <span>Uploading {uploadCount}</span>
                        <Spinner size={24}/>
                        <InputButton type='button' onChange={cancelUploads}>Cancel</InputButton>
                    </>
                ) : (
                    <span>Cancelling...</span>
                )
            }
        </span>
    );
};

export default OngoingUploadIndicator;