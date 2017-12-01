import React, {Component} from 'react';
import PropTypes from 'prop-types';

import InputField from './InputField';
import DriveTextureLoader from '../util/DriveTextureLoader';
import {updateMapAction} from '../redux/mapDataReducer';
import {addFilesAction} from '../redux/fileIndexReducer';
import {MIME_TYPE_JSON} from '../util/constants';
import {uploadFileToDrive} from '../util/googleAPIUtils';

class MapEditor extends Component {

    static propTypes = {
        mapData: PropTypes.object.isRequired,
        files: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.textureLoader = new DriveTextureLoader();
        this.onSave = this.onSave.bind(this);
        this.state = {
            mapData: {...props.mapData},
            mapUrl: null,
            loadError: null,
            saving: false
        };
        this.loadMapTexture();
    }

    componentWillReceiveProps(props) {
        this.setState({mapData: {...props.mapData}, saving: false});
        if (props.mapData.texture.id !== this.props.mapData.texture.id) {
            this.setState({mapUrl: null, loadError: null});
            this.loadMapTexture();
        }
    }

    loadMapTexture() {
        this.textureLoader.loadImageBlob({id: this.state.mapData.texture.id})
            .then((blob) => {
                this.setState({mapUrl: window.URL.createObjectURL(blob)});
            })
            .catch((error) => {
                this.setState({loadError: error});
            });
    }

    onSave() {
        this.setState({saving: true, mapUrl: null});
        let {metadata, ...mapData} = this.state.mapData;
        metadata = metadata || {
            name: this.state.mapData.name + '.json',
            parents: this.props.mapData.parents,
        };
        let file = new Blob([JSON.stringify(mapData)], {type: MIME_TYPE_JSON});
        uploadFileToDrive(metadata, file)
            .then((driveMetadata) => {
                mapData.metadata = driveMetadata;
                this.props.dispatch(updateMapAction(driveMetadata.id, mapData));
                if (!this.props.files.driveMetadata[driveMetadata.id]) {
                    this.props.dispatch(addFilesAction({
                        [driveMetadata.id]: driveMetadata
                    }));
                }
                this.props.onClose();
            });
    }

    render() {
        if (this.state.saving) {
            return (
                <div className='mapEditor'>
                    <span>Saving map data to Google Drive...</span>
                </div>
            );
        } else {
            return (
                <div className='mapEditor'>
                    <div>
                        <button onClick={this.props.onClose}>Cancel</button>
                        <button onClick={this.onSave} disabled={!this.state.mapUrl}>Save</button>
                        <InputField heading='Map name' type='text' initialValue={this.state.mapData.name}
                                    onChange={(name) => {
                                        this.setState({mapData: {...this.state.mapData, name}});
                                    }}/>
                    </div>
                    <div className='mapPanel'>
                        {
                            this.state.mapUrl ? (
                                <img src={this.state.mapUrl} alt='map' onLoad={(evt) => {
                                    window.URL.revokeObjectURL(this.state.mapUrl);
                                    this.setState({
                                        mapData: {
                                            ...this.state.mapData,
                                            width: evt.target.width / 50,
                                            height: evt.target.height / 50
                                        }
                                    });
                                }}/>
                            ) : (
                                this.state.loadError ? (
                                    <span>An error occurred while loading this file from Google Drive: {this.state.loadError}</span>
                                ) : (
                                    <span>Loading...</span>
                                )
                            )
                        }
                    </div>
                </div>
            );
        }
    }
}

export default MapEditor;