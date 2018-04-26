import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Dispatch} from 'redux';
import {capitalize} from 'lodash';

import {FileAPI, splitFileName, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputField from './inputField';
import EditorFrame from './editorFrame';
import GridEditorComponent from './gridEditorComponent';
import * as constants from '../util/constants';
import {DriveMetadata, MapAppProperties} from '../@types/googleDrive';
import {ReduxStoreType} from '../redux/mainReducer';
import DriveTextureLoader from '../util/driveTextureLoader';

import './mapEditor.css';

interface MapEditorProps {
    metadata: DriveMetadata<MapAppProperties>;
    name: string;
    onClose: () => {};
    dispatch: Dispatch<ReduxStoreType>;
    textureLoader: DriveTextureLoader;
    fileAPI: FileAPI;
}

interface MapEditorState {
    name: string;
    appProperties: MapAppProperties;
    gridComplete: boolean;
    textureUrl?: string;
    loadError?: string;
}

class MapEditor extends React.Component<MapEditorProps, MapEditorState> {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired,
        fileAPI: PropTypes.object.isRequired
    };

    static GRID_COLOURS = [constants.GRID_NONE, 'black', 'white', 'magenta'];

    constructor(props: MapEditorProps) {
        super(props);
        this.setGrid = this.setGrid.bind(this);
        this.onSave = this.onSave.bind(this);
        this.state = this.getStateFromProps(props);
        this.loadMapTexture();
    }

    componentWillReceiveProps(props: MapEditorProps) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
            this.loadMapTexture();
        }
    }

    getStateFromProps(props: MapEditorProps): MapEditorState {
        return {
            name: props.name,
            appProperties: {
                gridColour: constants.GRID_NONE,
                ...props.metadata.appProperties
            },
            gridComplete: false,
            textureUrl: undefined,
            loadError: undefined
        };
    }

    loadMapTexture() {
        this.props.textureLoader.loadImageBlob({id: this.props.metadata.id})
            .then((blob: Blob) => {
                this.setState({textureUrl: window.URL.createObjectURL(blob)});
            })
            .catch((error: Error) => {
                this.setState({loadError: error.toString()});
            });
    }

    setGrid(width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridComplete: boolean) {
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

    getNextColour(colour: string) {
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
                                onChange={(name: string) => {
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