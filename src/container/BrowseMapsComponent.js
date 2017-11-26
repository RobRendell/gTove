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

class BrowseMapsComponent extends Component {

    static propTypes = {
        onBack: PropTypes.func.isRequired,
        onPickMap: PropTypes.func.isRequired
    };

    static PICK = 'pick';
    static EDIT = 'edit';
    static DELETE = 'delete';

    static STATE_BUTTONS = {
        [BrowseMapsComponent.PICK]: {text: 'Pick'},
        [BrowseMapsComponent.EDIT]: {text: 'Edit'},
        [BrowseMapsComponent.DELETE]: {text: 'Delete'}
    };

    constructor(props) {
        super(props);
        this.onClickThumbnail = this.onClickThumbnail.bind(this);
        this.onAddFolder = this.onAddFolder.bind(this);
        this.state = {
            mapClickAction: BrowseMapsComponent.PICK,
            editMap: null,
            folderStack: [props.files.roots[constants.FOLDER_MAP]],
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

    onClickThumbnail(metadata) {
        if (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            this.setState({folderStack: [...this.state.folderStack, metadata.id]});
        } else {
            switch (this.state.mapClickAction) {
                case BrowseMapsComponent.PICK:
                    return this.props.onPickMap(metadata);
                case BrowseMapsComponent.EDIT:
                    return this.setState({editMap: metadata});
                case BrowseMapsComponent.DELETE:
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

    renderEditMap() {
        return (
            <div className='fullPanel'>
                <button onClick={() => {
                    this.setState({editMap: null})
                }}>Cancel
                </button>
                {this.state.editMap.fileName}
            </div>
        );
    }

    renderThumbnails(currentFolder) {
        const sorted = (this.props.files.children[currentFolder] || []).slice().sort((id1, id2) => {
            const file1 = this.props.files.driveMetadata[id1];
            const file2 = this.props.files.driveMetadata[id2];
            const isFolder1 = (file1.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
            const isFolder2 = (file2.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
            if (isFolder1 && !isFolder2) {
                return -1;
            } else if (!isFolder1 && isFolder2) {
                return 1;
            } else {
                return file1.name < file2.name ? -1 : (file1.name === file2.name ? 0 : 1)
            }
        });
        return (
            <div>
                {
                    sorted.map((fileId) => (
                        <FileThumbnail
                            key={fileId}
                            metadata={this.props.files.driveMetadata[fileId]}
                            progress={this.state.uploadProgress[fileId]}
                            onClick={this.onClickThumbnail}
                        />
                    ))
                }
            </div>
        );
    }

    renderBrowseMaps() {
        return (
            <div className='fullPanel'>
                <button onClick={this.props.onBack}>Back</button>
                <InputButton type='file' multiple onChange={(event) => {
                    this.onUploadFile(event);
                }} text='Upload'/>
                <button onClick={this.onAddFolder}>Add Folder</button>
                <div>
                    {
                        Object.keys(BrowseMapsComponent.STATE_BUTTONS).map((state) => (
                            <InputButton
                                key={state}
                                selected={this.state.mapClickAction === state}
                                text={BrowseMapsComponent.STATE_BUTTONS[state].text}
                                onChange={() => {
                                    this.setState({mapClickAction: state});
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
        if (this.state.editMap) {
            return this.renderEditMap();
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

export default connect(mapStoreToProps)(BrowseMapsComponent);