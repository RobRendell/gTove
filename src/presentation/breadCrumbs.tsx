import {FunctionComponent} from 'react';
import {useSelector} from 'react-redux';

import './breadCrumbs.scss';

import {getAllFilesFromStore} from '../redux/mainReducer';

interface BreadCrumbsProps {
    folders: string[];
    onChange: (folders: string[]) => void;
}

const BreadCrumbs: FunctionComponent<BreadCrumbsProps> = ({folders, onChange}) => {
    const {fileMetadata: driveMetadata} = useSelector(getAllFilesFromStore);
    return (
        <div className='breadCrumbs'>
            {
                folders.map((folderId, index) => (
                    (index < folders.length - 1) ? (
                        <span key={folderId} className='clickable' onClick={() => {
                            onChange(folders.slice(0, index + 1));
                        }}>{driveMetadata[folderId]?.name || 'Unknown Directory?'}</span>
                    ) : (
                        <span key={folderId}>{driveMetadata[folderId]?.name || 'Unknown Directory?'}</span>
                    )
                ))
            }
        </div>
    );
};

export default BreadCrumbs;