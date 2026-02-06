import {PropsWithChildren, ReactElement, useCallback, useContext} from 'react';
import {useSelector, useStore} from 'react-redux';

import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';
import { isWebLinkProperties, splitFileName } from '../util/storage/storageUtils';
import * as constants from '../util/constants';
import {updateFileAction} from '../redux/fileIndexReducer';
import {makeSelectableChildHOC} from '../presentation/rubberBandGroup';
import FileThumbnail from '../presentation/fileThumbnail';
import {getAllFilesFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {BrowseFilesCallback} from './browseFilesComponent';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {DropDownMenuOption} from '../presentation/dropDownMenu';

const SelectableFileThumbnail = makeSelectableChildHOC(FileThumbnail);

interface BrowseFilesFileThumbnailProps<A extends AnyAppProperties, B extends AnyProperties> {
    metadata: FileMetadata<A, B>;
    overrideOnClick?: (fileId: string) => void;
    fileIsNew?: BrowseFilesCallback<A, B, boolean>;
    highlightMetadataId?: string;
    selectedMetadataIds: {[metadataId: string]: boolean | undefined} | undefined;
    jsonIcon?: string | BrowseFilesCallback<A, B, ReactElement>;
    setShowBusySpinner: (show: boolean) => void;
    buildFileMenu: (metadata: FileMetadata<A, B>) => DropDownMenuOption<any>[];
}

const BrowseFilesFileThumbnail = <A extends AnyAppProperties, B extends AnyProperties>({
    metadata,
    overrideOnClick,
    fileIsNew,
    highlightMetadataId,
    selectedMetadataIds,
    jsonIcon,
    setShowBusySpinner,
    buildFileMenu
}: PropsWithChildren<BrowseFilesFileThumbnailProps<A, B>>) => {

    const fileAPI = useContext(FileAPIContextObject);
    const store = useStore();

    const onClickThumbnail = useCallback((fileId: string) => {
        const files = getAllFilesFromStore(store.getState());
        const metadata = files.fileMetadata[fileId] as FileMetadata<A, B>;
        const fileMenu = buildFileMenu(metadata);
        // Perform the first enabled menu action
        const firstItem = fileMenu.find((menuItem) => (!menuItem.disabled));
        if (firstItem) {
            firstItem.onClick({setShowBusySpinner});
        }
    }, [store, buildFileMenu, setShowBusySpinner]);

    const uploadPlaceholders = useSelector(getUploadPlaceholdersFromStore);

    const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
    const isJson = (metadata.mimeType === constants.MIME_TYPE_JSON);
    const name = (metadata.appProperties || metadata.properties) ? splitFileName(metadata.name).name : metadata.name;
    const menuOptions = overrideOnClick ? undefined : buildFileMenu(metadata);
    const placeholder = uploadPlaceholders.entities[metadata.id];
    const progress = !placeholder ? undefined : (placeholder.progress / (placeholder.targetProgress || 1));

    return (
        <SelectableFileThumbnail
            childId={metadata.id}
            key={metadata.id}
            fileId={metadata.id}
            name={name}
            isFolder={isFolder}
            isIcon={isJson}
            isNew={fileIsNew ? (!isFolder && !isJson && fileIsNew(metadata)) : false}
            progress={progress}
            thumbnailLink={isWebLinkProperties(metadata.properties) ? metadata.properties.webLink : metadata.thumbnailLink}
            onClick={overrideOnClick || onClickThumbnail}
            highlight={highlightMetadataId === metadata.id || (selectedMetadataIds && selectedMetadataIds[metadata.id])}
            menuOptions={menuOptions}
            icon={(typeof(jsonIcon) === 'function') ? jsonIcon(metadata) : jsonIcon}
            setShowBusySpinner={setShowBusySpinner}
            fetchMissingThumbnail={async () => {
                // video files can take a while to populate their thumbnailLink, so we need a mechanism to retry
                const fullMetadata = await fileAPI.getFullMetadata(metadata.id);
                const thumbnailLink = isWebLinkProperties(fullMetadata.properties) ? fullMetadata.properties.webLink : fullMetadata.thumbnailLink;
                if (thumbnailLink) {
                    store.dispatch(updateFileAction(fullMetadata));
                }
            }}
        />
    );
};

export default BrowseFilesFileThumbnail;