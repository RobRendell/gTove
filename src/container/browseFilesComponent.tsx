import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {v4} from 'uuid';

import {addFilesAction, FileIndexReducerType, removeFileAction} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, ReduxStoreType} from '../redux/mainReducer';
import InputButton from '../presentation/inputButton';
import * as constants from '../util/constants';
import FileThumbnail from '../presentation/fileThumbnail';
import BreadCrumbs from '../presentation/breadCrumbs';
import {Dispatch} from 'redux';
import {DriveMetadata, isWebLinkAppProperties} from '../util/googleDriveUtils';
import {FileAPIContext, OnProgressParams, splitFileName} from '../util/fileUtils';
import RenameFileEditor from '../presentation/renameFileEditor';
import {PromiseModalContext} from './authenticatedContainer';
import {TextureLoaderContext} from '../util/driveTextureLoader';

interface BrowseFilesComponentProps {
    dispatch: Dispatch<ReduxStoreType>;
    files: FileIndexReducerType;
    topDirectory: string;
    folderStack: string[];
    setFolderStack: (root: string, folderStack: string[]) => void;
    disablePick?: (metadata: DriveMetadata) => boolean;
    onPickFile: (metadata: DriveMetadata) => void;
    editorComponent: React.ComponentClass<any>;
    onBack?: () => void;
    customLabel?: string;
    onCustomAction?: (parents: string[]) => Promise<DriveMetadata>;
    emptyMessage?: React.ReactElement<any>;
    highlightMetadataId?: string;
    jsonIcon?: string | ((metadata: DriveMetadata) => React.ReactElement<any>);
}

interface BrowseFilesComponentState {
    editMetadata?: DriveMetadata;
    uploadProgress: {[key: string]: number};
    loading: boolean;
    uploading: boolean;
}

class BrowseFilesComponent extends React.Component<BrowseFilesComponentProps, BrowseFilesComponentState> {

    static URL_REGEX = new RegExp('^[a-z][-a-z0-9+.]*:\\/\\/(\\%[0-9a-f][0-9a-f]|[-a-z0-9._~!$&\'()*+,;=:])*\\/');

    static propTypes = {
        topDirectory: PropTypes.string.isRequired,
        folderStack: PropTypes.arrayOf(PropTypes.string).isRequired,
        setFolderStack: PropTypes.func.isRequired,
        diablePick: PropTypes.func,
        onPickFile: PropTypes.func.isRequired,
        editorComponent: PropTypes.func.isRequired,
        onBack: PropTypes.func,
        customLabel: PropTypes.string,
        onCustomAction: PropTypes.func,
        emptyMessage: PropTypes.element,
        highlightMetadataId: PropTypes.string,
        jsonIcon: PropTypes.oneOfType([PropTypes.string, PropTypes.func])
    };

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
                    if (driveMetadata && fileArray.length === 1) {
                        // For single file upload, automatically edit after uploading
                        this.setState({editMetadata: driveMetadata});
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
                            return this.context.fileAPI.uploadFileMetadata(metadata)
                                .then((driveMetadata: DriveMetadata) => {
                                    return this.context.fileAPI.makeFileReadableToAll(driveMetadata)
                                        .then(() => (this.cleanUpPlaceholderFile(placeholders[index], driveMetadata)));
                                })
                        })
                    ), Promise.resolve(null))
                    .then((driveMetadata) => {
                        if (driveMetadata && webLinks.length === 1) {
                            // For single file upload, automatically edit after uploading
                            this.setState({editMetadata: driveMetadata});
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
        // Only support paste on pages without custom actions (i.e. which allow upload.)
        if (!this.props.onCustomAction) {
            if (event.clipboardData.files && event.clipboardData.files.length > 0) {
                this.uploadMultipleFiles(Array.from(event.clipboardData.files));
            } else {
                this.uploadWebLinks(event.clipboardData.getData('text'));
            }
        }
    }

    onCustomAction() {
        let parents = this.props.folderStack.slice(this.props.folderStack.length - 1);
        const placeholder = this.createPlaceholderFile('', parents);
        return this.props.onCustomAction && this.props.onCustomAction(parents)
            .then((driveMetadata: DriveMetadata) => {
                this.cleanUpPlaceholderFile(placeholder, driveMetadata);
                this.setState({editMetadata: driveMetadata});
            });
    }

    onEditFile(metadata: DriveMetadata) {
        this.setState({editMetadata: metadata});
    }

    onDeleteFile(metadata: DriveMetadata) {
        if (metadata.id === this.props.highlightMetadataId) {
            this.context.promiseModal && this.context.promiseModal({
                children: 'Can\'t delete the currently selected file.'
            })
        } else {
            const yesOption = 'Yes';
            this.context.promiseModal && this.context.promiseModal({
                children: `Are you sure you want to delete ${metadata.name}?`,
                options: [yesOption, 'Cancel']
            })
                .then((response?: string) => {
                    if (response === yesOption) {
                        this.props.dispatch(removeFileAction(metadata));
                        this.context.fileAPI.uploadFileMetadata({id: metadata.id, trashed: true})
                            .then((): any => {
                                if (metadata.appProperties && 'gmFile' in metadata.appProperties) {
                                    // Also trash the private GM file.
                                    return this.context.fileAPI.uploadFileMetadata({id: metadata.appProperties.gmFile, trashed: true})
                                }
                            });
                    }
                });
        }
    }

    onClickThumbnail(fileId: string) {
        const metadata = this.props.files.driveMetadata[fileId];
        if (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            this.props.setFolderStack(this.props.topDirectory, [...this.props.folderStack, metadata.id]);
        } else if (this.props.disablePick && this.props.disablePick(metadata)) {
            this.onEditFile(metadata);
        } else {
            this.props.onPickFile(metadata)
        }
    }

    onAddFolder(prefix = '') {
        const name = window.prompt(prefix + 'Please enter the name of the new folder', 'New Folder');
        if (name) {
            // Check the name is unique
            const currentFolder = this.props.folderStack[this.props.folderStack.length - 1];
            const valid = (this.props.files.children[currentFolder] || []).reduce((valid, fileId) => {
                return valid && (name.toLowerCase() !== this.props.files.driveMetadata[fileId].name.toLowerCase());
            }, true);
            if (valid) {
                this.context.fileAPI
                    .createFolder(name, {parents:[currentFolder]})
                    .then((metadata: DriveMetadata) => {
                        this.props.dispatch(addFilesAction([metadata]));
                    });
            } else {
                this.onAddFolder('That name is already in use.  ');
            }
        }
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
        return (this.props.emptyMessage && sorted.length === 0 && this.props.folderStack.length === 1) ? (
            this.props.emptyMessage
        ) : (
            <div>
                {
                    sorted.map((fileId: string) => {
                        const metadata = this.props.files.driveMetadata[fileId];
                        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                        const isJson = (metadata.mimeType === constants.MIME_TYPE_JSON);
                        const name = metadata.appProperties ? splitFileName(metadata.name).name : metadata.name;
                        const isOwnedByMe = metadata.owners && metadata.owners.reduce((me, owner) => (me || owner.me), false);
                        const menuOptions = [
                            isFolder ?
                                {label: 'Open', onClick: () => {this.onClickThumbnail(fileId)}} :
                                {label: 'Pick', onClick: () => {this.props.onPickFile(metadata)}, disabled: this.props.disablePick && this.props.disablePick(metadata)},
                            {label: 'Edit', onClick: () => {this.onEditFile(metadata)}, disabled: !isOwnedByMe},
                            {label: 'Delete', onClick: () => {this.onDeleteFile(metadata)}, disabled: fileId === this.props.highlightMetadataId}
                        ];
                        return (
                            <FileThumbnail
                                key={fileId}
                                fileId={fileId}
                                name={name}
                                isFolder={isFolder}
                                isIcon={isJson}
                                isNew={this.props.disablePick ? (!isFolder && !isJson && this.props.disablePick(metadata)) : false}
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
                        <button onClick={() => {this.setState({uploading: false})}}>Cancel uploads</button>
                    )
                }
                {
                    !this.state.loading ? null : (
                        <div>Loading...</div>
                    )
                }
            </div>
        );
    }

    renderBrowseFiles() {
        return (
            <div className='fullHeight' onPaste={this.onPaste}>
                {
                    !this.props.onBack ? null : (
                        <button onClick={this.props.onBack}>Finish</button>
                    )
                }
                {
                    this.props.onCustomAction ? (
                        <button onClick={() => {this.onCustomAction();}}>{this.props.customLabel}</button>
                    ) : (
                        <InputButton type='file' multiple={true} onChange={this.onUploadInput} text='Upload'/>
                    )
                }
                {
                    this.props.onCustomAction ? null : (
                        <button onClick={this.onWebLinksPressed}>Link to Images</button>
                    )
                }
                <button onClick={() => this.onAddFolder()}>Add Folder</button>
                <button onClick={() => this.loadCurrentDirectoryFiles()}>Refresh</button>
                <BreadCrumbs folders={this.props.folderStack} files={this.props.files} onChange={(folderStack: string[]) => {
                    this.props.setFolderStack(this.props.topDirectory, folderStack);
                }}/>
                {
                    this.renderThumbnails(this.props.folderStack[this.props.folderStack.length - 1])
                }
            </div>
        );
    }

    render() {
        if (this.state.editMetadata) {
            const Editor: React.ComponentClass<any> = (this.state.editMetadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) ? RenameFileEditor : this.props.editorComponent;
            return (
                <Editor
                    metadata={this.state.editMetadata}
                    onClose={() => {
                        this.setState({editMetadata: undefined});
                    }}
                    textureLoader={this.context.textureLoader}
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