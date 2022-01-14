import {ChangeEvent, Component, ComponentType, DragEvent, ReactElement} from 'react';
import {Store} from 'redux';
import * as PropTypes from 'prop-types';
import {toast, ToastContainer} from 'react-toastify';
import {omit, pick} from 'lodash';
import classNames from 'classnames';

import {addFilesAction, FileIndexReducerType, removeFileAction, updateFileAction} from '../redux/fileIndexReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import InputButton from '../presentation/inputButton';
import * as constants from '../util/constants';
import FileThumbnail from '../presentation/fileThumbnail';
import BreadCrumbs from '../presentation/breadCrumbs';
import {
    AnyAppProperties,
    AnyProperties,
    anyPropertiesTooLong,
    DriveMetadata,
    isMetadataOwnedByMe,
    isTabletopFileMetadata,
    isWebLinkProperties,
} from '../util/googleDriveUtils';
import {FileAPIContext, splitFileName} from '../util/fileUtils';
import RenameFileEditor from '../presentation/renameFileEditor';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {TextureLoaderContext} from '../util/driveTextureLoader';
import {DropDownMenuClickParams, DropDownMenuOption} from '../presentation/dropDownMenu';
import Spinner from '../presentation/spinner';
import InputField from '../presentation/inputField';
import SearchBar from '../presentation/searchBar';
import RubberBandGroup, {makeSelectableChildHOC} from '../presentation/rubberBandGroup';
import {updateFolderStackAction} from '../redux/folderStacksReducer';
import {
    createMultipleUploadPlaceholders,
    createUploadPlaceholder,
    replaceUploadPlaceholder,
    UploadType
} from '../util/uploadPlaceholderUtils';
import {cancelUploadPlaceholderUploadingAction, clearSingleMetadata, UploadPlaceholderReducerType} from '../redux/uploadPlaceholderReducer';

const SelectableFileThumbnail = makeSelectableChildHOC(FileThumbnail);

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

interface BrowseFilesComponentProps<A extends AnyAppProperties, B extends AnyProperties> extends GtoveDispatchProp {
    store: Store<ReduxStoreType>;
    files: FileIndexReducerType;
    topDirectory: string;
    folderStack: string[];
    uploadPlaceholders: UploadPlaceholderReducerType;
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

interface BrowseFilesComponentState {
    editMetadata?: DriveMetadata;
    newFile: boolean;
    fileDragActive: boolean;
    loading: boolean;
    showBusySpinner: boolean;
    searchResult?: DriveMetadata[];
    searchTerm?: string;
    selectedMetadataIds?: {[metadataId: string]: boolean | undefined};
}

export default class BrowseFilesComponent<A extends AnyAppProperties, B extends AnyProperties> extends Component<BrowseFilesComponentProps<A, B>, BrowseFilesComponentState> {

    static URL_REGEX = new RegExp('^[a-z][-a-z0-9+.]*:\\/\\/(%[0-9a-f][0-9a-f]|[-a-z0-9._~!$&\'()*+,;=:])*\\/');

    static contextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: FileAPIContext & TextureLoaderContext & PromiseModalContext;

    constructor(props: BrowseFilesComponentProps<A, B>) {
        super(props);
        this.onClickThumbnail = this.onClickThumbnail.bind(this);
        this.onUploadInput = this.onUploadInput.bind(this);
        this.onWebLinksPressed = this.onWebLinksPressed.bind(this);
        this.cancelUploads = this.cancelUploads.bind(this);
        this.onPaste = this.onPaste.bind(this);
        this.onFileDragDrop = this.onFileDragDrop.bind(this);
        this.showBusySpinner = this.showBusySpinner.bind(this);
        this.onRubberBandSelectIds = this.onRubberBandSelectIds.bind(this);
        this.state = {
            editMetadata: undefined,
            newFile: false,
            fileDragActive: false,
            loading: false,
            showBusySpinner: false
        };
    }

    componentDidMount() {
        this.loadCurrentDirectoryFiles();
        // Register onPaste event manually, because user-select: none disables clipboard events in Chrome
        document.addEventListener('paste', this.onPaste);
    }

    componentWillUnmount() {
        document.removeEventListener('paste', this.onPaste);
    }

    componentDidUpdate(prevProps: BrowseFilesComponentProps<A, B>) {
        if (prevProps.folderStack.length !== this.props.folderStack.length && !this.state.loading) {
            this.loadCurrentDirectoryFiles();
        }
        if (this.props.uploadPlaceholders.singleMetadata && !this.props.uploadPlaceholders.uploading) {
            this.setState({editMetadata: this.props.uploadPlaceholders.singleMetadata});
            this.props.dispatch(clearSingleMetadata());
        }
    }

    async loadCurrentDirectoryFiles() {
        const currentFolderId = this.props.folderStack[this.props.folderStack.length - 1];
        const leftBehind = (this.props.files.children[currentFolderId] || []).reduce((all, fileId) => {
            // Don't consider files that are mid-upload to be left behind.
            all[fileId] = (this.props.uploadPlaceholders.entities[fileId] === undefined);
            return all;
        }, {});
        this.setState({loading: true});
        try {
            await this.context.fileAPI.loadFilesInFolder(currentFolderId, (files: DriveMetadata[]) => {
                this.props.dispatch(addFilesAction(files));
                files.forEach((metadata) => {leftBehind[metadata.id] = false});
            });
            // Clean up any files that are no longer in directory
            Object.keys(leftBehind)
                .filter((fileId) => (leftBehind[fileId]))
                .forEach((fileId) => {
                    this.props.dispatch(removeFileAction({id: fileId, parents: [currentFolderId]}));
                });
        } catch (err) {
            console.log('Error getting contents of current folder', err);
        }
        this.setState({loading: false});
    }

    async uploadMultipleFiles(upload: UploadType) {
        const parents = this.props.folderStack.slice(this.props.folderStack.length - 1);
        return createMultipleUploadPlaceholders(this.props.store, this.props.topDirectory, this.context.fileAPI, upload, parents);
    }

    onUploadInput(event?: ChangeEvent<HTMLInputElement>) {
        if (event && event.target.files) {
            this.uploadMultipleFiles({
                name: '.',
                files: Array.from(event.target.files)
            });
        }
    }

    getFilenameFromUrl(url: string): string {
        return url.split('#').shift()!.split('?').shift()!.split('/').pop()!;
    }

    async uploadWebLinks(text: string) {
        const webLinkArray = text.split(/\s+/)
            .filter((text) => (text.toLowerCase().match(BrowseFilesComponent.URL_REGEX)));
        if (webLinkArray.length > 0) {
            const parents = this.props.folderStack.slice(this.props.folderStack.length - 1);
            const placeholders = webLinkArray.map((link) => (
                createUploadPlaceholder(this.props.store, this.props.topDirectory, this.getFilenameFromUrl(link), parents)
            ));
            let driveMetadata: DriveMetadata | null = null;
            for (let webLink of webLinkArray) {
                const metadata: Partial<DriveMetadata> = {
                    name: this.getFilenameFromUrl(webLink),
                    parents: this.props.folderStack.slice(this.props.folderStack.length - 1),
                    properties: {webLink}
                };
                if (anyPropertiesTooLong(metadata.properties)) {
                    toast(`URL is too long: ${webLink}`);
                } else {
                    driveMetadata = await this.context.fileAPI.uploadFileMetadata(metadata);
                    await this.context.fileAPI.makeFileReadableToAll(driveMetadata);
                }
                const placeholderMetadata = placeholders.shift()!;
                replaceUploadPlaceholder(this.props.store, this.props.topDirectory, placeholderMetadata, driveMetadata);
            }
            if (driveMetadata && webLinkArray.length === 1 && isMetadataOwnedByMe(driveMetadata)) {
                // For single file upload, automatically edit after creating if it's owned by me
                this.setState({editMetadata: driveMetadata, newFile: true});
            }
        }
    }

    async onWebLinksPressed() {
        let textarea: HTMLTextAreaElement;
        if (this.context.promiseModal?.isAvailable()) {
            const result = await this.context.promiseModal({
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
                this.uploadWebLinks(result);
            }
        }
    }

    cancelUploads() {
        this.props.dispatch(cancelUploadPlaceholderUploadingAction());
    }

    onPaste(event: ClipboardEvent) {
        // Only support paste on pages which allow upload.
        if (this.props.allowUploadAndWebLink && event.clipboardData) {
            if (event.clipboardData.files && event.clipboardData.files.length > 0) {
                this.uploadMultipleFiles({
                    name: '.',
                    files: Array.from(event.clipboardData.files)
                });
            } else {
                this.uploadWebLinks(event.clipboardData.getData('text'));
            }
        }
    }

    async uploadDataFromEntryList(entryList: any[], name = '.'): Promise<UploadType> {
        const result: UploadType = {name, files: []};
        let resolveDirectoryPromise: () => void;
        const directoryPromise = new Promise<void>((resolve) => {resolveDirectoryPromise = resolve});
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
                    const subdir = await this.uploadDataFromEntryList(directoryEntries, entry.name);
                    result.subdirectories.push(subdir);
                    decrementRemaining();
                });
            }
        }
        decrementRemaining(); // in case entryList was empty.
        await directoryPromise;
        return result;
    }

    // Attempt to use experimental webkitGetAsEntry approach, to allow uploading whole directories
    async uploadDataTransferItemList(itemList: DataTransferItemList): Promise<UploadType> {
        if (itemList.length && typeof(itemList[0].webkitGetAsEntry) === 'function') {
            const entries: any[] = [];
            for (let item of itemList) {
                entries.push(item.webkitGetAsEntry());
            }
            return this.uploadDataFromEntryList(entries);
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

    async onFileDragDrop(event: DragEvent<HTMLDivElement>) {
        // Default behaviour of the dragOver event is to "reset the current drag operation to none", so it needs
        // to be prevented for file drag & drop to work.
        event.preventDefault();
        if (this.props.allowUploadAndWebLink) {
            // Only handle file drag and drop on pages which allow upload.
            switch (event.type) {
                case 'dragenter':
                case 'dragleave':
                    this.setState({fileDragActive: event.type === 'dragenter'});
                    break;
                case 'drop':
                    this.setState({fileDragActive: false});
                    const dataTransfer = event.nativeEvent.dataTransfer;
                    if (dataTransfer) {
                        let upload: UploadType;
                        if (dataTransfer.items) {
                            upload = await this.uploadDataTransferItemList(dataTransfer.items);
                        } else if (dataTransfer.files) {
                            upload = {name: '.', files: []};
                            for (let file of dataTransfer.files) {
                                upload.files.push(file);
                            }
                        } else {
                            toast('File drag and drop not supported on this browser.');
                            break;
                        }
                        await this.uploadMultipleFiles(upload);
                    } else {
                        toast('File drag and drop not supported on this browser.');
                    }
                    break;
            }
        }
    }

    async onGlobalAction(action: BrowseFilesComponentGlobalAction<A, B>) {
        const parents = this.props.folderStack.slice(this.props.folderStack.length - 1);
        const placeholderMetadata = !action.createsFile ? undefined :
            createUploadPlaceholder(this.props.store, this.props.topDirectory, '', parents);
        const driveMetadata = await action.onClick(parents);
        if (placeholderMetadata && driveMetadata) {
            await replaceUploadPlaceholder(this.props.store, this.props.topDirectory, placeholderMetadata, driveMetadata);
            if (isMetadataOwnedByMe(driveMetadata)) {
                this.setState({editMetadata: driveMetadata, newFile: true});
            }
        }
    }

    onEditFile(metadata: DriveMetadata) {
        this.setState({editMetadata: metadata, newFile: false});
    }

    async onDeleteFile(metadata: DriveMetadata) {
        if (this.context.promiseModal?.isAvailable()) {
            if (metadata.id === this.props.highlightMetadataId) {
                await this.context.promiseModal({
                    children: 'Can\'t delete the currently selected file.'
                });
            } else {
                const yesOption = 'Yes';
                const response = await this.context.promiseModal({
                    children: `Are you sure you want to delete ${metadata.name}?`,
                    options: [yesOption, 'Cancel']
                });
                if (response === yesOption) {
                    this.props.dispatch(removeFileAction(metadata));
                    await this.context.fileAPI.deleteFile(metadata);
                    if (isTabletopFileMetadata(metadata)) {
                        // Also trash the private GM file.
                        await this.context.fileAPI.deleteFile({id: metadata.appProperties.gmFile});
                    }
                }
            }
        }
    }

    onSelectFile(metadata: DriveMetadata) {
        this.setState(({selectedMetadataIds}) => ({
            selectedMetadataIds: selectedMetadataIds ? {...selectedMetadataIds, [metadata.id]: true} : {[metadata.id]: true}
        }));
    }

    onRubberBandSelectIds(updatedIds: {[metadataId: string]: boolean | undefined}) {
        const selectedMetadataIds = this.state.selectedMetadataIds;
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
                this.setState({selectedMetadataIds: Object.keys(selected).length > 0 ? selected : undefined});
            }
        } else {
            const selectedIds = Object.keys(updatedIds).filter((metadataId) => (updatedIds[metadataId]));
            if (Object.keys(selectedIds).length > 0) {
                this.setState({selectedMetadataIds: pick(updatedIds, selectedIds)});
            }
        }
    }

    private showBusySpinner(show: boolean) {
        this.setState({showBusySpinner: show});
    }

    onClickThumbnail(fileId: string) {
        const metadata = this.props.files.driveMetadata[fileId] as DriveMetadata<A, B>;
        const fileMenu = this.buildFileMenu(metadata);
        // Perform the first enabled menu action
        const firstItem = fileMenu.find((menuItem) => (!menuItem.disabled));
        if (firstItem) {
            firstItem.onClick({showBusySpinner: this.showBusySpinner});
        }
    }

    async onAddFolder(prefix = ''): Promise<void> {
        const promiseModal = this.context.promiseModal;
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
            const currentFolder = this.props.folderStack[this.props.folderStack.length - 1];
            const valid = (this.props.files.children[currentFolder] || []).reduce((valid, fileId) => {
                return valid && (name.toLowerCase() !== this.props.files.driveMetadata[fileId].name.toLowerCase());
            }, true);
            if (valid) {
                createUploadPlaceholder(this.props.store, this.props.topDirectory, name, [currentFolder], undefined, true, true);
            } else {
                return this.onAddFolder('That name is already in use.  ');
            }
        }
    }

    buildFileMenu(metadata: DriveMetadata<A, B>): DropDownMenuOption<BrowseFilesComponentFileOnClickOptionalResult<A, B>>[] {
        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
        let fileActions: BrowseFilesComponentFileAction<A, B>[] = isFolder ? [
            {label: 'Open', onClick: () => {
                this.props.dispatch(updateFolderStackAction(this.props.topDirectory, [...this.props.folderStack, metadata.id]));
            }},
            {label: 'Rename', onClick: 'edit'},
            {label: 'Select', onClick: 'select'},
            {label: 'Delete', onClick: 'delete', disabled: () => (metadata.id === this.props.highlightMetadataId)}
        ] : this.props.fileActions;
        if (this.state.searchResult) {
            fileActions = [...fileActions, {
                label: 'View in folder',
                onClick: async () => {
                    this.setState({showBusySpinner: true});
                    // Need to build the breadcrumbs
                    const rootFolderId = this.props.files.roots[this.props.topDirectory];
                    const folderStack = [];
                    for (let folderId = metadata.parents[0]; folderId !== rootFolderId; folderId = this.props.files.driveMetadata[folderId].parents[0]) {
                        folderStack.push(folderId);
                        if (!this.props.files.driveMetadata[folderId]) {
                            this.props.dispatch(addFilesAction([await this.context.fileAPI.getFullMetadata(folderId)]));
                        }
                    }
                    folderStack.push(rootFolderId);
                    this.props.dispatch(updateFolderStackAction(this.props.topDirectory, folderStack.reverse()));
                    this.setState({showBusySpinner: false, searchTerm: undefined, searchResult: undefined});
                }}];
        }
        return fileActions.map((fileAction) => {
            let disabled = fileAction.disabled ? fileAction.disabled(metadata) : false;
            const selected = this.state.selectedMetadataIds ? this.state.selectedMetadataIds[metadata.id] : false;
            let onClick;
            const fileActionOnClick = fileAction.onClick;
            if (fileActionOnClick === 'edit') {
                onClick = () => (this.onEditFile(metadata));
            } else if (fileActionOnClick === 'delete') {
                onClick = () => (this.onDeleteFile(metadata));
            } else if (fileActionOnClick === 'select') {
                onClick = () => (this.onSelectFile(metadata));
                disabled = disabled || selected || false;
            } else {
                onClick = async (parameters: DropDownMenuClickParams) => {
                    const result = await fileActionOnClick(metadata, parameters);
                    if (result && result.postAction === 'edit') {
                        this.onEditFile(result.metadata);
                    }
                };
            }
            return {
                label: fileAction.label,
                disabled,
                onClick
            };
        });
    }

    renderFileThumbnail(metadata: DriveMetadata<A, B>, overrideOnClick?: (fileId: string) => void) {
        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
        const isJson = (metadata.mimeType === constants.MIME_TYPE_JSON);
        const name = (metadata.appProperties || metadata.properties) ? splitFileName(metadata.name).name : metadata.name;
        const menuOptions = overrideOnClick ? undefined : this.buildFileMenu(metadata);
        const placeholder = this.props.uploadPlaceholders.entities[metadata.id];
        const progress = !placeholder ? undefined : (placeholder.progress / (placeholder.targetProgress || 1));
        return (
            <SelectableFileThumbnail
                childId={metadata.id}
                key={metadata.id}
                fileId={metadata.id}
                name={name}
                isFolder={isFolder}
                isIcon={isJson}
                isNew={this.props.fileIsNew ? (!isFolder && !isJson && this.props.fileIsNew(metadata)) : false}
                progress={progress}
                thumbnailLink={isWebLinkProperties(metadata.properties) ? metadata.properties.webLink : metadata.thumbnailLink}
                onClick={overrideOnClick || this.onClickThumbnail}
                highlight={this.props.highlightMetadataId === metadata.id || (this.state.selectedMetadataIds && this.state.selectedMetadataIds[metadata.id])}
                menuOptions={menuOptions}
                icon={(typeof(this.props.jsonIcon) === 'function') ? this.props.jsonIcon(metadata) : this.props.jsonIcon}
                showBusySpinner={this.showBusySpinner}
                fetchMissingThumbnail={async () => {
                    // video files can take a while to populate their thumbnailLink, so we need a mechanism to retry
                    const fullMetadata = await this.context.fileAPI.getFullMetadata(metadata.id);
                    const thumbnailLink = isWebLinkProperties(fullMetadata.properties) ? fullMetadata.properties.webLink : fullMetadata.thumbnailLink;
                    if (thumbnailLink) {
                        this.props.dispatch(updateFileAction(fullMetadata));
                    }
                }}
            />
        );
    }

    renderSearchResults() {
        const searchResult = this.state.searchResult!;
        return (
            <div>
                {
                    searchResult.length === 0 ? (
                        <p>
                            No matching results found.  Note that the search will not find files which are marked as
                            <span className='material-icons' style={{color: 'green'}}>fiber_new</span> or folders.
                        </p>
                    ) : (
                        searchResult.map((file) => (this.renderFileThumbnail(file as DriveMetadata<A, B>)))
                    )
                }
            </div>
        );
    }

    sortMetadataIds(metadataIds: string[] = []): string[] {
        return metadataIds
            .filter((id) => (this.props.files.driveMetadata[id]))
            .sort((id1, id2) => {
                const file1 = this.props.files.driveMetadata[id1];
                const file2 = this.props.files.driveMetadata[id2];
                const isFolder1 = (file1.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                const isFolder2 = (file2.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                if (isFolder1 && !isFolder2) {
                    return -1;
                } else if (!isFolder1 && isFolder2) {
                    return 1;
                } else {
                    return file1.name < file2.name ? -1 : (file1.name === file2.name ? 0 : 1);
                }
            });
    }

    isMovingFolderAncestorOfFolder(movingFolderId: string, folderId: string) {
        if (movingFolderId === folderId) {
            return true;
        }
        const metadata = this.props.files.driveMetadata[folderId];
        if (metadata && metadata.parents) {
            for (let parent of metadata.parents) {
                if (this.isMovingFolderAncestorOfFolder(movingFolderId, parent)) {
                    return true;
                }
            }
        }
        return false;
    }

    isSelectedMoveValidHere(currentFolder?: string) {
        if (currentFolder === undefined) {
            return false;
        }
        if (this.state.selectedMetadataIds) {
            // Check if all selected metadata are already in this folder, or if any of them are ancestor folders.
            let anyElsewhere = false;
            for (let metadataId of Object.keys(this.state.selectedMetadataIds)) {
                if (!this.state.selectedMetadataIds[metadataId]) {
                    // Ignore things that are no longer selected
                    continue;
                }
                const metadata = this.props.files.driveMetadata[metadataId];
                if (!metadata) {
                    // If metadata is missing, we need to load it, but also return false in the interim.
                    this.context.fileAPI.getFullMetadata(metadataId)
                        .then((metadata) => {this.props.dispatch(addFilesAction([metadata]))});
                    return false;
                }
                if (metadata.parents.indexOf(currentFolder) < 0) {
                    anyElsewhere = true;
                }
                if (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER && this.isMovingFolderAncestorOfFolder(metadataId, currentFolder)) {
                    return false;
                }
            }
            return anyElsewhere;
        }
        return true;
    }

    renderThumbnails(currentFolder: string) {
        const sorted = this.sortMetadataIds(this.props.files.children[currentFolder]);
        const folderDepth = this.props.folderStack.length;
        return (
            <div>
                {
                    folderDepth === 1 ? null : (
                        <FileThumbnail
                            fileId={this.props.folderStack[folderDepth - 2]}
                            name={this.props.files.driveMetadata[this.props.folderStack[folderDepth - 2]].name}
                            isFolder={false}
                            isIcon={true}
                            icon='arrow_back'
                            isNew={false}
                            onClick={() => {
                                this.props.dispatch(updateFolderStackAction(this.props.topDirectory, this.props.folderStack.slice(0, folderDepth - 1)));
                            }}
                            showBusySpinner={this.showBusySpinner}
                        />
                    )
                }
                {
                    sorted.map((fileId: string) => (
                        this.renderFileThumbnail(this.props.files.driveMetadata[fileId] as DriveMetadata<A, B>)
                    ))
                }
                {
                    !this.props.uploadPlaceholders.uploading ? null : (
                        <InputButton type='button' onChange={this.cancelUploads}>Cancel uploads</InputButton>
                    )
                }
                {
                    !this.state.loading ? null : (
                        <div className='fileThumbnail'><Spinner size={60}/></div>
                    )
                }
                {
                    !this.props.screenInfo ? null :
                        typeof(this.props.screenInfo) === 'function' ? this.props.screenInfo(currentFolder, sorted, this.state.loading) : this.props.screenInfo
                }
            </div>
        );
    }

    renderSelectedFiles(currentFolder?: string) {
        return !this.state.selectedMetadataIds ? null : (
            <div className='selectedFiles'>
                {
                    !this.state.selectedMetadataIds ? null : (
                        <FileThumbnail
                            fileId={'cancel'} name={'Cancel select'} isFolder={false} isIcon={true} icon='close'
                            isNew={false} showBusySpinner={this.showBusySpinner} onClick={() => {
                            this.setState({selectedMetadataIds: undefined});
                        }}
                        />
                    )
                }
                <FileThumbnail
                    fileId={'move'} name={'Move to this folder'} isFolder={false} isIcon={true} icon='arrow_downward'
                    disabled={!this.isSelectedMoveValidHere(currentFolder)} isNew={false} showBusySpinner={this.showBusySpinner}
                    onClick={async () => {
                        const {selectedMetadataIds} = this.state;
                        // Clear selected files and start loading spinner
                        this.setState({selectedMetadataIds: undefined, loading: true});
                        // update parents of selected metadataIds
                        for (let metadataId of Object.keys(selectedMetadataIds!)) {
                            const metadata = this.props.files.driveMetadata[metadataId];
                            if (metadata.parents && metadata.parents.indexOf(currentFolder!) < 0) {
                                const newMetadata = await this.context.fileAPI.uploadFileMetadata(metadata, [currentFolder!], metadata.parents);
                                this.props.dispatch(updateFileAction(newMetadata));
                            }
                        }
                        // Trigger refresh of this folder
                        await this.loadCurrentDirectoryFiles();
                    }}
                />
                {
                    !this.props.allowMultiPick ? null : (
                        <FileThumbnail
                            fileId={'pick'} name={'Pick selected'} isFolder={false} isIcon={true} icon='touch_app'
                            disabled={Object.keys(this.state.selectedMetadataIds!).length === 0} isNew={false} showBusySpinner={this.showBusySpinner}
                            onClick={async () => {
                                const pickAction = this.props.fileActions[0].onClick;
                                if (pickAction === 'edit' || pickAction === 'select' || pickAction === 'delete') {
                                    return;
                                }
                                this.showBusySpinner(true);
                                const isDisabled = this.props.fileActions[0].disabled;
                                for (let metadataId of Object.keys(this.state.selectedMetadataIds!)) {
                                    const metadata = this.props.files.driveMetadata[metadataId] as DriveMetadata<A, B>;
                                    if (!isDisabled || !isDisabled(metadata)) {
                                        await pickAction(metadata);
                                    }
                                }
                                this.showBusySpinner(false);
                            }}
                        />
                    )
                }
                {
                    this.sortMetadataIds(Object.keys(this.state.selectedMetadataIds).filter((metadataId) => (this.state.selectedMetadataIds![metadataId])))
                        .map((metadataId) => (
                            this.renderFileThumbnail(this.props.files.driveMetadata[metadataId] as DriveMetadata<A, B>, (fileId) => {
                                const selectedMetadataIds = omit(this.state.selectedMetadataIds, fileId);
                                this.setState({selectedMetadataIds: Object.keys(selectedMetadataIds).length > 0 ? selectedMetadataIds : undefined});
                            }))
                        )
                }
            </div>
        );
    }

    renderBrowseFiles() {
        const uploadInProgress = (this.props.uploadPlaceholders.ids.length > 0);
        return (
            <div className={classNames('fullHeight', {fileDragActive: this.state.fileDragActive})}
                 onDragEnter={this.onFileDragDrop} onDragLeave={this.onFileDragDrop} onDragOver={this.onFileDragDrop}
                 onDrop={this.onFileDragDrop}
            >
                <RubberBandGroup setSelectedIds={this.onRubberBandSelectIds}>
                    {
                        !this.props.onBack ? null : (
                            <InputButton type='button' onChange={this.props.onBack}>Finish</InputButton>
                        )
                    }
                    {
                        !this.state.searchResult ? null : (
                            <InputButton type='button' onChange={() => {this.setState({searchResult: undefined, searchTerm: undefined})}}>Clear Search</InputButton>
                        )
                    }
                    {
                        this.state.searchResult || !this.props.allowUploadAndWebLink ? null : (
                            <InputButton type='file' multiple={true}
                                         disabled={uploadInProgress}
                                         onChange={this.onUploadInput}>Upload</InputButton>
                        )
                    }
                    {
                        this.state.searchResult || !this.props.allowUploadAndWebLink ? null : (
                            <InputButton type='button'
                                         disabled={uploadInProgress}
                                         onChange={this.onWebLinksPressed}>Link to Images</InputButton>
                        )
                    }
                    {
                        this.state.searchResult || !this.props.globalActions ? null : (
                            this.props.globalActions
                                .filter((action) => (!action.hidden))
                                .map((action) => (
                                    <InputButton type='button' key={action.label} onChange={() => (this.onGlobalAction(action))}>{action.label}</InputButton>
                                ))
                        )
                    }
                    {
                        this.state.searchResult ? null : (
                            <InputButton type='button' onChange={() => this.onAddFolder()}>Add Folder</InputButton>
                        )
                    }
                    {
                        this.state.searchResult ? null : (
                            <InputButton type='button' onChange={() => this.loadCurrentDirectoryFiles()}>Refresh</InputButton>
                        )
                    }
                    {
                        !this.props.showSearch ? null : (
                            <SearchBar placeholder={'Search all ' + this.props.topDirectory}
                                       initialValue={this.state.searchTerm || ''}
                                       onSearch={async (searchTerm) => {
                                           if (searchTerm) {
                                               this.setState({showBusySpinner: true});
                                               const matches = await this.context.fileAPI.findFilesContainingNameWithProperty(searchTerm, 'rootFolder', this.props.topDirectory);
                                               this.setState({showBusySpinner: false});
                                               matches.sort((f1, f2) => (f1.name < f2.name ? -1 : f1.name > f2.name ? 1 : 0));
                                               this.setState({searchResult: matches, searchTerm});
                                               this.props.dispatch(addFilesAction(matches));
                                           } else {
                                               this.setState({searchResult: undefined, searchTerm: undefined});
                                           }
                                       }}
                            />
                        )
                    }
                    {
                        this.state.searchResult ? (
                            <div>{this.props.topDirectory} with names matching "{this.state.searchTerm}"</div>
                        ) : (
                            <BreadCrumbs folders={this.props.folderStack} files={this.props.files} onChange={(folderStack: string[]) => {
                                this.props.dispatch(updateFolderStackAction(this.props.topDirectory, folderStack));
                            }}/>
                        )
                    }
                    {
                        this.state.searchResult ? this.renderSearchResults() : this.renderThumbnails(this.props.folderStack[this.props.folderStack.length - 1])
                    }
                    {
                        this.renderSelectedFiles(this.state.searchResult ? undefined : this.props.folderStack[this.props.folderStack.length - 1])
                    }
                    <ToastContainer className='toastContainer' position={toast.POSITION.BOTTOM_CENTER} hideProgressBar={true}/>
                </RubberBandGroup>
            </div>
        );
    }

    render() {
        if (this.state.editMetadata) {
            const Editor = (this.state.editMetadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) ? RenameFileEditor : this.props.editorComponent;
            return (
                <Editor
                    metadata={this.state.editMetadata}
                    onClose={() => {this.setState({editMetadata: undefined, newFile: false})}}
                    textureLoader={this.context.textureLoader}
                    newFile={this.state.newFile}
                    {...this.props.editorExtraProps}
                />
            );
        } else if (this.state.showBusySpinner) {
            return (
                <div className='fileThumbnail'><Spinner size={60}/></div>
            );
        } else {
            return this.renderBrowseFiles();
        }
    }

}
