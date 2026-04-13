import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import {
    ChangeEvent,
    ComponentType,
    PropsWithChildren,
    ReactElement,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react';
import {useSelector, useStore} from 'react-redux';

import {FileAPIContextObject} from '../context/fileAPIProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
import {useToast} from '../hooks/useToast';
import BreadCrumbs from '../presentation/breadCrumbs';
import BrowseFilesSelected from '../presentation/browseFilesSelected';
import {DropDownMenuClickParams, DropDownMenuOption} from '../presentation/dropDownMenu';
import FullScreenScrollPanel from '../presentation/fullScreenScrollPanel';
import InputButton from '../presentation/inputButton';
import OngoingUploadIndicator from '../presentation/ongoingUploadIndicator';
import RenameFileEditor from '../presentation/renameFileEditor';
import RubberBandGroup from '../presentation/rubberBandGroup';
import SearchBar from '../presentation/searchBar';
import Spinner from '../presentation/spinner';
import {addFilesAction, removeFileAction} from '../redux/fileIndexReducer';
import {updateFolderStackAction} from '../redux/folderStacksReducer';
import {getAllFilesFromStore, getFolderStacksFromStore, getUploadPlaceholdersFromStore} from '../redux/mainReducer';
import {clearSingleMetadata} from '../redux/uploadPlaceholderReducer';
import * as constants from '../util/constants';
import {AnyAppProperties, AnyProperties, FileMetadata,} from '../util/storage/storageContract';
import {anyPropertiesTooLong, isMetadataOwnedByMe, isTabletopFileMetadata} from '../util/storage/storageUtils';
import {createUploadPlaceholder, replaceUploadPlaceholder, uploadMultipleFiles} from '../util/uploadUtils';
import BrowseFilesAllThumbnails from './browseFilesAllThumbnails';
import BrowseFilesSearchResults from './browseFilesSearchResults';
import {DragDropPasteUploadContainer} from './dragDropPasteUploadContainer';
import InputField from './inputField';

export type BrowseFilesCallback<A extends AnyAppProperties, B extends AnyProperties, C> = (metadata: FileMetadata<A, B>, parameters?: DropDownMenuClickParams) => C;

export type BrowseFilesComponentGlobalAction<A extends AnyAppProperties, B extends AnyProperties> = {
    label: string;
    createsFile: boolean;
    onClick: (parents: string[]) => Promise<FileMetadata<A, B> | undefined>;
    hidden?: boolean;
};

export interface BrowseFilesComponentFileOnClickOptionalResult<A extends AnyAppProperties, B extends AnyProperties> {
    postAction: string;
    metadata: FileMetadata<A, B>
}

export type BrowseFilesComponentFileAction<A extends AnyAppProperties, B extends AnyProperties> = {
    label: string;
    onClick: 'edit' | 'delete' | 'select' 
        | BrowseFilesCallback<A, B, void | Promise<void | BrowseFilesComponentFileOnClickOptionalResult<A, B>>>;
    disabled?: BrowseFilesCallback<A, B, boolean>;
};

const URL_REGEX = new RegExp('^[a-z][-a-z0-9+.]*:\\/\\/(%[0-9a-f][0-9a-f]|[-a-z0-9._~!$&\'()*+,;=:])*\\/');

export interface BaseEditorProps<A extends AnyAppProperties, B extends AnyProperties> {
    metadata: FileMetadata<A, B>;
    onClose: () => void;
    newFile: boolean;
}

interface BaseBrowseFilesComponentProps<A extends AnyAppProperties, B extends AnyProperties> {
    topDirectory: string;
    fileActions: BrowseFilesComponentFileAction<A, B>[];
    fileIsNew?: BrowseFilesCallback<A, B, boolean>;
    onBack?: () => void;
    allowMultiPick: boolean;
    globalActions?: BrowseFilesComponentGlobalAction<A, B>[];
    allowUploadAndWebLink: boolean;
    screenInfo?: ReactElement | ((directory: string, fileIds: string[], loading: boolean) => ReactElement);
    highlightMetadataId?: string;
    jsonIcon?: string | BrowseFilesCallback<A, B, ReactElement>;
    showSearch: boolean;
}

export type BrowseFilesComponentProps<A extends AnyAppProperties, B extends AnyProperties, EditorExtraProps extends object = {}> =
    BaseBrowseFilesComponentProps<A, B> & (
        keyof EditorExtraProps extends never ? {
            editorComponent: ComponentType<BaseEditorProps<A, B>>;
            editorExtraProps?: undefined;
        } : {
            editorComponent: ComponentType<BaseEditorProps<A, B> & EditorExtraProps>;
            editorExtraProps: EditorExtraProps;
        }
    );

const emptyEditorExtraProps = {};

const BrowseFilesComponent =
    <A extends AnyAppProperties, B extends AnyProperties, EditorExtraProps extends object = {}>(
        {
            topDirectory,
            fileActions,
            fileIsNew,
            editorComponent,
            editorExtraProps = emptyEditorExtraProps as EditorExtraProps,
            onBack,
            allowMultiPick,
            globalActions,
            allowUploadAndWebLink,
            screenInfo,
            highlightMetadataId,
            jsonIcon,
            showSearch
        }: PropsWithChildren<BrowseFilesComponentProps<A, B, EditorExtraProps>>
    ) => {
    const store = useStore();
    const toast = useToast();

    // Context

    const fileAPI = useContext(FileAPIContextObject);
    const promiseModal = useContext(PromiseModalContextObject);

    // State

    const [searchResult, setSearchResult] = useState<FileMetadata<A, B>[] | undefined>();
    const [showBusySpinner, setShowBusySpinner] = useState(false);
    const [searchTerm, setSearchTerm] = useState<string | undefined>();
    const [selectedMetadataIds, setSelectedMetadataIds] = useState<{[metadataId: string]: true} | undefined>();
    const [editMetadata, setEditMetadata] = useState<FileMetadata<A, B> | undefined>();
    const [newFile, setNewFile] = useState(false);
    const [loading, setLoading] = useState(false);

    // Callbacks

    const onEditFile = useCallback((metadata: FileMetadata<A, B>) => {
        setEditMetadata(metadata);
        setNewFile(false);
    }, []);

    const onDeleteFile = useCallback(async (metadata: FileMetadata<A, B>) => {
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
                        await fileAPI.deleteFile({id: metadata.appProperties!.gmFile});
                    }
                }
            }
        }
    }, [store, promiseModal, fileAPI, highlightMetadataId]);

    const onSelectFile = useCallback((metadata: FileMetadata<A, B>) => {
        setSelectedMetadataIds((selectedMetadataIds) => (
            {...selectedMetadataIds, [metadata.id]: true}
        ));
    }, []);

    const buildFileMenu = useCallback((metadata: FileMetadata<A, B>): DropDownMenuOption<BrowseFilesComponentFileOnClickOptionalResult<A, B>>[] => {
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
                        if (files.fileMetadata[folderId]) {
                            parents = files.fileMetadata[folderId].parents;
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
                label: fileAction.label.replace('{}', ''),
                disabled,
                onClick
            };
        });
    }, [store, topDirectory, fileActions, searchResult, fileAPI, selectedMetadataIds, onEditFile, onDeleteFile,
        onSelectFile, highlightMetadataId]);

    const onCloseEditor = useCallback(() => {
        setEditMetadata(undefined);
        setNewFile(false);
    }, []);

    const onRubberBandSelectIds = useCallback((updatedIds: {[metadataId: string]: boolean | undefined}) => {
        if (selectedMetadataIds) {
            const selected = Object.keys(updatedIds).reduce<undefined | {[key: string]: true}>((selected, metadataId) => {
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
                setSelectedMetadataIds(pick(updatedIds, selectedIds) as {[key: string]: true});
            }
        }
    }, [selectedMetadataIds]);

    const onClearSearch = useCallback(() => {
        setSearchResult(undefined);
        setSearchTerm(undefined);
    }, []);

    const onUploadInput = useCallback(async (event?: ChangeEvent<HTMLInputElement>) => {
        if (event?.target.files) {
            await uploadMultipleFiles(store, fileAPI, topDirectory, {
                name: '.',
                files: Array.from(event.target.files)
            });
        }
    }, [store, fileAPI, topDirectory]);

    const uploadWebLinks = useCallback(async (text: string) => {
        const webLinkArray = text.split(/\s+/)
            .filter((text) => (text.toLowerCase().match(URL_REGEX)));
        if (webLinkArray.length > 0) {
            const folderStack = getFolderStacksFromStore(store.getState())[topDirectory];
            const parents = folderStack.slice(folderStack.length - 1);
            const placeholders = webLinkArray.map((link) => (
                createUploadPlaceholder(store, topDirectory, getFilenameFromUrl(link), parents)
            ));
            let fileMetadata: FileMetadata | null = null;
            for (let webLink of webLinkArray) {
                const metadata: Partial<FileMetadata> = {
                    name: getFilenameFromUrl(webLink),
                    parents,
                    properties: {webLink}
                };
                if (anyPropertiesTooLong(metadata.properties)) {
                    toast(`URL is too long: ${webLink}`);
                } else {
                    fileMetadata = await fileAPI.uploadFileMetadata(metadata);
                    await fileAPI.makeFileReadableToAll(fileMetadata);
                }
                const placeholderMetadata = placeholders.shift()!;
                replaceUploadPlaceholder(store, topDirectory, placeholderMetadata, fileMetadata);
            }
            if (fileMetadata && webLinkArray.length === 1 && isMetadataOwnedByMe(fileMetadata)) {
                // For single file upload, automatically edit after creating if it's owned by me
                setEditMetadata(fileMetadata as FileMetadata<A, B>);
                setNewFile(true);
            }
        }
    }, [store, topDirectory, toast, fileAPI]);

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
        const fileMetadata = await action.onClick(parents);
        if (placeholderMetadata && fileMetadata) {
            await replaceUploadPlaceholder(store, topDirectory, placeholderMetadata, fileMetadata);
            if (isMetadataOwnedByMe(fileMetadata)) {
                setEditMetadata(fileMetadata);
                setNewFile(true);
            }
        }
    }, [store, topDirectory]);

    const addFolder = useCallback(async (prefix: string): Promise<void> => {
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
            const valid = (files.children[currentFolder] || []).every((fileId) => (
                name.toLowerCase() !== files.fileMetadata[fileId].name.toLowerCase()
            ));
            if (valid) {
                createUploadPlaceholder(store, topDirectory, name, [currentFolder], undefined, 1, true);
            } else {
                return addFolder('That name is already in use.  ');
            }
        }
    }, [promiseModal, store, topDirectory]);

    const onAddFolder = useCallback(() => {
        void addFolder('');
    }, [addFolder]);

    const loadCurrentDirectoryFiles = useCallback(async () => {
        const folderStack = getFolderStacksFromStore(store.getState())[topDirectory];
        const currentFolderId = folderStack[folderStack.length - 1];
        const uploadPlaceholders = getUploadPlaceholdersFromStore(store.getState());
        // Don't try to load a directory that's currently a placeholder.
        if (uploadPlaceholders.entities[currentFolderId]?.upload) {
            return;
        }
        const files = getAllFilesFromStore(store.getState());
        const leftBehind = Object.fromEntries(
            (files.children[currentFolderId] || []).map((fileId) => (
                // Don't consider files that are mid-upload to be left behind.
                [fileId, uploadPlaceholders.entities[fileId] === undefined]
            ))
        );
        setLoading(true);
        try {
            await fileAPI.loadFilesInFolder(currentFolderId, (files: FileMetadata[]) => {
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

    const onSearch = useCallback(async (searchTerm: string) => {
        if (searchTerm) {
            setShowBusySpinner(true);
            const matches = await fileAPI.findFilesContainingNameWithProperty(searchTerm, 'rootFolder', topDirectory) as FileMetadata<A, B>[];
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
    const allFiles = useSelector(getAllFilesFromStore);

    // Effects

    // Effect to load the files in the current directory when we change directories.
    useEffect(() => {
        // Bogus length test on folderStack to make this effect trigger when folderStack changes.
        if (folderStack.length > 0) {
            loadCurrentDirectoryFiles();
        }
    }, [loadCurrentDirectoryFiles, folderStack]);

    // Effect to trigger an auto-edit when a single image is uploaded
    const {singleMetadata, uploading} = uploadPlaceholders;
    useEffect(() => {
        if (singleMetadata && !uploading) {
            setNewFile(true);
            setEditMetadata(singleMetadata as FileMetadata<A, B>);
            store.dispatch(clearSingleMetadata());
        }
    }, [store, singleMetadata, uploading]);

    // Effect to remove any deleted files from the user's selection if allFiles changes.
    useEffect(() => {
        if (selectedMetadataIds) {
            const toRemove = Object.keys(selectedMetadataIds).filter((id) => (
                !allFiles.fileMetadata[id] || allFiles.fileMetadata[id].trashed
            ));
            if (toRemove.length > 0) {
                const stillSelected = omit(selectedMetadataIds, toRemove);
                setSelectedMetadataIds(isEmpty(stillSelected) ? undefined : stillSelected);
            }
        }
    }, [selectedMetadataIds, allFiles]);

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

    const EditorComponent = editorComponent;

    return (editMetadata) ? (
        (editMetadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) ? (
            <RenameFileEditor metadata={editMetadata} onClose={onCloseEditor} />
        ) : (
            <EditorComponent
                metadata={editMetadata}
                onClose={onCloseEditor}
                newFile={newFile}
                {...editorExtraProps}
            />
        )
    ) : (showBusySpinner)  ? (
        <div className='fileThumbnail'><Spinner size={60}/></div>
    ) : (
        <DragDropPasteUploadContainer topDirectory={topDirectory}
                                      handlePasteText={uploadWebLinks}
                                      disabled={!allowUploadAndWebLink}
        >
            <RubberBandGroup setSelectedIds={onRubberBandSelectIds}>
                <FullScreenScrollPanel
                    before={(
                        <>
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
                                                     onChange={onUploadInput}>Upload</InputButton>
                                        <InputButton type='button'
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
                            <OngoingUploadIndicator />
                            {
                                searchResult ? (
                                    <div>{topDirectory} with names matching "{searchTerm}"</div>
                                ) : (
                                    <BreadCrumbs folders={folderStack} onChange={(folderStack: string[]) => {
                                        store.dispatch(updateFolderStackAction(topDirectory, folderStack));
                                    }}/>
                                )
                            }
                        </>
                    )}
                >
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
                </FullScreenScrollPanel>
            </RubberBandGroup>
        </DragDropPasteUploadContainer>
    );
};

function getFilenameFromUrl(url: string): string {
    return url.split('#').shift()!.split('?').shift()!.split('/').pop()!;
}

export default BrowseFilesComponent;