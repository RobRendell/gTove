import {FunctionComponent} from 'react';

import BrowsePDFsComponent from './browsePDFsComponent';

interface ScreenPDFBrowserProps {
    onFinish: () => void;
}

const ScreenPDFBrowser: FunctionComponent<ScreenPDFBrowserProps> = ({onFinish}) => {
    return (
        <BrowsePDFsComponent onBack={onFinish} />
    );
};

export default ScreenPDFBrowser;