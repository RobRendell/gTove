import {PropsWithChildren, ReactElement} from 'react';
import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';
import BrowseFilesFileThumbnail from './browseFilesFileThumbnail';
import {BrowseFilesCallback} from './browseFilesComponent';
import {DropDownMenuOption} from '../presentation/dropDownMenu';

interface BrowseFilesSearchResultsProps<A extends AnyAppProperties, B extends AnyProperties> {
    searchResult: FileMetadata<A, B>[] | undefined;
    selectedMetadataIds: {[metadataId: string]: boolean | undefined} | undefined;
    jsonIcon?: string | BrowseFilesCallback<A, B, ReactElement>;
    setShowBusySpinner: (show: boolean) => void;
    buildFileMenu: (metadata: FileMetadata<A, B>) => DropDownMenuOption<any>[];
    fileIsNew?: BrowseFilesCallback<A, B, boolean>;
    highlightMetadataId?: string;
}

const BrowseFilesSearchResults = <A extends AnyAppProperties, B extends AnyProperties>({
    searchResult, selectedMetadataIds, jsonIcon, setShowBusySpinner, buildFileMenu, fileIsNew, highlightMetadataId
}: PropsWithChildren<BrowseFilesSearchResultsProps<A, B>>) => {
    return (
        <div>
            {
                searchResult?.length ? (
                    searchResult.map((file) => (
                        <BrowseFilesFileThumbnail
                            key={'search-result-' + file.id}
                            metadata={file}
                            selectedMetadataIds={selectedMetadataIds}
                            setShowBusySpinner={setShowBusySpinner}
                            buildFileMenu={buildFileMenu}
                            fileIsNew={fileIsNew}
                            highlightMetadataId={highlightMetadataId}
                            jsonIcon={jsonIcon}
                        />
                    ))
                ) : (
                    <p>
                        No matching results found. Note that the search will not find files which are marked as
                        <span className='material-icons' style={{color: 'green'}}>fiber_new</span> or folders.
                    </p>
                )
            }
        </div>
    );
}

export default BrowseFilesSearchResults;