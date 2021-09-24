import {FunctionComponent} from 'react';

import BrowseFilesComponent from './browseFilesComponent';
import * as constants from '../util/constants';
import PdfFileEditor from '../presentation/pdfFileEditor';
import {FileIndexReducerType} from '../redux/fileIndexReducer';
import {GtoveDispatchProp} from '../redux/mainReducer';

interface BrowsePDFsComponentProps extends GtoveDispatchProp {
    files: FileIndexReducerType;
    folderStack: string[];
    miniFolderStack: string[];
    mapFolderStack: string[];
    onBack: () => void;
}

const BrowsePDFsComponent: FunctionComponent<BrowsePDFsComponentProps> = (props) => (
    <BrowseFilesComponent
        files={props.files}
        dispatch={props.dispatch}
        topDirectory={constants.FOLDER_PDFS}
        folderStack={props.folderStack}
        onBack={props.onBack}
        showSearch={false}
        allowUploadAndWebLink={true}
        allowMultiPick={false}
        fileActions={[
            {label: 'Edit', onClick: 'edit'},
            {label: 'Select', onClick: 'select'},
            {label: 'Delete', onClick: 'delete'}
        ]}
        editorComponent={PdfFileEditor}
        editorExtraProps={{
            miniFolderStack: props.miniFolderStack,
            mapFolderStack: props.mapFolderStack,
            files: props.files,
            dispatch: props.dispatch
        }}
        jsonIcon='picture_as_pdf'
        screenInfo={
            <div className='browseFilesScreenInfo'>
                <p>You can crop images from multi-page PDFs from here, and save them as maps or miniatures.</p>
            </div>
        }
    />
);

export default BrowsePDFsComponent;