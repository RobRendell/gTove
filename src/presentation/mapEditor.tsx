import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import ReactDropdown from 'react-dropdown-now';

import RenameFileEditor from './renameFileEditor';
import GridEditorComponent from './gridEditorComponent';
import {AnyAppProperties, castMapProperties, DriveMetadata, GridType, MapProperties} from '../util/googleDriveUtils';
import DriveTextureLoader from '../util/driveTextureLoader';
import InputButton from './inputButton';
import {PromiseModalContext} from '../container/authenticatedContainer';
import ColourPicker from './colourPicker';
import {getTabletopFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {getColourHex, TabletopType} from '../util/scenarioUtils';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {FOLDER_MAP, GRID_NONE} from '../util/constants';
import {isSupportedVideoMimeType} from '../util/fileUtils';

import './mapEditor.scss';

interface MapEditorStoreProps {
    tabletop: TabletopType;
}

interface MapEditorOwnProps {
    metadata: DriveMetadata<AnyAppProperties, MapProperties>;
    onClose: () => {};
    textureLoader: DriveTextureLoader;
}

type MapEditorProps = MapEditorStoreProps & GtoveDispatchProp & MapEditorOwnProps;

interface MapEditorState {
    name: string;
    properties: MapProperties;
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

    static contextTypes = {
        promiseModal: PropTypes.func
    };

    context: PromiseModalContext;

    static DEFAULT_COLOUR_SWATCHES = [
        '#000000', '#9b9b9b', '#ffffff', '#8b572a',
        '#c77f16', '#ff0000', '#ffff00', '#00ff00',
        '#00ffff', '#0000ff', '#ff00ff', '#ffa500',
        '#7ed321', '#417505', '#4a90e2', '#50e3c2'
    ];

    static GRID_STATE_ALIGNING = 0;
    static GRID_STATE_SCALING = 1;
    static GRID_STATE_COMPLETE = 2;

    static GRID_TYPE_LABELS = {
        [GridType.NONE]: 'No Grid',
        [GridType.SQUARE]: 'Square Grid',
        [GridType.HEX_VERT]: 'Hexagonal (Vertical)',
        [GridType.HEX_HORZ]: 'Hexagonal (Horizontal)'
    };

    private readonly gridTypeOptions: {label: string, value: GridType}[];

    constructor(props: MapEditorProps) {
        super(props);
        this.setGrid = this.setGrid.bind(this);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.state = this.getStateFromProps(props);
        this.gridTypeOptions = Object.keys(GridType).map((type) => ({label: MapEditor.GRID_TYPE_LABELS[GridType[type]], value: GridType[type]}));
        this.loadMapTexture();
    }

    UNSAFE_componentWillReceiveProps(props: MapEditorProps) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
            this.loadMapTexture();
        }
    }

    getStateFromProps(props: MapEditorProps): MapEditorState {
        return {
            name: '',
            properties: {
                rootFolder: FOLDER_MAP,
                gridColour: GRID_NONE,
                gridType: GridType.NONE,
                ...castMapProperties(props.metadata.properties)
            },
            gridState: MapEditor.GRID_STATE_ALIGNING,
            textureUrl: undefined,
            loadError: undefined
        };
    }

    async loadMapTexture() {
        try {
            const blob = await this.props.textureLoader.loadImageBlob({id: this.props.metadata.id});
            this.setState({textureUrl: window.URL.createObjectURL(blob)});
        } catch (error) {
            this.setState({loadError: error.message});
        }
    }

    setGrid(width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridState: number, gridHeight?: number) {
        this.setState({properties:{...this.state.properties, width, height, gridSize, gridHeight, gridOffsetX, gridOffsetY, fogWidth, fogHeight}, gridState});
    }

    getSaveMetadata(): Partial<DriveMetadata> {
        return {properties: {...this.state.properties}};
    }

    render() {
        const noGrid = this.state.properties.gridType === GridType.NONE;
        return (
            <RenameFileEditor
                onClose={this.props.onClose}
                allowSave={noGrid || this.state.gridState === MapEditor.GRID_STATE_COMPLETE}
                getSaveMetadata={this.getSaveMetadata}
                metadata={this.props.metadata}
                className='mapEditor'
                controls={[
                    <ReactDropdown
                        key='gridControl'
                        className='gridSelect'
                        options={this.gridTypeOptions}
                        value={this.gridTypeOptions.find((option) => (option.value === this.state.properties.gridType))}
                        onChange={(newValue) => {
                            const gridType: GridType = GridType[newValue.value];
                            this.setState({
                                properties: {
                                    ...this.state.properties,
                                    gridType,
                                    gridColour: (gridType !== GridType.NONE && this.state.properties.gridColour === GRID_NONE) ?
                                        'black' : this.state.properties.gridColour
                                }
                            });
                        }}
                    />,
                    noGrid ? null : (
                        <InputButton key='gridColourControl' type='button' onChange={async () => {
                            if (this.context.promiseModal && !this.context.promiseModal.isBusy()) {
                                let gridColour = this.state.properties.gridColour;
                                let swatches: string[] | undefined = undefined;
                                const okOption = 'OK';
                                const result = await this.context.promiseModal({
                                    children: (
                                        <div>
                                            <p>Set grid colour</p>
                                            <ColourPicker
                                                disableAlpha={true}
                                                initialColour={getColourHex(this.state.properties.gridColour)}
                                                onColourChange={(colourObj) => {
                                                    gridColour = colourObj.hex;
                                                }}
                                                initialSwatches={this.props.tabletop.gridColourSwatches || MapEditor.DEFAULT_COLOUR_SWATCHES}
                                                onSwatchChange={(newSwatches: string[]) => {
                                                    swatches = newSwatches;
                                                }}
                                            />
                                        </div>
                                    ),
                                    options: [okOption, 'Cancel']
                                });
                                if (result === okOption) {
                                    this.setState({
                                        properties: {
                                            ...this.state.properties,
                                            gridColour
                                        }
                                    });
                                    if (swatches) {
                                        this.props.dispatch(updateTabletopAction({gridColourSwatches: swatches}));
                                    }
                                }
                            }
                        }}>
                            Color: <span className='gridColourSwatch' style={{backgroundColor: this.state.properties.gridColour}}>&nbsp;</span>
                        </InputButton>
                    ),
                    noGrid || this.state.gridState !== MapEditor.GRID_STATE_SCALING ? null : (
                        <InputButton key='aspectCheckbox' type='checkbox'
                                     selected={this.state.properties.gridHeight === undefined}
                                     onChange={() => {
                                         this.setState({
                                             properties: {
                                                 ...this.state.properties,
                                                 gridHeight: this.state.properties.gridHeight === undefined ? (this.state.properties.gridSize || 32) : undefined
                                             }
                                         })
                                     }}
                                     tooltip='Turn off to define a non-square grid.  The map will be stretched on the tabletop to make the grid square again.'
                        >
                            Keep Map Aspect Ratio
                        </InputButton>
                    ),
                    noGrid || this.state.gridState !== MapEditor.GRID_STATE_COMPLETE ? null : (
                        <InputButton
                            key='showGridControl' type='checkbox' selected={this.state.properties.showGrid}
                            onChange={() => {this.setState({
                            properties: {
                                ...this.state.properties,
                                showGrid: !this.state.properties.showGrid
                            }})}}
                        >
                            Show grid overlay on tabletop
                        </InputButton>
                    ),
                    noGrid || !this.state.textureUrl
                        || this.state.gridState === MapEditor.GRID_STATE_COMPLETE ? null : (
                        <div key='alignTips' className='alignTips'>
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
                            properties={this.state.properties}
                            setGrid={this.setGrid}
                            textureUrl={this.state.textureUrl}
                            videoTexture={isSupportedVideoMimeType(this.props.metadata.mimeType)}
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

function mapStoreToProps(store: ReduxStoreType): MapEditorStoreProps {
    return  {
        tabletop: getTabletopFromStore(store)
    }
}

export default connect(mapStoreToProps)(MapEditor);