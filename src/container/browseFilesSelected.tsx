import {PropsWithChildren, ReactElement, useCallback, useContext} from 'react';
import {useSelector, useStore} from 'react-redux';
import {omit} from 'lodash';

import FileThumbnail from '../presentation/fileThumbnail';
import {updateFileAction} from '../redux/fileIndexReducer';
import {AnyAppProperties, AnyProperties, DriveMetadata} from '../util/googleDriveUtils';
import {getAllFilesFromStore} from '../redux/mainReducer';
import * as constants from '../util/constants';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import BrowseFilesFileThumbnail from './browseFilesFileThumbnail';
import {BrowseFilesCallback, BrowseFilesComponentFileAction} from './browseFilesComponent';
import {DropDownMenuOption} from '../presentation/dropDownMenu';
import {sortMetadataIdsByName} from '../util/fileUtils';
import {MIME_TYPE_DRIVE_FOLDER} from '../util/constants';

interface BrowseFilesSelectedProps<A extends AnyAppProperties, B extends AnyProperties> {
    currentFolder?: string;
    selectedMetadataIds: {[metadataId: string]: true} | undefined;
    setSelectedMetadataIds: (update: {[metadataId: string]: true} | undefined) => void;
    setShowBusySpinner: (show: boolean) => void;
    setLoading: (loading: boolean) => void;
    loadCurrentDirectoryFiles: () => Promise<void>;
    allowMultiPick: boolean;
    fileActions: BrowseFilesComponentFileAction<A, B>[];
    fileIsNew?: BrowseFilesCallback<A, B, boolean>;
    highlightMetadataId?: string;
    jsonIcon?: string | BrowseFilesCallback<A, B, ReactElement>;
    buildFileMenu: (metadata: DriveMetadata<A, B>) => DropDownMenuOption<any>[];
}

const BrowseFilesSelected = <A extends AnyAppProperties, B extends AnyProperties>(
    {
        currentFolder,
        selectedMetadataIds,
        setSelectedMetadataIds,
        setShowBusySpinner,
        setLoading,
        loadCurrentDirectoryFiles,
        allowMultiPick,
        fileActions,
        fileIsNew,
        highlightMetadataId,
        jsonIcon,
        buildFileMenu
    }: PropsWithChildren<BrowseFilesSelectedProps<A, B>>
) => {

    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);

    // Callbacks

    const isMovingFolderAncestorOfFolder = useCallback((movingFolderId: string, folderId: string): boolean => {
        if (movingFolderId === folderId) {
            return true;
        }
        const files = getAllFilesFromStore(store.getState());
        const metadata = files.driveMetadata[folderId];
        if (metadata && metadata.parents) {
            for (let parent of metadata.parents) {
                if (isMovingFolderAncestorOfFolder(movingFolderId, parent)) {
                    return true;
                }
            }
        }
        return false;
    }, [store]);

    const isSelectedMoveValidHere = useCallback((currentFolder?: string): boolean => {
        if (currentFolder === undefined) {
            return false;
        }
        if (selectedMetadataIds) {
            // Check if all selected metadata are already in this folder, or if any of them are ancestor folders.
            let anyElsewhere = false;
            const files = getAllFilesFromStore(store.getState());
            for (let metadataId of Object.keys(selectedMetadataIds)) {
                if (!selectedMetadataIds[metadataId]) {
                    // Ignore things that are no longer selected
                    continue;
                }
                const metadata = files.driveMetadata[metadataId];
                if (!metadata) {
                    // If metadata is missing, it will be cleaned up by BrowseFilesComponent, but also return false in the interim.
                    return false;
                }
                if (metadata.parents.indexOf(currentFolder) < 0) {
                    anyElsewhere = true;
                }
                if (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER && isMovingFolderAncestorOfFolder(metadataId, currentFolder)) {
                    return false;
                }
            }
            return anyElsewhere;
        }
        return true;
    }, [store, selectedMetadataIds, isMovingFolderAncestorOfFolder]);

    // Redux store values

    const {driveMetadata} = useSelector(getAllFilesFromStore);

    // Render

    return !selectedMetadataIds ? null : (
        <div className='selectedFiles'>
            <FileThumbnail
                fileId={'cancel'} name={'Cancel select'} isFolder={false} isIcon={true} icon='close'
                isNew={false} setShowBusySpinner={setShowBusySpinner} onClick={
                () => {setSelectedMetadataIds(undefined)}
            }
            />
            <FileThumbnail
                fileId={'move'} name={'Move to this folder'} isFolder={false} isIcon={true} icon='arrow_downward'
                disabled={!isSelectedMoveValidHere(currentFolder)} isNew={false} setShowBusySpinner={setShowBusySpinner}
                onClick={async () => {
                    // Clear selected files and start loading spinner
                    setSelectedMetadataIds(undefined);
                    setLoading(true);
                    // update parents of selected metadataIds
                    for (let metadataId of Object.keys(selectedMetadataIds!)) {
                        const metadata = driveMetadata[metadataId];
                        if (metadata.parents && metadata.parents.indexOf(currentFolder!) < 0) {
                            const newMetadata = await fileAPI.uploadFileMetadata(metadata, [currentFolder!], metadata.parents);
                            store.dispatch(updateFileAction(newMetadata));
                        }
                    }
                    // Trigger refresh of this folder (which also clears the loading flag)
                    await loadCurrentDirectoryFiles();
                }}
            />
            {
                !allowMultiPick ? null : (
                    <FileThumbnail
                        fileId={'pick'} name={'Pick selected'} isFolder={false} isIcon={true} icon='touch_app'
                        disabled={Object.keys(selectedMetadataIds!).length === 0} isNew={false} setShowBusySpinner={setShowBusySpinner}
                        onClick={async () => {
                            const pickAction = fileActions[0].onClick;
                            if (pickAction === 'edit' || pickAction === 'select' || pickAction === 'delete') {
                                return;
                            }
                            setShowBusySpinner(true);
                            const isDisabled = fileActions[0].disabled;
                            for (let metadataId of Object.keys(selectedMetadataIds!)) {
                                const metadata = driveMetadata[metadataId] as DriveMetadata<A, B>;
                                if ((!isDisabled || !isDisabled(metadata)) && metadata.mimeType !== MIME_TYPE_DRIVE_FOLDER) {
                                    await pickAction(metadata);
                                }
                            }
                            setShowBusySpinner(false);
                        }}
                    />
                )
            }
            {
                sortMetadataIdsByName(driveMetadata, Object.keys(selectedMetadataIds).filter((metadataId) => (selectedMetadataIds![metadataId])))
                    .map((metadataId) => {
                        return (
                            <BrowseFilesFileThumbnail
                                key={'selected-' + metadataId}
                                metadata={driveMetadata[metadataId] as DriveMetadata<A, B>}
                                overrideOnClick={(fileId) => {
                                    const newSelectedMetadataIds = omit(selectedMetadataIds, fileId);
                                    setSelectedMetadataIds(Object.keys(newSelectedMetadataIds).length > 0 ? newSelectedMetadataIds : undefined);
                                }}
                                fileIsNew={fileIsNew}
                                highlightMetadataId={highlightMetadataId}
                                selectedMetadataIds={selectedMetadataIds}
                                jsonIcon={jsonIcon}
                                setShowBusySpinner={setShowBusySpinner}
                                buildFileMenu={buildFileMenu}
                            />
                        )
                    })
            }
        </div>
    );
};

export default BrowseFilesSelected;