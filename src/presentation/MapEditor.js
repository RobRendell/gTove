import React, {Component} from 'react';
import PropTypes from 'prop-types';

import DriveTextureLoader from '../util/DriveTextureLoader';
import {splitFileName, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputField from './InputField';
import EditorFrame from './EditorFrame';
import MapEditorComponent from './MapEditorComponent';

import './MapEditor.css';

class MapEditor extends Component {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.setGrid = this.setGrid.bind(this);
        this.onSave = this.onSave.bind(this);
        this.textureLoader = new DriveTextureLoader();
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
            loadError: null,
            gridDark: true
        };
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

    setGrid(width, height, gridSize, gridOffsetX, gridOffsetY) {
        this.setState({appProperties:{...this.state.appProperties, width, height, gridSize, gridOffsetX, gridOffsetY}});
    }

    onSave() {
        const {suffix} = splitFileName(this.props.metadata.name);
        return updateFileMetadataAndDispatch({
            id: this.props.metadata.id,
            name: this.state.name + suffix,
            appProperties: this.state.appProperties
        }, this.props.dispatch);
    }

    gridColour() {
        return this.state.gridDark ? 'black' : 'white';
    }

    render() {
        return (
            <EditorFrame onClose={this.props.onClose} onSave={this.onSave} className='mapEditor'>
                <div className='controls'>
                    <InputField heading='File name' type='text' initialValue={this.state.name}
                                onChange={(name) => {
                                    this.setState({name});
                                }}/>
                    <span onClick={() => {this.setState({gridDark: !this.state.gridDark})}}>Grid: {this.gridColour()}</span>
                </div>
                {
                    this.state.textureUrl ? (
                        <MapEditorComponent
                            appProperties={this.state.appProperties}
                            setGrid={this.setGrid}
                            textureUrl={this.state.textureUrl}
                            gridColour={this.gridColour()}
                        />
                    ) : (
                        <div>
                            {
                                this.state.loadError ? (
                                    <span>An error occurred while loading this file from Google Drive: {this.state.loadError}</span>
                                ) : (
                                    <span>Loading...</span>
                                )
                            }
                        </div>
                    )
                }
            </EditorFrame>
        );
    }
}

export default MapEditor;