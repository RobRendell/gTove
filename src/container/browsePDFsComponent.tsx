import {FunctionComponent} from 'react';

import PdfFileEditor from '../presentation/pdfFileEditor';
import * as constants from '../util/constants';
import BrowseFilesComponent from './browseFilesComponent';

interface BrowsePDFsComponentProps {
    onBack: () => void;
}

const BrowsePDFsComponent: FunctionComponent<BrowsePDFsComponentProps> = ({onBack}) => {
    return (
        <BrowseFilesComponent<void, void>
            topDirectory={constants.FOLDER_PDFS}
            onBack={onBack}
            showSearch={false}
            allowUploadAndWebLink={true}
            allowMultiPick={false}
            fileActions={[
                {label: 'Edit', onClick: 'edit'},
                {label: 'Select', onClick: 'select'},
                {label: 'Delete', onClick: 'delete'}
            ]}
            editorComponent={PdfFileEditor}
            jsonIcon='picture_as_pdf'
            screenInfo={
                <div className='browseFilesScreenInfo'>
                    <p>You can crop images from multi-page PDFs from here, and save them as maps or miniatures.</p>
                </div>
            }
        />
    );
};

export default BrowsePDFsComponent;