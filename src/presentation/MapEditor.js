import React, {Component} from 'react';
import PropTypes from 'prop-types';

import InputField from './InputField';
import DriveTextureLoader from '../util/DriveTextureLoader';
import {updateFileAction} from '../redux/fileIndexReducer';
import {updateFileMetadataOnDrive} from '../util/googleAPIUtils';

class MapEditor extends Component {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        files: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.textureLoader = new DriveTextureLoader();
        this.onSave = this.onSave.bind(this);
        this.state = {
            name: props.name,
            appProperties: {...props.metadata.appProperties},
            textureUrl: null,
            loadError: null,
            saving: false
        };
        this.loadMapTexture();
    }

    componentWillReceiveProps(props) {
        this.setState({
            name: props.name,
            appProperties: {...props.metadata.appProperties},
            saving: false
        });
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState({textureUrl: null, loadError: null});
            this.loadMapTexture();
        }
    }

    loadMapTexture() {
        this.textureLoader.loadImageBlob({id: this.props.metadata.id})
            .then((blob) => {
                this.setState({textureUrl: window.URL.createObjectURL(blob)});
            })
            .catch((error) => {
                this.setState({loadError: error});
            });
    }

    onSave() {
        this.setState({saving: true, textureUrl: null});
        let suffix = this.props.metadata.name.replace(/.*(\.[a-zA-Z]*)?$/, '$1');
        let metadata = {
            id: this.props.metadata.id,
            name: this.state.name + suffix,
            appProperties: this.state.appProperties
        };
        updateFileMetadataOnDrive(metadata)
            .then((driveMetadata) => {
                this.props.dispatch(updateFileAction(driveMetadata));
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
                        <button onClick={this.onSave} disabled={!this.state.textureUrl}>Save</button>
                        <InputField heading='Map name' type='text' initialValue={this.state.name}
                                    onChange={(name) => {
                                        this.setState({name});
                                    }}/>
                    </div>
                    <div className='mapPanel'>
                        {
                            this.state.textureUrl ? (
                                <img src={this.state.textureUrl} alt='map' onLoad={(evt) => {
                                    window.URL.revokeObjectURL(this.state.textureUrl);
                                    this.setState({
                                        appProperties: {
                                            ...this.state.appProperties,
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