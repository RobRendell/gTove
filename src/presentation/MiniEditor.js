import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {splitFileName, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputField from './InputField';
import EditorFrame from './EditorFrame';

class MiniEditor extends Component {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired,
        fileAPI: PropTypes.object.isRequired
    };

    constructor(props) {
        super(props);
        this.onSave = this.onSave.bind(this);
        this.state = this.getStateFromProps(props);
        this.loadMapTexture();
    }

    componentWillReceiveProps(props) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
            this.loadMapTexture();
        }
    }

    getStateFromProps(props) {
        return {
            name: props.name,
            appProperties: {...props.metadata.appProperties},
            textureUrl: null,
            loadError: null
        };
    }

    loadMapTexture() {
        this.props.textureLoader.loadImageBlob({id: this.props.metadata.id})
            .then((blob) => {
                this.setState({textureUrl: window.URL.createObjectURL(blob)});
            })
            .catch((error) => {
                this.setState({loadError: error});
            });
    }

    onSave() {
        const {suffix} = splitFileName(this.props.metadata.name);
        return updateFileMetadataAndDispatch(this.props.fileAPI, {
            id: this.props.metadata.id,
            name: this.state.name + suffix,
            appProperties: this.state.appProperties
        }, this.props.dispatch);
    }

    render() {
        return (
            <EditorFrame onClose={this.props.onClose} onSave={this.onSave}>
                <InputField heading='File name' type='text' initialValue={this.state.name}
                            onChange={(name) => {
                                this.setState({name});
                            }}/>
                <div className='editImagePanel'>
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
            </EditorFrame>
        );
    }
}

export default MiniEditor;