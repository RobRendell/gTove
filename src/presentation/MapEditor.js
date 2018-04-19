import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {capitalize} from 'lodash';

import {splitFileName, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputField from './InputField';
import EditorFrame from './EditorFrame';
import GridEditorComponent from './GridEditorComponent';
import * as constants from '../util/constants';

import './MapEditor.css';

class MapEditor extends Component {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired,
        fileAPI: PropTypes.object.isRequired
    };

    static GRID_COLOURS = [constants.GRID_NONE, 'black', 'white', 'magenta'];

    constructor(props) {
        super(props);
        this.setGrid = this.setGrid.bind(this);
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
            appProperties: {
                gridColour: constants.GRID_NONE,
                ...props.metadata.appProperties
            },
            gridComplete: false,
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

    setGrid(width, height, gridSize, gridOffsetX, gridOffsetY, fogWidth, fogHeight, gridComplete) {
        this.setState({appProperties:{...this.state.appProperties, width, height, gridSize, gridOffsetX, gridOffsetY, fogWidth, fogHeight}, gridComplete});
    }

    onSave() {
        const {suffix} = splitFileName(this.props.metadata.name);
        return updateFileMetadataAndDispatch(this.props.fileAPI, {
            id: this.props.metadata.id,
            name: this.state.name + suffix,
            appProperties: this.state.appProperties
        }, this.props.dispatch, true);
    }

    getNextColour(colour) {
        const index = MapEditor.GRID_COLOURS.indexOf(colour);
        return (index === MapEditor.GRID_COLOURS.length - 1) ? MapEditor.GRID_COLOURS[0] : MapEditor.GRID_COLOURS[index + 1];
    }

    render() {
        return (
            <EditorFrame
                onClose={this.props.onClose}
                allowSave={this.state.appProperties.gridColour === constants.GRID_NONE || this.state.gridComplete}
                onSave={this.onSave}
                className='mapEditor'
            >
                <div className='controls'>
                    <InputField heading='File name' type='text' initialValue={this.state.name}
                                onChange={(name) => {
                                    this.setState({name});
                                }}/>
                    <span>Grid: <button onClick={() => {this.setState({
                        appProperties: {
                            ...this.state.appProperties,
                            gridColour: this.getNextColour(this.state.appProperties.gridColour)
                        }
                    })}}>{capitalize(this.state.appProperties.gridColour)}</button></span>
                </div>
                {
                    this.state.textureUrl ? (
                        <GridEditorComponent
                            appProperties={this.state.appProperties}
                            setGrid={this.setGrid}
                            textureUrl={this.state.textureUrl}
                        />
                    ) : (
                        <div>
                            {
                                this.state.loadError ? (
                                    <span>An error occurred while loading this file: {this.state.loadError}</span>
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