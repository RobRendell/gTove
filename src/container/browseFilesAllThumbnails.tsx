import {PropsWithChildren, ReactElement} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import FileThumbnail from '../presentation/fileThumbnail';
import {updateFolderStackAction} from '../redux/folderStacksReducer';
import BrowseFilesFileThumbnail from './browseFilesFileThumbnail';
import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';
import Spinner from '../presentation/spinner';
import {getAllFilesFromStore, getFolderStacksFromStore} from '../redux/mainReducer';
import {BrowseFilesCallback} from './browseFilesComponent';
import {DropDownMenuOption} from '../presentation/dropDownMenu';
import {sortMetadataIdsByName} from '../util/storage/storageUtils';

interface BrowseFilesAllThumbnailsProps<A extends AnyAppProperties, B extends AnyProperties> {
    currentFolder: string;
    topDirectory: string;
    setShowBusySpinner: (show: boolean) => void;
    selectedMetadataIds: {[metadataId: string]: boolean | undefined} | undefined;
    fileIsNew?: BrowseFilesCallback<A, B, boolean>;
    highlightMetadataId?: string;
    jsonIcon?: string | BrowseFilesCallback<A, B, ReactElement>;
    buildFileMenu: (metadata: FileMetadata<A, B>) => DropDownMenuOption<any>[];
    loading: boolean;
    screenInfo?: ReactElement | ((directory: string, fileIds: string[], loading: boolean) => ReactElement);
}

const BrowseFilesAllThumbnails = <A extends AnyAppProperties, B extends AnyProperties>(
    {
        currentFolder,
        topDirectory,
        setShowBusySpinner,
        selectedMetadataIds,
        fileIsNew,
        highlightMetadataId,
        jsonIcon,
        buildFileMenu,
        loading,
        screenInfo
    }: PropsWithChildren<BrowseFilesAllThumbnailsProps<A, B>>
) => {

    const dispatch = useDispatch();

    // Values from Redux store

    const files = useSelector(getAllFilesFromStore);
    const folderStack = useSelector(getFolderStacksFromStore)[topDirectory];

    // Render

    const sorted = sortMetadataIdsByName(files.fileMetadata, files.children[currentFolder]);
    const folderDepth = folderStack.length;

    return (
        <div>
            {
                folderDepth === 1 ? null : (
                    <FileThumbnail
                        fileId={folderStack[folderDepth - 2]}
                        name={files.fileMetadata[folderStack[folderDepth - 2]].name}
                        isFolder={false}
                        isIcon={true}
                        icon='arrow_back'
                        isNew={false}
                        onClick={() => {
                            dispatch(updateFolderStackAction(topDirectory, folderStack.slice(0, folderDepth - 1)));
                        }}
                        setShowBusySpinner={setShowBusySpinner}
                    />
                )
            }
            {
                sorted.map((fileId: string) => (
                    <BrowseFilesFileThumbnail
                        key={'thumbnail-' + fileId}
                        metadata={files.fileMetadata[fileId] as FileMetadata<A, B>}
                        selectedMetadataIds={selectedMetadataIds}
                        setShowBusySpinner={setShowBusySpinner}
                        buildFileMenu={buildFileMenu}
                        fileIsNew={fileIsNew}
                        highlightMetadataId={highlightMetadataId}
                        jsonIcon={jsonIcon}
                    />
                ))
            }
            {
                !loading ? null : (
                    <div className='fileThumbnail'><Spinner size={60}/></div>
                )
            }
            {
                !screenInfo ? null :
                    typeof(screenInfo) === 'function' ? screenInfo(currentFolder, sorted, loading) : screenInfo
            }
        </div>
    );
}

export default BrowseFilesAllThumbnails;