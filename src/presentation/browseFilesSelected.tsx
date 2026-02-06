import {PropsWithChildren, ReactElement, useCallback, useContext, useMemo} from 'react';
import {useSelector, useStore} from 'react-redux';
import {omit} from 'lodash';

import './browseFilesSelected.scss';

import FileThumbnail from './fileThumbnail';
import {removeFileAction, updateFileAction} from '../redux/fileIndexReducer';
import {AnyAppProperties, AnyProperties, FileMetadata} from '../util/storage/storageContract';
import { isTabletopFileMetadata } from '../util/storage/storageUtils';
import {getAllFilesFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import * as constants from '../util/constants';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import BrowseFilesFileThumbnail from '../container/browseFilesFileThumbnail';
import {BrowseFilesCallback, BrowseFilesComponentFileAction} from '../container/browseFilesComponent';
import {DropDownMenuOption} from './dropDownMenu';
import {sortMetadataIdsByName} from '../util/storage/storageUtils';
import {MIME_TYPE_DRIVE_FOLDER} from '../util/constants';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';

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
    buildFileMenu: (metadata: FileMetadata<A, B>) => DropDownMenuOption<any>[];
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

    const pickAllLabel = useMemo(() => (
        fileActions.length > 0 ? fileActions[0].label.replace('{}', 'all selected') : ''
    ), [fileActions]);

    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);
    const promiseModal = useContext(PromiseModalContextObject);

    // Callbacks

    const isMovingFolderAncestorOfFolder = useCallback((movingFolderId: string, folderId: string): boolean => {
        if (movingFolderId === folderId) {
            return true;
        }
        const files = getAllFilesFromStore(store.getState());
        const metadata = files.fileMetadata[folderId];
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
                const metadata = files.fileMetadata[metadataId];
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

    const onCancelSelect = useCallback(() => {
        setSelectedMetadataIds(undefined);
    }, [setSelectedMetadataIds]);

    const onMoveSelectedToFolder = useCallback(async () => {
        // Clear selected files and start loading spinner
        setSelectedMetadataIds(undefined);
        setLoading(true);
        const allFiles = getAllFilesFromStore(store.getState());
        // update parents of selected metadataIds
        for (let metadataId of Object.keys(selectedMetadataIds!)) {
            const metadata = allFiles.fileMetadata[metadataId];
            if (metadata.parents && metadata.parents.indexOf(currentFolder!) < 0) {
                const newMetadata = await fileAPI.uploadFileMetadata(metadata, [currentFolder!], metadata.parents);
                store.dispatch(updateFileAction(newMetadata));
            }
        }
        // Trigger refresh of this folder (which also clears the loading flag)
        return loadCurrentDirectoryFiles();
    }, [store, fileAPI, setSelectedMetadataIds, currentFolder, loadCurrentDirectoryFiles, selectedMetadataIds, setLoading]);

    const onPickSelected = useCallback(async () => {
        const pickAction = fileActions[0].onClick;
        if (pickAction === 'edit' || pickAction === 'select' || pickAction === 'delete') {
            return;
        }
        setShowBusySpinner(true);
        const isDisabled = fileActions[0].disabled;
        const allFiles = getAllFilesFromStore(store.getState());
        for (let metadataId of Object.keys(selectedMetadataIds!)) {
            const metadata = allFiles.fileMetadata[metadataId] as FileMetadata<A, B>;
            if ((!isDisabled || !isDisabled(metadata)) && metadata.mimeType !== MIME_TYPE_DRIVE_FOLDER) {
                await pickAction(metadata);
            }
        }
        setShowBusySpinner(false);
    }, [store, fileActions, selectedMetadataIds, setShowBusySpinner]);

    const onDeleteSelected = useCallback(async () => {
        if (promiseModal?.isAvailable() && selectedMetadataIds) {
            const yesOption = 'Yes';
            const response = await promiseModal({
                children: `Are you sure you want to delete all ${Object.keys(selectedMetadataIds).length} 
                    selected item${Object.keys(selectedMetadataIds).length === 1 ? '' : 's'}?`,
                options: [yesOption, 'Cancel']
            });
            if (response === yesOption) {
                const allFiles = getAllFilesFromStore(store.getState());
                const uploadPlaceholders = getUploadPlaceholdersFromStore(store.getState());
                setLoading(true);
                for (let id of Object.keys(selectedMetadataIds)) {
                    const metadata = allFiles.fileMetadata[id];
                    if (metadata) {
                        store.dispatch(removeFileAction(metadata));
                        if (!uploadPlaceholders.entities[id]?.upload) {
                            // Don't try to delete a placeholder using the fileAPI.
                            await fileAPI.deleteFile(metadata);
                            if (isTabletopFileMetadata(metadata)) {
                                // Also trash the private GM file.
                                await fileAPI.deleteFile({id: metadata.appProperties!.gmFile});
                            }
                        }
                    }
                }
                setLoading(false);
            }
        }
    }, [store, fileAPI, promiseModal, selectedMetadataIds, setLoading]);

    // Redux store values

    const {fileMetadata: driveMetadata} = useSelector(getAllFilesFromStore);

    // Render

    return !selectedMetadataIds ? null : (
        <div className='selectedFiles'>
            <FileThumbnail
                fileId={'cancel'} name={'Cancel select'} isFolder={false} isIcon={true} icon='close'
                isNew={false} setShowBusySpinner={setShowBusySpinner} onClick={onCancelSelect}
            />
            <FileThumbnail
                fileId={'move'} name={'Move to this folder'} isFolder={false} isIcon={true} icon='arrow_downward'
                disabled={!isSelectedMoveValidHere(currentFolder)} isNew={false} setShowBusySpinner={setShowBusySpinner}
                onClick={onMoveSelectedToFolder}
            />
            <FileThumbnail
                fileId={'delete'} name={'Delete all selected'} isFolder={false} isIcon={true} icon='delete'
                isNew={false} setShowBusySpinner={setShowBusySpinner}
                onClick={onDeleteSelected}
            />
            {
                (!allowMultiPick || fileActions.length === 0) ? null : (
                    <FileThumbnail
                        fileId={'pick'} name={pickAllLabel} isFolder={false} isIcon={true} icon='touch_app'
                        disabled={Object.keys(selectedMetadataIds!).length === 0} isNew={false} setShowBusySpinner={setShowBusySpinner}
                        onClick={onPickSelected}
                    />
                )
            }
            {
                sortMetadataIdsByName(driveMetadata, Object.keys(selectedMetadataIds).filter((metadataId) => (selectedMetadataIds![metadataId])))
                    .map((metadataId) => {
                        return (
                            <BrowseFilesFileThumbnail
                                key={'selected-' + metadataId}
                                metadata={driveMetadata[metadataId] as FileMetadata<A, B>}
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