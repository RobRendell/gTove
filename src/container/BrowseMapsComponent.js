import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {v4} from 'uuid';

import {addFilesAction, getAllFilesFromStore, removeFileAction} from '../redux/fileIndexReducer';
import InputButton from '../presentation/InputButton';
import {createDriveFolder, getJsonFileContents, uploadFileToDrive} from '../util/googleAPIUtils';
import * as constants from '../util/constants';
import FileThumbnail from '../presentation/FileThumbnail';
import BreadCrumbs from '../presentation/BreadCrumbs';
import {getMapDataFromStore, updateMapAction} from '../redux/mapDataReducer';
import MapEditor from '../presentation/MapEditor';

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
            uploadProgress: {},
            textureToMapData: this.textureToMapIdFromProps(props)
        };
        this.loadMapJsonDataInDirectory(props.files.roots[constants.FOLDER_MAP]);
    }

    componentWillReceiveProps(props) {
        this.setState({textureToMapData: this.textureToMapIdFromProps(props)});
    }

    textureToMapIdFromProps(props) {
        return Object.keys(props.mapData).reduce((all, mapId) => {
            all[props.mapData[mapId].texture.id] = mapId;
            return all;
        }, {});
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

    loadMapJsonDataInDirectory(currentFolder) {
        const children = this.props.files.children[currentFolder] || [];
        return Promise.all(children.map((fileId) => {
            const metadata = this.props.files.driveMetadata[fileId];
            if (!this.props.mapData[fileId] && metadata.mimeType === constants.MIME_TYPE_JSON) {
                return getJsonFileContents(metadata)
                    .then((mapData) => {
                        mapData.metadata = metadata;
                        this.props.dispatch(updateMapAction(fileId, mapData));
                    })
            } else {
                return null;
            }
        }));
    }

    onEditMap(mapData, metadata) {
        if (mapData) {
            this.setState({editMap: mapData});
        } else {
            this.setState({
                editMap: {
                    texture: metadata,
                    parents: metadata.parents,
                    name: metadata.name
                        .replace(/.[a-z]*$/, '')
                        .replace(/([a-z])([A-Z])/, '$1 $2')
                }
            });
        }
    }

    onClickThumbnail(fileId) {
        const metadata = this.props.files.driveMetadata[fileId];
        if (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) {
            this.setState({folderStack: [...this.state.folderStack, metadata.id]});
            this.loadMapJsonDataInDirectory(metadata.id);
        } else {
            const mapData = this.props.mapData[fileId];
            switch (this.state.mapClickAction) {
                case BrowseMapsComponent.PICK:
                    if (mapData) {
                        return this.props.onPickMap(mapData);
                    }
                // else fall through to edit the map
                // eslint nofallthrough: 0
                case BrowseMapsComponent.EDIT:
                    return this.onEditMap(mapData, metadata);
                case BrowseMapsComponent.DELETE:
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
        const filtered = (this.props.files.children[currentFolder] || [])
            .filter((fileId) => (!this.state.textureToMapData[fileId]))
            .filter((fileId) => (this.props.files.driveMetadata[fileId].mimeType !== constants.MIME_TYPE_JSON || this.props.mapData[fileId]));
        filtered.sort((id1, id2) => {
            const file1 = this.props.files.driveMetadata[id1];
            const file2 = this.props.files.driveMetadata[id2];
            const isFolder1 = (file1.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
            const isFolder2 = (file2.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
            if (isFolder1 && !isFolder2) {
                return -1;
            } else if (!isFolder1 && isFolder2) {
                return 1;
            } else {
                const name1 = (this.props.mapData[id1] && this.props.mapData[id1].name) || file1.name;
                const name2 = (this.props.mapData[id2] && this.props.mapData[id2].name) || file2.name;
                return name1 < name2 ? -1 : (name1 === name2 ? 0 : 1);
            }
        });
        return (
            <div>
                {
                    filtered.map((fileId) => {
                        const metadata = this.props.files.driveMetadata[fileId];
                        const mapData = this.props.mapData[fileId];
                        const name = mapData ? mapData.name : metadata.name;
                        const isFolder = (metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                        const thumbnailLink = mapData ? this.props.files.driveMetadata[mapData.texture.id].thumbnailLink : metadata.thumbnailLink;
                        return (
                            <FileThumbnail
                                key={fileId}
                                fileId={fileId}
                                name={name}
                                isFolder={isFolder}
                                isValid={isFolder || !!mapData}
                                progress={this.state.uploadProgress[fileId]}
                                thumbnailLink={thumbnailLink}
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
            return (
                <MapEditor
                    mapData={this.state.editMap}
                    files={this.props.files}
                    dispatch={this.props.dispatch}
                    onClose={() => {
                        this.setState({editMap: null});
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
        files: getAllFilesFromStore(store),
        mapData: getMapDataFromStore(store)
    }
}

export default connect(mapStoreToProps)(BrowseMapsComponent);