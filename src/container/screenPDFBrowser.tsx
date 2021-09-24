import {FunctionComponent} from 'react';

import BrowsePDFsComponent from './browsePDFsComponent';
import {FOLDER_MAP, FOLDER_MINI, FOLDER_PDFS} from '../util/constants';
import {useDispatch, useSelector} from 'react-redux';
import {getAllFilesFromStore, getFolderStacksFromStore} from '../redux/mainReducer';

interface ScreenPDFBrowserProps {
    onFinish: () => void;
}

const ScreenPDFBrowser: FunctionComponent<ScreenPDFBrowserProps> = ({onFinish}) => {
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    const folderStacks = useSelector(getFolderStacksFromStore);
    return (
        <BrowsePDFsComponent
            files={files}
            folderStack={folderStacks[FOLDER_PDFS]}
            miniFolderStack={folderStacks[FOLDER_MINI]}
            mapFolderStack={folderStacks[FOLDER_MAP]}
            onBack={onFinish}
            dispatch={dispatch}
        />
    );
};

export default ScreenPDFBrowser;