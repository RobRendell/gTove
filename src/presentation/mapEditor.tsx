import * as React from 'react';
import * as PropTypes from 'prop-types';
import {capitalize} from 'lodash';

import RenameFileEditor from './renameFileEditor';
import GridEditorComponent from './gridEditorComponent';
import * as constants from '../util/constants';
import {castMapAppProperties, DriveMetadata, MapAppProperties} from '../util/googleDriveUtils';
import DriveTextureLoader from '../util/driveTextureLoader';
import InputButton from './inputButton';

import './mapEditor.scss';

interface MapEditorProps {
    metadata: DriveMetadata<MapAppProperties>;
    onClose: () => {};
    textureLoader: DriveTextureLoader;
}

interface MapEditorState {
    name: string;
    appProperties: MapAppProperties;
    gridState: number;
    textureUrl?: string;
    loadError?: string;
}

class MapEditor extends React.Component<MapEditorProps, MapEditorState> {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired,
    };

    static GRID_COLOURS = [constants.GRID_NONE, 'black', 'grey', 'white', 'brown', 'tan', 'red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];

    static GRID_STATE_ALIGNING = 0;
    static GRID_STATE_SCALING = 1;
    static GRID_STATE_COMPLETE = 2;

    constructor(props: MapEditorProps) {
        super(props);
        this.setGrid = this.setGrid.bind(this);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
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
            name: '',
            appProperties: {
                gridColour: constants.GRID_NONE,
                ...castMapAppProperties(props.metadata.appProperties)
            },
            gridState: 0,
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
                this.setState({loadError: error.message});
            });
    }

    setGrid(width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridState: number) {
        this.setState({appProperties:{...this.state.appProperties, width, height, gridSize, gridOffsetX, gridOffsetY, fogWidth, fogHeight}, gridState});
    }

    getSaveMetadata(): Partial<DriveMetadata> {
        return {appProperties: {...this.state.appProperties}};
    }

    getNextColour(colour: string) {
        const index = MapEditor.GRID_COLOURS.indexOf(colour);
        return (index === MapEditor.GRID_COLOURS.length - 1) ? MapEditor.GRID_COLOURS[0] : MapEditor.GRID_COLOURS[index + 1];
    }

    render() {
        return (
            <RenameFileEditor
                onClose={this.props.onClose}
                allowSave={this.state.appProperties.gridColour === constants.GRID_NONE || this.state.gridState === MapEditor.GRID_STATE_COMPLETE}
                getSaveMetadata={this.getSaveMetadata}
                metadata={this.props.metadata}
                className='mapEditor'
                controls={[
                    <span key='gridColourControl'>Grid: <InputButton type='button' onChange={() => {this.setState({
                        appProperties: {
                            ...this.state.appProperties,
                            gridColour: this.getNextColour(this.state.appProperties.gridColour)
                        }
                    })}}>{capitalize(this.state.appProperties.gridColour)}</InputButton></span>,
                    this.state.appProperties.gridColour === constants.GRID_NONE ? null : (
                        <span key='showGridControl'> Show grid overlay on tabletop: <InputButton type='button' onChange={() => {this.setState({
                            appProperties: {
                                ...this.state.appProperties,
                                showGrid: !this.state.appProperties.showGrid
                            }
                        })}}>{this.state.appProperties.showGrid ? 'Yes' : 'No'}</InputButton></span>
                    ),
                    this.state.appProperties.gridColour === constants.GRID_NONE || !this.state.textureUrl
                        || this.state.gridState === MapEditor.GRID_STATE_COMPLETE ? null : (
                        <div key='alignTips'>
                            {
                                this.state.gridState === MapEditor.GRID_STATE_ALIGNING
                                    ? 'Align the grid with the first pushpin - pin it down when finished.'
                                    : 'Scale the grid with the second pushpin - pin it down when finished.'
                            }
                        </div>
                    )
                ]}
            >
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
            </RenameFileEditor>
        );
    }
}

export default MapEditor;