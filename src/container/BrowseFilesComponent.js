import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {v4} from 'uuid';

import {addFilesAction, getAllFilesFromStore, removeFileAction} from '../redux/fileIndexReducer';
import InputButton from '../presentation/InputButton';
import {createDriveFolder, uploadFileToDrive} from '../util/googleAPIUtils';
import * as constants from '../util/constants';
import FileThumbnail from '../presentation/FileThumbnail';
import BreadCrumbs from '../presentation/BreadCrumbs';

class BrowseFilesComponent extends Component {

    static propTypes = {
        topDirectory: PropTypes.string.isRequired,
        onBack: PropTypes.func.isRequired,
        onPickFile: PropTypes.func.isRequired,
        editorComponent: PropTypes.func.isRequired
    };

    static PICK = 'pick';
    static EDIT = 'edit';
    static DELETE = 'delete';

    static STATE_BUTTONS = {
        [BrowseFilesComponent.PICK]: {text: 'Pick'},
        [BrowseFilesComponent.EDIT]: {text: 'Edit'},
        [BrowseFilesComponent.DELETE]: {text: 'Delete'}
    };

    static fileNameToFriendlyName(filename) {
        return filename
            .replace(/.[a-z]*$/, '')
            .replace(/_/, ' ')
            .replace(/([a-z])([A-Z])/, '$1 $2');
    }

    constructor(props) {
        super(props);
        this.onClickThumbnail = this.onClickThumbnail.bind(this);
        this.onAddFolder = this.onAddFolder.bind(this);
        this.state = {
            clickAction: BrowseFilesComponent.PICK,
            editMetadata: null,
            folderStack: [props.files.roots[props.topDirectory]],
            uploadProgress: {}
        };
    }

    onUploadFile(event) {
        let parents = this.state.folderStack.slice(this.state.folderStack.length - 1);
        Array.from(event.target.files).forEach((file) => {
            let temporaryId = v4();
            let name = file.name;
            // Dispatch a placeholder file
            let placeholder = {id: temporaryId, name, parents};
            this.setState((prevState) => ({uploadProgress: {...prevState.uploadProgress, [temporaryId]: 0}}), () => {
                this.props.dispatch(addFilesAction({
                    [temporaryId]: placeholder
                }));
            });
            uploadFileToDrive({name, parents}, file, (progress) => {
                this.setState((prevState) => {
                    return {
                        uploadProgress: {
                            ...prevState.uploadProgress,
                            [temporaryId]: progress.loaded / progress.total
                        }
                    }
                });
            })
                .then((driveMetadata) => {
                    this.props.dispatch(removeFileAction(placeholder));
                    this.props.dispatch(addFilesAction({
                        [driveMetadata.id]: driveMetadata
                    }));
                    this.setState((prevState) => {
                        let uploadProgress = {...prevState.uploadProgress};
                        delete(uploadProgress[temporaryId]);
                        return {uploadProgress};
                    });
                });
        });
    }

    onEditFile(metadata) {
        this.setState({editMetadata: metadata});
    }

    onClickThumbnail(fileId) {
        const metadata = this.props.files.driveMetadata[fileId];
        if (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            this.setState({folderStack: [...this.state.folderStack, metadata.id]});
        } else {
            switch (this.state.clickAction) {
                case BrowseFilesComponent.PICK:
                    if (metadata.appProperties) {
                        return this.props.onPickFile(metadata);
                    }
                // else fall through to edit the file
                // eslint nofallthrough: 0
                case BrowseFilesComponent.EDIT:
                    return this.onEditFile(metadata);
                case BrowseFilesComponent.DELETE:
                    return alert('Not yet implemented');
                default:
            }
        }
    }

    onAddFolder(prefix = '') {
        let name = window.prompt(prefix + 'Please enter the name of the new folder', 'New Folder');
        if (name) {
            // Check the name is unique
            const currentFolder = this.state.folderStack[this.state.folderStack.length - 1];
            const valid = (this.props.files.children[currentFolder] || []).reduce((valid, fileId) => {
                return valid && (name.toLowerCase() !== this.props.files.driveMetadata[fileId].name.toLowerCase());
            }, true);
            if (valid) {
                createDriveFolder(name, [currentFolder])
                    .then((metadata) => {
                        this.props.dispatch(addFilesAction({
                            [metadata.id]: metadata
                        }));
                    });
            } else {
                this.onAddFolder('That name is already in use.  ');
            }
        }
    }

    renderThumbnails(currentFolder) {
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
        return (
            <div>
                {
                    sorted.map((fileId) => {
                        const metadata = this.props.files.driveMetadata[fileId];
                        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                        const name = metadata.appProperties ? BrowseFilesComponent.fileNameToFriendlyName(metadata.name) : metadata.name;
                        return (
                            <FileThumbnail
                                key={fileId}
                                fileId={fileId}
                                name={name}
                                isFolder={isFolder}
                                isValid={isFolder || !!metadata.appProperties}
                                progress={this.state.uploadProgress[fileId]}
                                thumbnailLink={metadata.thumbnailLink}
                                onClick={this.onClickThumbnail}
                            />
                        );
                    })
                }
            </div>
        );
    }

    renderBrowseMaps() {
        return (
            <div>
                <button onClick={this.props.onBack}>Back</button>
                <InputButton type='file' multiple onChange={(event) => {
                    this.onUploadFile(event);
                }} text='Upload'/>
                <button onClick={this.onAddFolder}>Add Folder</button>
                <div>
                    {
                        Object.keys(BrowseFilesComponent.STATE_BUTTONS).map((state) => (
                            <InputButton
                                key={state}
                                selected={this.state.clickAction === state}
                                text={BrowseFilesComponent.STATE_BUTTONS[state].text}
                                onChange={() => {
                                    this.setState({clickAction: state});
                                }}
                            />
                        ))
                    }
                </div>
                <BreadCrumbs folders={this.state.folderStack} files={this.props.files} onChange={(folderStack) => {
                    this.setState({folderStack});
                }}/>
                {
                    this.renderThumbnails(this.state.folderStack[this.state.folderStack.length - 1])
                }
            </div>
        );
    }

    render() {
        if (this.state.editMetadata) {
            let Editor = this.props.editorComponent;
            return (
                <Editor
                    metadata={this.state.editMetadata}
                    name={BrowseFilesComponent.fileNameToFriendlyName(this.state.editMetadata.name)}
                    files={this.props.files}
                    dispatch={this.props.dispatch}
                    onClose={() => {
                        this.setState({editMetadata: null});
                    }}
                />
            );
        } else {
            return this.renderBrowseMaps();
        }
    }

}

function mapStoreToProps(store) {
    return {
        files: getAllFilesFromStore(store)
    }
}

export default connect(mapStoreToProps)(BrowseFilesComponent);