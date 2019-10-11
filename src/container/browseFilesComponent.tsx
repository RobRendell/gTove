import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {v4} from 'uuid';
import {toast, ToastContainer} from 'react-toastify';

import {addFilesAction, FileIndexReducerType, removeFileAction} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, ReduxStoreType} from '../redux/mainReducer';
import InputButton from '../presentation/inputButton';
import * as constants from '../util/constants';
import FileThumbnail from '../presentation/fileThumbnail';
import BreadCrumbs from '../presentation/breadCrumbs';
import {Dispatch} from 'redux';
import {anyAppPropertiesTooLong, DriveMetadata, isWebLinkAppProperties} from '../util/googleDriveUtils';
import {FileAPIContext, OnProgressParams, splitFileName} from '../util/fileUtils';
import RenameFileEditor from '../presentation/renameFileEditor';
import {PromiseModalContext} from './authenticatedContainer';
import {TextureLoaderContext} from '../util/driveTextureLoader';
import {DropDownMenuOption} from '../presentation/dropDownMenu';
import Spinner from '../presentation/spinner';
import InputField from '../presentation/inputField';

export type BrowseFilesComponentGlobalAction = {
    label: string;
    onClick: (parents: string[]) => Promise<DriveMetadata>;
    hidden?: boolean;
};

type BrowseFilesComponentFileAction = {
    label: string;
    onClick: 'edit' | 'delete' | ((metadata: DriveMetadata) => void);
    disabled?: (metadata: DriveMetadata) => boolean;
};

interface BrowseFilesComponentProps {
    dispatch: Dispatch<ReduxStoreType>;
    files: FileIndexReducerType;
    topDirectory: string;
    folderStack: string[];
    setFolderStack: (root: string, folderStack: string[]) => void;
    fileActions: BrowseFilesComponentFileAction[];
    fileIsNew?: (metadata: DriveMetadata) => boolean;
    editorComponent: React.ComponentClass<any>;
    onBack?: () => void;
    globalActions?: BrowseFilesComponentGlobalAction[];
    allowUploadAndWebLink: boolean;
    screenInfo?: React.ReactElement<any> | ((directory: string, fileIds: string[], loading: boolean) => React.ReactElement<any>);
    highlightMetadataId?: string;
    jsonIcon?: string | ((metadata: DriveMetadata) => React.ReactElement<any>);
}

interface BrowseFilesComponentState {
    editMetadata?: DriveMetadata;
    newFile: boolean;
    uploadProgress: {[key: string]: number};
    loading: boolean;
    uploading: boolean;
}

class BrowseFilesComponent extends React.Component<BrowseFilesComponentProps, BrowseFilesComponentState> {

    static URL_REGEX = new RegExp('^[a-z][-a-z0-9+.]*:\\/\\/(%[0-9a-f][0-9a-f]|[-a-z0-9._~!$&\'()*+,;=:])*\\/');

    static contextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: FileAPIContext & TextureLoaderContext & PromiseModalContext;

    constructor(props: BrowseFilesComponentProps) {
        super(props);
        this.onClickThumbnail = this.onClickThumbnail.bind(this);
        this.onUploadInput = this.onUploadInput.bind(this);
        this.onWebLinksPressed = this.onWebLinksPressed.bind(this);
        this.onPaste = this.onPaste.bind(this);
        this.state = {
            editMetadata: undefined,
            newFile: false,
            uploadProgress: {},
            loading: false,
            uploading: false
        };
    }

    componentDidMount() {
        this.loadCurrentDirectoryFiles();
    }

    componentWillReceiveProps(props: BrowseFilesComponentProps) {
        if (props.folderStack.length !== this.props.folderStack.length) {
            this.loadCurrentDirectoryFiles(props);
        }
    }

    loadCurrentDirectoryFiles(props: BrowseFilesComponentProps = this.props) {
        const currentFolderId = props.folderStack[props.folderStack.length - 1];
        this.setState({loading: true});
        this.context.fileAPI.loadFilesInFolder(currentFolderId, (files: DriveMetadata[]) => {props.dispatch(addFilesAction(files))})
            .then(() => {this.setState({loading: false})})
            .catch((err) => {
                console.log('Error getting contents of current folder', err);
                this.setState({loading: false});
            });
    }

    createPlaceholderFile(name: string, parents: string[]): DriveMetadata {
        // Dispatch a placeholder file
        const placeholder: DriveMetadata = {id: v4(), name, parents, trashed: false, appProperties: undefined};
        this.setState((prevState) => ({uploadProgress: {...prevState.uploadProgress, [placeholder.id]: 0}}), () => {
            this.props.dispatch(addFilesAction([placeholder]));
        });
        return placeholder;
    }

    cleanUpPlaceholderFile(placeholder: DriveMetadata, driveMetadata: DriveMetadata | null) {
        this.props.dispatch(removeFileAction(placeholder));
        if (driveMetadata) {
            this.props.dispatch(addFilesAction([driveMetadata]));
        }
        this.setState((prevState) => {
            let uploadProgress = {...prevState.uploadProgress};
            delete(uploadProgress[placeholder.id]);
            return {uploadProgress};
        });
        return driveMetadata;
    }

    uploadSingleFile(file: File, parents: string[], placeholderId: string): Promise<DriveMetadata> {
        return this.context.fileAPI
            .uploadFile({name: file.name, parents}, file, (progress: OnProgressParams) => {
                this.setState((prevState) => {
                    return {
                        uploadProgress: {
                            ...prevState.uploadProgress,
                            [placeholderId]: progress.loaded / progress.total
                        }
                    }
                });
            })
            .then((driveMetadata: DriveMetadata) => {
                return this.context.fileAPI.makeFileReadableToAll(driveMetadata)
                    .then(() => (driveMetadata));
            });
    }

    private isMetadataOwnedByMe(metadata: DriveMetadata) {
        return metadata.owners && metadata.owners.reduce((me, owner) => (me || owner.me), false)
    }

    uploadMultipleFiles(fileArray: File[]) {
        const parents = this.props.folderStack.slice(this.props.folderStack.length - 1);
        const placeholders = fileArray.map((file) => (this.createPlaceholderFile(file && file.name, parents)));
        this.setState({uploading: true}, () => {
            fileArray.reduce((promiseChain: Promise<null | DriveMetadata>, file, index): Promise<null | DriveMetadata> => (
                promiseChain
                    .then(() => ((file && this.state.uploading) ? this.uploadSingleFile(file, parents, placeholders[index].id) : Promise.resolve(null)))
                    .then((metadata: null | DriveMetadata) => (this.cleanUpPlaceholderFile(placeholders[index], metadata)))
            ), Promise.resolve(null))
                .then((driveMetadata) => {
                    if (driveMetadata && fileArray.length === 1 && this.isMetadataOwnedByMe(driveMetadata)) {
                        // For single file upload, automatically edit after creating if it's owned by me
                        this.setState({editMetadata: driveMetadata, newFile: true});
                    }
                    this.setState({uploading: false});
                });
        });
    }

    onUploadInput(event: React.ChangeEvent<HTMLInputElement>) {
        if (event.target.files) {
            this.uploadMultipleFiles(Array.from(event.target.files));
        }
    }

    getFilenameFromUrl(url: string): string {
        return url.split('#').shift()!.split('?').shift()!.split('/').pop()!;
    }

    uploadWebLinks(text: string) {
        const webLinks = text.split(/\s+/)
            .filter((text) => (text.toLowerCase().match(BrowseFilesComponent.URL_REGEX)));
        if (webLinks.length > 0) {
            const parents = this.props.folderStack.slice(this.props.folderStack.length - 1);
            const placeholders = webLinks.map((link) => (this.createPlaceholderFile(this.getFilenameFromUrl(link), parents)));
            this.setState({uploading: true}, () => {
                webLinks
                    .reduce((promiseChain: Promise<null | DriveMetadata>, webLink, index) => (
                        promiseChain.then(() => {
                            const metadata: Partial<DriveMetadata> = {
                                name: this.getFilenameFromUrl(webLink),
                                parents: this.props.folderStack.slice(this.props.folderStack.length - 1),
                                appProperties: {webLink}
                            };
                            if (anyAppPropertiesTooLong(metadata.appProperties)) {
                                toast(`URL is too long: ${webLink}`);
                                return this.cleanUpPlaceholderFile(placeholders[index], null);
                            } else {
                                return this.context.fileAPI.uploadFileMetadata(metadata)
                                    .then((driveMetadata: DriveMetadata) => {
                                        return this.context.fileAPI.makeFileReadableToAll(driveMetadata)
                                            .then(() => (this.cleanUpPlaceholderFile(placeholders[index], driveMetadata)));
                                    })
                            }
                        })
                    ), Promise.resolve(null))
                    .then((driveMetadata) => {
                        if (driveMetadata && webLinks.length === 1 && this.isMetadataOwnedByMe(driveMetadata)) {
                            // For single file upload, automatically edit after creating if it's owned by me
                            this.setState({editMetadata: driveMetadata, newFile: true});
                        }
                        this.setState({uploading: false})
                    });
            });
        }
    }

    onWebLinksPressed() {
        let textarea: HTMLTextAreaElement;
        this.context.promiseModal
            && this.context.promiseModal({
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
            })
            .then((result) => {result && this.uploadWebLinks(result)})
    }

    onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
        // Only support paste on pages which allow upload.
        if (this.props.allowUploadAndWebLink) {
            if (event.clipboardData.files && event.clipboardData.files.length > 0) {
                this.uploadMultipleFiles(Array.from(event.clipboardData.files));
            } else {
                this.uploadWebLinks(event.clipboardData.getData('text'));
            }
        }
    }

    async onGlobalAction(action: BrowseFilesComponentGlobalAction) {
        const parents = this.props.folderStack.slice(this.props.folderStack.length - 1);
        const placeholder = this.createPlaceholderFile('', parents);
        const driveMetadata = await action.onClick(parents);
        this.cleanUpPlaceholderFile(placeholder, driveMetadata);
        if (this.isMetadataOwnedByMe(driveMetadata)) {
            this.setState({editMetadata: driveMetadata, newFile: true});
        }
    }

    onEditFile(metadata: DriveMetadata) {
        this.setState({editMetadata: metadata, newFile: false});
    }

    async onDeleteFile(metadata: DriveMetadata) {
        if (metadata.id === this.props.highlightMetadataId) {
            this.context.promiseModal && await this.context.promiseModal({
                children: 'Can\'t delete the currently selected file.'
            })
        } else {
            const yesOption = 'Yes';
            const response = this.context.promiseModal && await this.context.promiseModal({
                children: `Are you sure you want to delete ${metadata.name}?`,
                options: [yesOption, 'Cancel']
            });
            if (response === yesOption) {
                this.props.dispatch(removeFileAction(metadata));
                await this.context.fileAPI.deleteFile(metadata);
                if (metadata.appProperties && 'gmFile' in metadata.appProperties) {
                    // Also trash the private GM file.
                    await this.context.fileAPI.deleteFile({id: metadata.appProperties.gmFile});
                }
            }
        }
    }

    onClickThumbnail(fileId: string) {
        const metadata = this.props.files.driveMetadata[fileId];
        const fileMenu = this.buildFileMenu(metadata);
        // Perform the first enabled menu action
        const firstItem = fileMenu.find((menuItem) => (!menuItem.disabled));
        if (firstItem) {
            firstItem.onClick();
        }
    }

    async onAddFolder(prefix = ''): Promise<void> {
        const okResponse = 'OK';
        let name: string = 'New Folder';
        const returnAction = () => {this.context.promiseModal && this.context.promiseModal.setResult(okResponse)};
        const response = this.context.promiseModal && await this.context.promiseModal({
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
                this.setState({loading: true});
                const metadata = await this.context.fileAPI.createFolder(name, {parents:[currentFolder]});
                this.props.dispatch(addFilesAction([metadata]));
                this.setState({loading: false});
            } else {
                return this.onAddFolder('That name is already in use.  ');
            }
        }
    }

    buildFileMenu(metadata: DriveMetadata): DropDownMenuOption[] {
        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
        const isOwnedByMe = this.isMetadataOwnedByMe(metadata);
        const fileActions: BrowseFilesComponentFileAction[] = isFolder ? [
            {label: 'Open', onClick: () => {
                this.props.setFolderStack(this.props.topDirectory, [...this.props.folderStack, metadata.id]);
            }},
            {label: 'Rename', onClick: 'edit', disabled: () => (!isOwnedByMe)},
            {label: 'Delete', onClick: 'delete', disabled: () => (metadata.id === this.props.highlightMetadataId)}
        ] : this.props.fileActions;
        return fileActions.map((fileAction) => {
            let disabled = fileAction.disabled ? fileAction.disabled(metadata) : false;
            let onClick;
            const fileActionOnClick = fileAction.onClick;
            if (fileActionOnClick === 'edit') {
                onClick = () => {this.onEditFile(metadata)};
                disabled = disabled || !isOwnedByMe;
            } else if (fileActionOnClick === 'delete') {
                onClick = () => {this.onDeleteFile(metadata)};
            } else {
                onClick = () => {fileActionOnClick(metadata)};
            }
            return {
                label: fileAction.label,
                disabled,
                onClick
            };
        });
    }

    renderThumbnails(currentFolder: string) {
        let sorted = (this.props.files.children[currentFolder] || []).sort((id1, id2) => {
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
                                this.props.setFolderStack(this.props.topDirectory, this.props.folderStack.slice(0, folderDepth - 1));
                            }}
                        />
                    )
                }
                {
                    sorted.map((fileId: string) => {
                        const metadata = this.props.files.driveMetadata[fileId];
                        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                        const isJson = (metadata.mimeType === constants.MIME_TYPE_JSON);
                        const name = metadata.appProperties ? splitFileName(metadata.name).name : metadata.name;
                        const menuOptions = this.buildFileMenu(metadata);
                        return (
                            <FileThumbnail
                                key={fileId}
                                fileId={fileId}
                                name={name}
                                isFolder={isFolder}
                                isIcon={isJson}
                                isNew={this.props.fileIsNew ? (!isFolder && !isJson && this.props.fileIsNew(metadata)) : false}
                                progress={this.state.uploadProgress[fileId] || 0}
                                thumbnailLink={isWebLinkAppProperties(metadata.appProperties) ? metadata.appProperties.webLink : metadata.thumbnailLink}
                                onClick={this.onClickThumbnail}
                                highlight={this.props.highlightMetadataId === metadata.id}
                                menuOptions={menuOptions}
                                icon={(typeof(this.props.jsonIcon) === 'function') ? this.props.jsonIcon(metadata) : this.props.jsonIcon}
                            />
                        );
                    })
                }
                {
                    !this.state.uploading ? null : (
                        <InputButton type='button' onChange={() => {this.setState({uploading: false})}}>Cancel uploads</InputButton>
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

    renderBrowseFiles() {
        return (
            <div className='fullHeight' onPaste={this.onPaste}>
                {
                    !this.props.onBack ? null : (
                        <InputButton type='button' onChange={this.props.onBack}>Finish</InputButton>
                    )
                }
                {
                    !this.props.globalActions ? null : (
                        this.props.globalActions
                            .filter((action) => (!action.hidden))
                            .map((action) => (
                                <InputButton type='button' key={action.label} onChange={() => (this.onGlobalAction(action))}>{action.label}</InputButton>
                            ))
                    )
                }
                {
                    !this.props.allowUploadAndWebLink ? null : (
                        <InputButton type='file' multiple={true} onChange={this.onUploadInput}>Upload</InputButton>
                    )
                }
                {
                    !this.props.allowUploadAndWebLink ? null : (
                        <InputButton type='button' onChange={this.onWebLinksPressed}>Link to Images</InputButton>
                    )
                }
                <InputButton type='button' onChange={() => this.onAddFolder()}>Add Folder</InputButton>
                <InputButton type='button' onChange={() => this.loadCurrentDirectoryFiles()}>Refresh</InputButton>
                <BreadCrumbs folders={this.props.folderStack} files={this.props.files} onChange={(folderStack: string[]) => {
                    this.props.setFolderStack(this.props.topDirectory, folderStack);
                }}/>
                {
                    this.renderThumbnails(this.props.folderStack[this.props.folderStack.length - 1])
                }
                <ToastContainer className='toastContainer' position={toast.POSITION.BOTTOM_CENTER}/>
            </div>
        );
    }

    render() {
        if (this.state.editMetadata) {
            const Editor: React.ComponentClass<any> = (this.state.editMetadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) ? RenameFileEditor : this.props.editorComponent;
            return (
                <Editor
                    metadata={this.state.editMetadata}
                    onClose={() => {this.setState({editMetadata: undefined, newFile: false})}}
                    textureLoader={this.context.textureLoader}
                    newFile={this.state.newFile}
                />
            );
        } else {
            return this.renderBrowseFiles();
        }
    }

}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store)
    }
}

export default connect(mapStoreToProps)(BrowseFilesComponent);