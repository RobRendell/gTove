import {FunctionComponent} from 'react';
import {useSelector} from 'react-redux';

import './breadCrumbs.scss';

import {getAllFilesFromStore} from '../redux/mainReducer';

interface BreadCrumbsProps {
    folders: string[];
    onChange: (folders: string[]) => void;
}

const BreadCrumbs: FunctionComponent<BreadCrumbsProps> = ({folders, onChange}) => {
    const {driveMetadata} = useSelector(getAllFilesFromStore);
    return (
        <div className='breadCrumbs'>
            {
                folders.map((folderId, index) => (
                    (index < folders.length - 1) ? (
                        <span key={folderId} className='clickable' onClick={() => {
                            onChange(folders.slice(0, index + 1));
                        }}>{driveMetadata[folderId].name}</span>
                    ) : (
                        <span key={folderId}>{driveMetadata[folderId].name}</span>
                    )
                ))
            }
        </div>
    );
};

export default BreadCrumbs;