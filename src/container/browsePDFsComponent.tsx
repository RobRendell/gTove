import {FunctionComponent} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';

import BrowseFilesComponent from './browseFilesComponent';
import * as constants from '../util/constants';
import PdfFileEditor from '../presentation/pdfFileEditor';
import {getAllFilesFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';

interface BrowsePDFsComponentProps {
    folderStack: string[];
    miniFolderStack: string[];
    mapFolderStack: string[];
    onBack: () => void;
}

const BrowsePDFsComponent: FunctionComponent<BrowsePDFsComponentProps> = (props) => {
    const store = useStore();
    const dispatch = useDispatch();
    const files = useSelector(getAllFilesFromStore);
    const uploadPlaceholders = useSelector(getUploadPlaceholdersFromStore);
    return (
        <BrowseFilesComponent
            store={store}
            files={files}
            dispatch={dispatch}
            topDirectory={constants.FOLDER_PDFS}
            folderStack={props.folderStack}
            uploadPlaceholders={uploadPlaceholders}
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
                store: store,
                miniFolderStack: props.miniFolderStack,
                mapFolderStack: props.mapFolderStack,
                uploadPlaceholders,
                files,
                dispatch
            }}
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