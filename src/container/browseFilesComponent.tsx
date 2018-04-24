import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {v4} from 'uuid';

import {addFilesAction, FileIndexReducerType, removeFileAction} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, ReduxStoreType} from '../redux/mainReducer';
import InputButton from '../presentation/InputButton';
import * as constants from '../util/constants';
import FileThumbnail from '../presentation/fileThumbnail';
import BreadCrumbs from '../presentation/breadCrumbs';
import {Dispatch} from 'redux';
import {DriveMetadata} from '../@types/googleDrive';
import {OnProgressParams} from '../util/fileUtils';

interface BrowseFilesComponentProps {
    dispatch: Dispatch<ReduxStoreType>;
    files: FileIndexReducerType;
    topDirectory: string;
    onPickFile: (metadata: DriveMetadata) => void;
    editorComponent: React.ComponentClass<any>;
    onBack: () => void;
    onNewFile: (parents: string[]) => Promise<DriveMetadata>;
    emptyMessage?: React.Component;
    highlightMetadataId?: string;
}

enum BrowseFilesComponentMode {
    PICK = 'pick',
    EDIT = 'edit',
    DELETE = 'delete'
}

interface BrowseFilesComponentState {
    clickAction: BrowseFilesComponentMode;
    editMetadata?: DriveMetadata;
    folderStack: string[];
    uploadProgress: {[key: string]: number};
    loading: boolean;
}

class BrowseFilesComponent extends React.Component<BrowseFilesComponentProps, BrowseFilesComponentState> {

    static propTypes = {
        topDirectory: PropTypes.string.isRequired,
        onPickFile: PropTypes.func.isRequired,
        editorComponent: PropTypes.func.isRequired,
        onBack: PropTypes.func,
        onNewFile: PropTypes.func,
        emptyMessage: PropTypes.element,
        highlightMetadataId: PropTypes.string
    };

    static contextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object
    };

    static STATE_BUTTONS = {
        [BrowseFilesComponentMode.PICK]: {text: 'Pick'},
        [BrowseFilesComponentMode.EDIT]: {text: 'Edit'},
        [BrowseFilesComponentMode.DELETE]: {text: 'Delete'}
    };

    static fileNameToFriendlyName(filename: string) {
        return filename
            .replace(/\.[a-z]*$/g, '')
            .replace(/_/g, ' ');
    }

    constructor(props: BrowseFilesComponentProps) {
        super(props);
        this.onClickThumbnail = this.onClickThumbnail.bind(this);
        this.onAddFolder = this.onAddFolder.bind(this);
        this.onUploadFile = this.onUploadFile.bind(this);
        this.state = {
            clickAction: BrowseFilesComponentMode.PICK,
            editMetadata: undefined,
            folderStack: [props.files.roots[props.topDirectory]],
            uploadProgress: {},
            loading: false
        };
    }

    componentDidMount() {
        this.loadCurrentDirectoryFiles();
    }

    loadCurrentDirectoryFiles() {
        const currentFolderId = this.state.folderStack[this.state.folderStack.length - 1];
        this.setState({loading: true});
        this.context.fileAPI.loadFilesInFolder(currentFolderId, (files: DriveMetadata[]) => {this.props.dispatch(addFilesAction(files))})
            .then(() => {this.setState({loading: false})});
    }

    createPlaceholderFile(name: string, parents: string[]): DriveMetadata {
        // Dispatch a placeholder file
        const placeholder: DriveMetadata = {id: v4(), name, parents, trashed: false};
        this.setState((prevState) => ({uploadProgress: {...prevState.uploadProgress, [placeholder.id]: 0}}), () => {
            this.props.dispatch(addFilesAction([placeholder]));
        });
        return placeholder;
    }

    cleanUpPlaceholderFile(placeholder: DriveMetadata, driveMetadata: DriveMetadata) {
        this.props.dispatch(removeFileAction(placeholder));
        this.props.dispatch(addFilesAction([driveMetadata]));
        this.setState((prevState) => {
            let uploadProgress = {...prevState.uploadProgress};
            delete(uploadProgress[placeholder.id]);
            return {uploadProgress};
        });
    }

    onUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
        const parents = this.state.folderStack.slice(this.state.folderStack.length - 1);
        if (event.target.files) {
            Array.from(event.target.files).forEach((file: File) => {
                const placeholder = this.createPlaceholderFile(file.name, parents);
                this.context.fileAPI
                    .uploadFile({name: file.name, parents}, file, (progress: OnProgressParams) => {
                        this.setState((prevState) => {
                            return {
                                uploadProgress: {
                                    ...prevState.uploadProgress,
                                    [placeholder.id]: progress.loaded / progress.total
                                }
                            }
                        });
                    })
                    .then((driveMetadata: DriveMetadata) => {
                        this.cleanUpPlaceholderFile(placeholder, driveMetadata);
                        return this.context.fileAPI.makeFileReadableToAll(driveMetadata);
                    })
            });
        }
    }

    onNewFile() {
        let parents = this.state.folderStack.slice(this.state.folderStack.length - 1);
        const placeholder = this.createPlaceholderFile('', parents);
        return this.props.onNewFile(parents)
            .then((driveMetadata: DriveMetadata) => {
                this.cleanUpPlaceholderFile(placeholder, driveMetadata);
                this.setState({editMetadata: driveMetadata});
            });
    }

    onEditFile(metadata: DriveMetadata) {
        this.setState({editMetadata: metadata});
    }

    onClickThumbnail(fileId: string) {
        const metadata = this.props.files.driveMetadata[fileId];
        if (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            this.setState({folderStack: [...this.state.folderStack, metadata.id]}, () => {
                this.loadCurrentDirectoryFiles();
            });
        } else {
            switch (this.state.clickAction) {
                case BrowseFilesComponentMode.PICK:
                    if (this.props.onPickFile(metadata)) {
                        break;
                    }
                // else fall through to edit the file
                // eslint nofallthrough: 0
                case BrowseFilesComponentMode.EDIT:
                    this.onEditFile(metadata);
                    break;
                case BrowseFilesComponentMode.DELETE:
                    alert('Not yet implemented');
                    break;
                default:
            }
        }
    }

    onAddFolder(prefix = '') {
        const name = window.prompt(prefix + 'Please enter the name of the new folder', 'New Folder');
        if (name) {
            // Check the name is unique
            const currentFolder = this.state.folderStack[this.state.folderStack.length - 1];
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
        return (this.props.emptyMessage && sorted.length === 0 && this.state.folderStack.length === 1) ? (
            this.props.emptyMessage
        ) : (
            <div>
                {
                    sorted.map((fileId: string) => {
                        const metadata = this.props.files.driveMetadata[fileId];
                        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                        const isJson = (metadata.mimeType === constants.MIME_TYPE_JSON);
                        const name = metadata.appProperties ? BrowseFilesComponent.fileNameToFriendlyName(metadata.name) : metadata.name;
                        return (
                            <FileThumbnail
                                key={fileId}
                                fileId={fileId}
                                name={name}
                                isFolder={isFolder}
                                isJson={isJson}
                                isValid={isFolder || isJson || !!metadata.appProperties}
                                progress={this.state.uploadProgress[fileId] || 0}
                                thumbnailLink={metadata.thumbnailLink}
                                onClick={this.onClickThumbnail}
                                highlight={this.props.highlightMetadataId === metadata.id}
                            />
                        );
                    })
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
            <div>
                {
                    !this.props.onBack ? null : (
                        <button onClick={this.props.onBack}>Back</button>
                    )
                }
                {
                    this.props.onNewFile ? (
                        <button onClick={() => {
                            this.onNewFile();
                        }}>New</button>
                    ) : (
                        <InputButton type='file' multiple={true} onChange={this.onUploadFile} text='Upload'/>
                    )
                }
                <button onClick={() => this.onAddFolder()}>Add Folder</button>
                <div>
                    {
                        Object.keys(BrowseFilesComponent.STATE_BUTTONS)
                            .map((state) => (
                                <InputButton
                                    key={state}
                                    selected={this.state.clickAction === state}
                                    text={BrowseFilesComponent.STATE_BUTTONS[state].text}
                                    onChange={() => {
                                        this.setState({clickAction: state as BrowseFilesComponentMode});
                                    }}
                                />
                            ))
                    }
                </div>
                <BreadCrumbs folders={this.state.folderStack} files={this.props.files} onChange={(folderStack: string[]) => {
                    this.setState({folderStack}, () => {
                        this.loadCurrentDirectoryFiles();
                    });
                }}/>
                {
                    this.renderThumbnails(this.state.folderStack[this.state.folderStack.length - 1])
                }
            </div>
        );
    }

    render() {
        if (this.state.editMetadata) {
            const Editor: React.ComponentClass<any> = this.props.editorComponent;
            return (
                <Editor
                    metadata={this.state.editMetadata}
                    name={BrowseFilesComponent.fileNameToFriendlyName(this.state.editMetadata.name)}
                    dispatch={this.props.dispatch}
                    onClose={() => {
                        this.setState({editMetadata: undefined});
                    }}
                    textureLoader={this.context.textureLoader}
                    fileAPI={this.context.fileAPI}
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