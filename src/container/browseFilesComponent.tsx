import {
    ChangeEvent,
    ComponentType,
    DragEvent,
    PropsWithChildren,
    ReactElement,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react';
import {useSelector, useStore} from 'react-redux';
import {toast, ToastContainer} from 'react-toastify';
import {omit, pick} from 'lodash';
import classNames from 'classnames';

import {addFilesAction, removeFileAction} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, getFolderStacksFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import InputButton from '../presentation/inputButton';
import * as constants from '../util/constants';
import BreadCrumbs from '../presentation/breadCrumbs';
import {
    AnyAppProperties,
    AnyProperties,
    anyPropertiesTooLong,
    DriveMetadata,
    isMetadataOwnedByMe,
    isTabletopFileMetadata
} from '../util/googleDriveUtils';
import {FileAPIContextObject, TextureLoaderContextObject} from '../context/fileAPIContextBridge';
import RenameFileEditor from '../presentation/renameFileEditor';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import {DropDownMenuClickParams, DropDownMenuOption} from '../presentation/dropDownMenu';
import Spinner from '../presentation/spinner';
import InputField from '../presentation/inputField';
import SearchBar from '../presentation/searchBar';
import RubberBandGroup from '../presentation/rubberBandGroup';
import {updateFolderStackAction} from '../redux/folderStacksReducer';
import {
    createMultipleUploadPlaceholders,
    createUploadPlaceholder,
    replaceUploadPlaceholder,
    UploadType
} from '../util/uploadPlaceholderUtils';
import {clearSingleMetadata} from '../redux/uploadPlaceholderReducer';
import BrowseFilesSelected from './browseFilesSelected';
import BrowseFilesSearchResults from './browseFilesSearchResults';
import BrowseFilesAllThumbnails from './browseFilesAllThumbnails';

export type BrowseFilesCallback<A extends AnyAppProperties, B extends AnyProperties, C> = (metadata: DriveMetadata<A, B>, parameters?: DropDownMenuClickParams) => C;

export type BrowseFilesComponentGlobalAction<A extends AnyAppProperties, B extends AnyProperties> = {
    label: string;
    createsFile: boolean;
    onClick: (parents: string[]) => Promise<DriveMetadata<A, B> | undefined>;
    hidden?: boolean;
};

interface BrowseFilesComponentFileOnClickOptionalResult<A extends AnyAppProperties, B extends AnyProperties> {
    postAction: string;
    metadata: DriveMetadata<A, B>
}

export type BrowseFilesComponentFileAction<A extends AnyAppProperties, B extends AnyProperties> = {
    label: string;
    onClick: 'edit' | 'delete' | 'select' | BrowseFilesCallback<A, B, void | Promise<void | BrowseFilesComponentFileOnClickOptionalResult<A, B>>>;
    disabled?: BrowseFilesCallback<A, B, boolean>;
};

const URL_REGEX = new RegExp('^[a-z][-a-z0-9+.]*:\\/\\/(%[0-9a-f][0-9a-f]|[-a-z0-9._~!$&\'()*+,;=:])*\\/');

export interface BrowseFilesComponentProps<A extends AnyAppProperties, B extends AnyProperties> {
    topDirectory: string;
    fileActions: BrowseFilesComponentFileAction<A, B>[];
    fileIsNew?: BrowseFilesCallback<A, B, boolean>;
    editorComponent: ComponentType<any>;
    editorExtraProps?: {[key: string]: any};
    onBack?: () => void;
    allowMultiPick: boolean;
    globalActions?: BrowseFilesComponentGlobalAction<A, B>[];
    allowUploadAndWebLink: boolean;
    screenInfo?: ReactElement | ((directory: string, fileIds: string[], loading: boolean) => ReactElement);
    highlightMetadataId?: string;
    jsonIcon?: string | BrowseFilesCallback<A, B, ReactElement>;
    showSearch: boolean;
}

const BrowseFilesComponent = <A extends AnyAppProperties, B extends AnyProperties>(props: PropsWithChildren<BrowseFilesComponentProps<A, B>>) => {
    const {
        topDirectory, fileActions, fileIsNew, editorComponent, editorExtraProps, onBack, allowMultiPick,
        globalActions, allowUploadAndWebLink, screenInfo, highlightMetadataId, jsonIcon, showSearch
    } = props;
    const store = useStore();

    // Context

    const fileAPI = useContext(FileAPIContextObject);
    const promiseModal = useContext(PromiseModalContextObject);
    const textureLoader = useContext(TextureLoaderContextObject);

    // State

    const [searchResult, setSearchResult] = useState<DriveMetadata<A, B>[] | undefined>();
    const [showBusySpinner, setShowBusySpinner] = useState(false);
    const [searchTerm, setSearchTerm] = useState<string | undefined>();
    const [selectedMetadataIds, setSelectedMetadataIds] = useState<{[metadataId: string]: boolean | undefined} | undefined>();
    const [editMetadata, setEditMetadata] = useState<DriveMetadata<A, B> | undefined>();
    const [newFile, setNewFile] = useState(false);
    const [fileDragActive, setFileDragActive] = useState(false);
    const [loading, setLoading] = useState(false);

    // Callbacks

    const onEditFile = useCallback((metadata: DriveMetadata<A, B>) => {
        setEditMetadata(metadata);
        setNewFile(false);
    }, []);

    const onDeleteFile = useCallback(async (metadata: DriveMetadata<A, B>) => {
        if (promiseModal?.isAvailable()) {
            if (metadata.id === highlightMetadataId) {
                await promiseModal({
                    children: 'Can\'t delete the currently selected file.'
                });
            } else {
                const yesOption = 'Yes';
                const response = await promiseModal({
                    children: `Are you sure you want to delete ${metadata.name}?`,
                    options: [yesOption, 'Cancel']
                });
                if (response === yesOption) {
                    store.dispatch(removeFileAction(metadata));
                    const uploadPlaceholders = getUploadPlaceholdersFromStore(store.getState());
                    if (uploadPlaceholders.entities[metadata.id]?.upload) {
                        // Don't try to delete a placeholder using the fileAPI.
                        return;
                    }
                    await fileAPI.deleteFile(metadata);
                    if (isTabletopFileMetadata(metadata)) {
                        // Also trash the private GM file.
                        await fileAPI.deleteFile({id: metadata.appProperties.gmFile});
                    }
                }
            }
        }
    }, [store, promiseModal, fileAPI, highlightMetadataId]);

    const onSelectFile = useCallback((metadata: DriveMetadata<A, B>) => {
        setSelectedMetadataIds((selectedMetadataIds) => (
            {...selectedMetadataIds, [metadata.id]: true}
        ));
    }, []);

    const buildFileMenu = useCallback((metadata: DriveMetadata<A, B>): DropDownMenuOption<BrowseFilesComponentFileOnClickOptionalResult<A, B>>[] => {
        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
        let menuFileActions: BrowseFilesComponentFileAction<A, B>[] = isFolder ? [
            {label: 'Open', onClick: () => {
                    const folderStack = getFolderStacksFromStore(store.getState())[topDirectory];
                    store.dispatch(updateFolderStackAction(topDirectory, [...folderStack, metadata.id]));
                }},
            {label: 'Rename', onClick: 'edit'},
            {label: 'Select', onClick: 'select'},
            {label: 'Delete', onClick: 'delete', disabled: () => (metadata.id === highlightMetadataId)}
        ] : fileActions;
        if (searchResult) {
            menuFileActions = [...menuFileActions, {
                label: 'View in folder',
                onClick: async () => {
                    setShowBusySpinner(true);
                    // Need to build the breadcrumbs
                    const files = getAllFilesFromStore(store.getState());
                    const rootFolderId = files.roots[topDirectory];
                    const folderStack = [];
                    let parents = metadata.parents;
                    for (let folderId = parents[0]; folderId !== rootFolderId; folderId = parents[0]) {
                        folderStack.push(folderId);
                        if (files.driveMetadata[folderId]) {
                            parents = files.driveMetadata[folderId].parents;
                        } else {
                            const metadata = await fileAPI.getFullMetadata(folderId);
                            store.dispatch(addFilesAction([metadata]));
                            parents = metadata.parents;
                        }
                    }
                    folderStack.push(rootFolderId);
                    store.dispatch(updateFolderStackAction(topDirectory, folderStack.reverse()));
                    setShowBusySpinner(false);
                    setSearchTerm(undefined);
                    setSearchResult(undefined);
                }}];
        }
        return menuFileActions.map((fileAction) => {
            let disabled = fileAction.disabled ? fileAction.disabled(metadata) : false;
            const selected = selectedMetadataIds ? selectedMetadataIds[metadata.id] : false;
            let onClick;
            const fileActionOnClick = fileAction.onClick;
            if (fileActionOnClick === 'edit') {
                onClick = () => (onEditFile(metadata));
            } else if (fileActionOnClick === 'delete') {
                onClick = () => (onDeleteFile(metadata));
            } else if (fileActionOnClick === 'select') {
                onClick = () => (onSelectFile(metadata));
                disabled = disabled || selected || false;
            } else {
                onClick = async (parameters: DropDownMenuClickParams) => {
                    const result = await fileActionOnClick(metadata, parameters);
                    if (result && result.postAction === 'edit') {
                        onEditFile(result.metadata);
                    }
                };
            }
            return {
                label: fileAction.label,
                disabled,
                onClick
            };
        });
    }, [store, topDirectory, fileActions, searchResult, fileAPI, selectedMetadataIds, onEditFile, onDeleteFile,
        onSelectFile, highlightMetadataId]);

    const uploadMultipleFiles = useCallback(async (upload: UploadType) => {
        // Don't allow uploads if one is already in progress
        const uploadPlaceholders = getUploadPlaceholdersFromStore(store.getState());
        if (uploadPlaceholders.ids.length > 0) {
            return;
        }
        const folderStack = getFolderStacksFromStore(store.getState())[topDirectory]
        const parents = folderStack.slice(folderStack.length - 1);
        return createMultipleUploadPlaceholders(store, topDirectory, fileAPI, upload, parents);
    }, [store, fileAPI, topDirectory]);

    const onFileDragDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
        // Default behaviour of the dragOver event is to "reset the current drag operation to none", so it needs
        // to be prevented for file drag & drop to work.
        event.preventDefault();
        if (allowUploadAndWebLink) {
            // Only handle file drag and drop on pages which allow upload.
            switch (event.type) {
                case 'dragenter':
                case 'dragleave':
                    setFileDragActive(event.type === 'dragenter');
                    break;
                case 'drop':
                    setFileDragActive(false);
                    const dataTransfer = event.nativeEvent.dataTransfer;
                    if (dataTransfer) {
                        let upload: UploadType;
                        if (dataTransfer.items) {
                            upload = await getUploadFromDataTransferItemList(dataTransfer.items);
                        } else if (dataTransfer.files) {
                            upload = {name: '.', files: []};
                            for (let file of dataTransfer.files) {
                                upload.files.push(file);
                            }
                        } else {
                            toast('File drag and drop not supported on this browser.');
                            break;
                        }
                        try {
                            await uploadMultipleFiles(upload);
                        } catch (e) {
                            toast('Failed to upload dragged files/folders.');
                            console.error('Failed to upload dragged files/folders.', e);
                        }
                    } else {
                        toast('File drag and drop not supported on this browser.');
                    }
                    break;
            }
        }
    }, [allowUploadAndWebLink, uploadMultipleFiles]);

    const onCloseEditor = useCallback(() => {
        setEditMetadata(undefined);
        setNewFile(false);
    }, []);

    const onRubberBandSelectIds = useCallback((updatedIds: {[metadataId: string]: boolean | undefined}) => {
        if (selectedMetadataIds) {
            const selected = Object.keys(updatedIds).reduce<undefined | {[key: string]: boolean | undefined}>((selected, metadataId) => {
                if (selectedMetadataIds[metadataId]) {
                    // We need to explicitly test === false rather than using !updatedIds[metadataId] because the
                    // metadataId may not even be in updatedIds (if it's a file in a different directory) and !undefined
                    // is also true.
                    if (updatedIds[metadataId] === false) {
                        return omit(selected || selectedMetadataIds, metadataId);
                    }
                } else if (updatedIds[metadataId]) {
                    if (!selected) {
                        selected = {...selectedMetadataIds};
                    }
                    selected[metadataId] = true;
                }
                return selected;
            }, undefined);
            if (selected) {
                setSelectedMetadataIds(Object.keys(selected).length > 0 ? selected : undefined);
            }
        } else {
            const selectedIds = Object.keys(updatedIds).filter((metadataId) => (updatedIds[metadataId]));
            if (Object.keys(selectedIds).length > 0) {
                setSelectedMetadataIds(pick(updatedIds, selectedIds));
            }
        }
    }, [selectedMetadataIds]);

    const onClearSearch = useCallback(() => {
        setSearchResult(undefined);
        setSearchTerm(undefined);
    }, []);

    const onUploadInput = useCallback((event?: ChangeEvent<HTMLInputElement>) => {
        if (event?.target.files) {
            uploadMultipleFiles({
                name: '.',
                files: Array.from(event.target.files)
            });
        }
    }, [uploadMultipleFiles]);

    const uploadWebLinks = useCallback(async (text: string) => {
        const webLinkArray = text.split(/\s+/)
            .filter((text) => (text.toLowerCase().match(URL_REGEX)));
        if (webLinkArray.length > 0) {
            const folderStack = getFolderStacksFromStore(store.getState())[topDirectory];
            const parents = folderStack.slice(folderStack.length - 1);
            const placeholders = webLinkArray.map((link) => (
                createUploadPlaceholder(store, topDirectory, getFilenameFromUrl(link), parents)
            ));
            let driveMetadata: DriveMetadata | null = null;
            for (let webLink of webLinkArray) {
                const metadata: Partial<DriveMetadata> = {
                    name: getFilenameFromUrl(webLink),
                    parents,
                    properties: {webLink}
                };
                if (anyPropertiesTooLong(metadata.properties)) {
                    toast(`URL is too long: ${webLink}`);
                } else {
                    driveMetadata = await fileAPI.uploadFileMetadata(metadata);
                    await fileAPI.makeFileReadableToAll(driveMetadata);
                }
                const placeholderMetadata = placeholders.shift()!;
                replaceUploadPlaceholder(store, topDirectory, placeholderMetadata, driveMetadata);
            }
            if (driveMetadata && webLinkArray.length === 1 && isMetadataOwnedByMe(driveMetadata)) {
                // For single file upload, automatically edit after creating if it's owned by me
                setEditMetadata(driveMetadata as DriveMetadata<A, B>);
                setNewFile(true);
            }
        }
    }, [store, topDirectory, fileAPI]);

    const onWebLinksPressed = useCallback(async () => {
        let textarea: HTMLTextAreaElement;
        if (promiseModal?.isAvailable()) {
            const result = await promiseModal({
                className: 'webLinkModal',
                children: (
                    <textarea
                        ref={(element: HTMLTextAreaElement) => {textarea = element}}
                        placeholder='Enter the URLs of one or more images, separated by spaces.'
                    />
                ),
                options: [
                    {label: 'Create links to images', value: () => (textarea.value)},
                    {label: 'Cancel', value: null}
                ]
            });
            if (result) {
                uploadWebLinks(result);
            }
        }
    }, [promiseModal, uploadWebLinks]);

    const onGlobalAction = useCallback(async (action: BrowseFilesComponentGlobalAction<A, B>) => {
        const folderStack = getFolderStacksFromStore(store.getState())[topDirectory]
        const parents = folderStack.slice(folderStack.length - 1);
        const placeholderMetadata = !action.createsFile ? undefined :
            createUploadPlaceholder(store, topDirectory, '', parents);
        const driveMetadata = await action.onClick(parents);
        if (placeholderMetadata && driveMetadata) {
            await replaceUploadPlaceholder(store, topDirectory, placeholderMetadata, driveMetadata);
            if (isMetadataOwnedByMe(driveMetadata)) {
                setEditMetadata(driveMetadata);
                setNewFile(true);
            }
        }
    }, [store, topDirectory]);

    const onAddFolder = useCallback(async (prefix = ''): Promise<void> => {
        if (!promiseModal?.isAvailable()) {
            return;
        }
        const okResponse = 'OK';
        let name: string = 'New Folder';
        const returnAction = () => {promiseModal.setResult(okResponse)};
        const response = await promiseModal({
            options: [okResponse, 'Cancel'],
            children: (
                <div>
                    {prefix + 'Please enter the name of the new folder.'}
                    <InputField type='text' initialValue={name} select={true} focus={true}
                                specialKeys={{Return: returnAction, Enter: returnAction}}
                                onChange={(value: string) => {name = value}}
                    />
                </div>
            )
        });
        if (response === okResponse && name) {
            // Check the name is unique
            const folderStack = getFolderStacksFromStore(store.getState())[topDirectory];
            const currentFolder = folderStack[folderStack.length - 1];
            const files = getAllFilesFromStore(store.getState());
            const valid = (files.children[currentFolder] || []).reduce((valid, fileId) => {
                return valid && (name.toLowerCase() !== files.driveMetadata[fileId].name.toLowerCase());
            }, true);
            if (valid) {
                createUploadPlaceholder(store, topDirectory, name, [currentFolder], undefined, 1, true);
            } else {
                return onAddFolder('That name is already in use.  ');
            }
        }
    }, [promiseModal, store, topDirectory]);

    const loadCurrentDirectoryFiles = useCallback(async () => {
        const folderStack = getFolderStacksFromStore(store.getState())[topDirectory];
        const currentFolderId = folderStack[folderStack.length - 1];
        const uploadPlaceholders = getUploadPlaceholdersFromStore(store.getState());
        // Don't try to load a directory that's currently a placeholder.
        if (uploadPlaceholders.entities[currentFolderId]?.upload) {
            return;
        }
        const files = getAllFilesFromStore(store.getState());
        const leftBehind = (files.children[currentFolderId] || []).reduce((all, fileId) => {
            // Don't consider files that are mid-upload to be left behind.
            all[fileId] = (uploadPlaceholders.entities[fileId] === undefined);
            return all;
        }, {});
        setLoading(true);
        try {
            await fileAPI.loadFilesInFolder(currentFolderId, (files: DriveMetadata[]) => {
                store.dispatch(addFilesAction(files));
                files.forEach((metadata) => {leftBehind[metadata.id] = false});
            });
            // Clean up any files that are no longer in directory
            Object.keys(leftBehind)
                .filter((fileId) => (leftBehind[fileId]))
                .forEach((fileId) => {
                    store.dispatch(removeFileAction({id: fileId, parents: [currentFolderId]}));
                });
        } catch (err) {
            console.log('Error getting contents of current folder', err);
        }
        setLoading(false);
    }, [store, topDirectory, fileAPI]);

    const onPaste = useCallback((event: ClipboardEvent) => {
        // Only support paste on pages which allow upload.
        if (allowUploadAndWebLink && event.clipboardData) {
            if (event.clipboardData.files && event.clipboardData.files.length > 0) {
                uploadMultipleFiles({
                    name: '.',
                    files: Array.from(event.clipboardData.files)
                });
            } else {
                uploadWebLinks(event.clipboardData.getData('text'));
            }
        }
    }, [allowUploadAndWebLink, uploadMultipleFiles, uploadWebLinks]);

    const onSearch = useCallback(async (searchTerm) => {
        if (searchTerm) {
            setShowBusySpinner(true);
            const matches = await fileAPI.findFilesContainingNameWithProperty(searchTerm, 'rootFolder', topDirectory) as DriveMetadata<A, B>[];
            setShowBusySpinner(false);
            matches.sort((f1, f2) => (f1.name < f2.name ? -1 : f1.name > f2.name ? 1 : 0));
            setSearchResult(matches);
            setSearchTerm(searchTerm);
            store.dispatch(addFilesAction(matches));
        } else {
            setSearchResult(undefined);
            setSearchTerm(undefined);
        }
    }, [store, fileAPI, topDirectory]);

    // Redux store values

    const uploadPlaceholders = useSelector(getUploadPlaceholdersFromStore);
    const folderStack = useSelector(getFolderStacksFromStore)[topDirectory];

    // Effects

    useEffect(() => {
        // Register onPaste event manually, because user-select: none disables clipboard events in Chrome
        document.addEventListener('paste', onPaste);
        return () => {
            document.removeEventListener('paste', onPaste);
        };
    }, [onPaste]);

    useEffect(() => {
        // Bogus length test on folderStack to make this effect trigger when folderStack changes.
        if (folderStack.length > 0) {
            loadCurrentDirectoryFiles();
        }
    }, [loadCurrentDirectoryFiles, folderStack]);

    const {singleMetadata, uploading} = uploadPlaceholders;
    useEffect(() => {
        if (singleMetadata && !uploading) {
            setNewFile(true);
            setEditMetadata(singleMetadata as DriveMetadata<A, B>);
            store.dispatch(clearSingleMetadata());
        }
    }, [store, singleMetadata, uploading]);

    // Renderers

    const memoGlobalActions = useMemo(() => {
        return searchResult || !globalActions ? null : (
            globalActions
                .filter((action) => (!action.hidden))
                .map((action) => (
                    <InputButton type='button' key={action.label} onChange={() => (onGlobalAction(action))}>{action.label}</InputButton>
                ))
        )
    }, [searchResult, globalActions, onGlobalAction]);

    if (editMetadata) {
        const Editor = (editMetadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) ? RenameFileEditor : editorComponent;
        return (
            <Editor
                metadata={editMetadata}
                onClose={onCloseEditor}
                textureLoader={textureLoader}
                newFile={newFile}
                {...editorExtraProps}
            />
        );
    } else if (showBusySpinner) {
        return (
            <div className='fileThumbnail'><Spinner size={60}/></div>
        );
    } else {
        const uploadInProgress = (uploadPlaceholders.ids.length > 0);
        return (
            <div className={classNames('fullHeight', {fileDragActive})}
                 onDragEnter={onFileDragDrop} onDragLeave={onFileDragDrop} onDragOver={onFileDragDrop}
                 onDrop={onFileDragDrop}
            >
                <RubberBandGroup setSelectedIds={onRubberBandSelectIds}>
                    {
                        !onBack ? null : (
                            <InputButton type='button' onChange={onBack}>Finish</InputButton>
                        )
                    }
                    {
                        !searchResult ? null : (
                            <InputButton type='button' onChange={onClearSearch}>Clear Search</InputButton>
                        )
                    }
                    {
                        searchResult || !allowUploadAndWebLink ? null : (
                            <>
                                <InputButton type='file' multiple={true}
                                             disabled={uploadInProgress}
                                             onChange={onUploadInput}>Upload</InputButton>
                                <InputButton type='button'
                                             disabled={uploadInProgress}
                                             onChange={onWebLinksPressed}>Link to Images</InputButton>
                            </>
                        )
                    }
                    {
                        memoGlobalActions
                    }
                    {
                        searchResult ? null : (
                            <>
                                <InputButton type='button' onChange={onAddFolder}>Add Folder</InputButton>
                                <InputButton type='button' onChange={loadCurrentDirectoryFiles}>Refresh</InputButton>
                            </>
                        )
                    }
                    {
                        !showSearch ? null : (
                            <SearchBar placeholder={'Search all ' + topDirectory}
                                       initialValue={searchTerm || ''}
                                       onSearch={onSearch}
                            />
                        )
                    }
                    {
                        searchResult ? (
                            <div>{topDirectory} with names matching "{searchTerm}"</div>
                        ) : (
                            <BreadCrumbs folders={folderStack} onChange={(folderStack: string[]) => {
                                store.dispatch(updateFolderStackAction(topDirectory, folderStack));
                            }}/>
                        )
                    }
                    {
                        searchResult ? (
                            <BrowseFilesSearchResults
                                searchResult={searchResult}
                                selectedMetadataIds={selectedMetadataIds}
                                jsonIcon={jsonIcon}
                                setShowBusySpinner={setShowBusySpinner}
                                buildFileMenu={buildFileMenu}
                                fileIsNew={fileIsNew}
                                highlightMetadataId={highlightMetadataId}
                            />
                        ) : (
                            <BrowseFilesAllThumbnails
                                currentFolder={folderStack[folderStack.length - 1]}
                                topDirectory={topDirectory}
                                setShowBusySpinner={setShowBusySpinner}
                                selectedMetadataIds={selectedMetadataIds}
                                fileIsNew={fileIsNew}
                                highlightMetadataId={highlightMetadataId}
                                jsonIcon={jsonIcon}
                                buildFileMenu={buildFileMenu}
                                loading={loading}
                                screenInfo={screenInfo}
                            />
                        )
                    }
                    {
                        <BrowseFilesSelected
                            currentFolder={searchResult ? undefined : folderStack[folderStack.length - 1]}
                            selectedMetadataIds={selectedMetadataIds}
                            setSelectedMetadataIds={setSelectedMetadataIds}
                            setShowBusySpinner={setShowBusySpinner}
                            setLoading={setLoading}
                            loadCurrentDirectoryFiles={loadCurrentDirectoryFiles}
                            allowMultiPick={allowMultiPick}
                            fileActions={fileActions}
                            fileIsNew={fileIsNew}
                            highlightMetadataId={highlightMetadataId}
                            jsonIcon={jsonIcon}
                            buildFileMenu={buildFileMenu}
                        />
                    }
                    <ToastContainer className='toastContainer' position={toast.POSITION.BOTTOM_CENTER} hideProgressBar={true}/>
                </RubberBandGroup>
            </div>
        );
    }
};

async function getUploadFromEntryList(entryList: any[], name = '.'): Promise<UploadType> {
    const result: UploadType = {name, files: []};
    let resolveDirectoryPromise: () => void;
    const directoryPromise = new Promise<void>((resolve) => {
        resolveDirectoryPromise = resolve
    });
    let remaining = entryList.length + 1;
    const decrementRemaining = () => {
        if (--remaining === 0) {
            resolveDirectoryPromise();
        }
    }
    for (let entry of entryList) {
        if (entry.isFile) {
            entry.file((file: File) => {
                result.files.push(file);
                decrementRemaining();
            });
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            reader.readEntries(async (directoryEntries: any[]) => {
                result.subdirectories = result.subdirectories || [];
                const subdir = await getUploadFromEntryList(directoryEntries, entry.name);
                result.subdirectories.push(subdir);
                decrementRemaining();
            });
        }
    }
    decrementRemaining(); // in case entryList was empty.
    await directoryPromise;
    return result;
}

async function getUploadFromDataTransferItemList(itemList: DataTransferItemList): Promise<UploadType> {
    // Attempt to use experimental webkitGetAsEntry approach, to allow uploading whole directories
    if (itemList.length && typeof (itemList[0].webkitGetAsEntry) === 'function') {
        const entries: any[] = [];
        for (let item of itemList) {
            entries.push(item.webkitGetAsEntry());
        }
        return getUploadFromEntryList(entries);
    } else {
        const result: UploadType = {
            name: '.',
            files: []
        };
        for (let item of itemList) {
            if (item.kind === 'file') {
                result.files.push(item.getAsFile()!);
            }
        }
        return result;
    }
}

function getFilenameFromUrl(url: string): string {
    return url.split('#').shift()!.split('?').shift()!.split('/').pop()!;
}

export default BrowseFilesComponent;