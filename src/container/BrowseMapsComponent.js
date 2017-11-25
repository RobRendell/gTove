import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {v4} from 'uuid';

import {addFilesAction, getAllFilesFromStore, removeFileAction} from '../redux/fileIndexReducer';
import InputButton from '../presentation/InputButton';
import {uploadFileToDrive} from '../util/googleAPIUtils';
import * as constants from '../util/constants';
import FileThumbnail from '../presentation/FileThumbnail';

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
        this.onClickMap = this.onClickMap.bind(this);
        this.state = {
            mapClickAction: BrowseMapsComponent.PICK,
            editMap: null,
            currentFolder: props.files.roots[constants.FOLDER_MAP],
            uploadProgress: {}
        };
    }

    onUploadFile(event) {
        let parents = [this.state.currentFolder];
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

    onClickMap(metadata) {
        switch (this.state.mapClickAction) {
            case BrowseMapsComponent.PICK:
                return this.props.onPickMap(metadata);
            case BrowseMapsComponent.EDIT:
                return this.setState({editMap: metadata});
            case BrowseMapsComponent.DELETE:
            default:
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

    renderBrowseMaps() {
        return (
            <div className='fullPanel'>
                <button onClick={this.props.onBack}>Back</button>
                <InputButton type='file' multiple onChange={(event) => {
                    this.onUploadFile(event);
                }} text='Upload'/>
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
                <div>
                    {
                        (this.props.files.children[this.state.currentFolder] || []).map((fileId) => (
                            <FileThumbnail
                                key={fileId}
                                metadata={this.props.files.driveMetadata[fileId]}
                                progress={this.state.uploadProgress[fileId]}
                                onClick={this.onClickMap}
                            />
                        ))
                    }
                </div>
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