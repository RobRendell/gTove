import {FunctionComponent} from 'react';
import {useSelector} from 'react-redux';

import BrowsePDFsComponent from './browsePDFsComponent';
import {FOLDER_MAP, FOLDER_MINI, FOLDER_PDFS} from '../util/constants';
import {getFolderStacksFromStore} from '../redux/mainReducer';

interface ScreenPDFBrowserProps {
    onFinish: () => void;
}

const ScreenPDFBrowser: FunctionComponent<ScreenPDFBrowserProps> = ({onFinish}) => {
    const folderStacks = useSelector(getFolderStacksFromStore);
    return (
        <BrowsePDFsComponent
            folderStack={folderStacks[FOLDER_PDFS]}
            miniFolderStack={folderStacks[FOLDER_MINI]}
            mapFolderStack={folderStacks[FOLDER_MAP]}
            onBack={onFinish}
        />
    );
};

export default ScreenPDFBrowser;