import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect, DispatchProp} from 'react-redux';
import Select, {Options} from 'react-select';

import RenameFileEditor from './renameFileEditor';
import GridEditorComponent from './gridEditorComponent';
import {castMapAppProperties, DriveMetadata, GridType, MapAppProperties} from '../util/googleDriveUtils';
import DriveTextureLoader from '../util/driveTextureLoader';
import InputButton from './inputButton';
import {PromiseModalContext} from '../container/authenticatedContainer';
import ColourPicker from './ColourPicker';
import {getTabletopFromStore, ReduxStoreType} from '../redux/mainReducer';
import {TabletopType} from '../util/scenarioUtils';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {GRID_NONE} from '../util/constants';

import './mapEditor.scss';

interface MapEditorStoreProps extends DispatchProp {
    tabletop: TabletopType;
}

interface MapEditorOwnProps {
    metadata: DriveMetadata<MapAppProperties>;
    onClose: () => {};
    textureLoader: DriveTextureLoader;
}

type MapEditorProps = MapEditorStoreProps & MapEditorOwnProps;

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

    static contextTypes = {
        promiseModal: PropTypes.func
    };

    context: PromiseModalContext;

    static GRID_COLOUR_TO_HEX = {
        black: '#000000', grey: '#9b9b9b', white: '#ffffff', brown: '#8b572a',
        tan: '#c77f16', red: '#ff0000', yellow: '#ffff00', green: '#00ff00',
        cyan: '#00ffff', blue: '#0000ff', magenta: '#ff00ff'
    };

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

    private gridTypeOptions: Options<GridType>;

    constructor(props: MapEditorProps) {
        super(props);
        this.setGrid = this.setGrid.bind(this);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.state = this.getStateFromProps(props);
        this.gridTypeOptions = Object.keys(GridType).map((type) => ({label: MapEditor.GRID_TYPE_LABELS[GridType[type]], value: GridType[type]}));
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
                gridColour: GRID_NONE,
                gridType: GridType.NONE,
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

    setGrid(width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridState: number, gridHeight?: number) {
        this.setState({appProperties:{...this.state.appProperties, width, height, gridSize, gridHeight, gridOffsetX, gridOffsetY, fogWidth, fogHeight}, gridState});
    }

    getSaveMetadata(): Partial<DriveMetadata> {
        return {appProperties: {...this.state.appProperties}};
    }

    getGridColour() {
        const gridColour = this.state.appProperties.gridColour;
        const hex = MapEditor.GRID_COLOUR_TO_HEX[gridColour] || gridColour;
        return Number.parseInt(hex.substr(1), 16);
    }

    render() {
        const noGrid = this.state.appProperties.gridType === GridType.NONE;
        return (
            <RenameFileEditor
                onClose={this.props.onClose}
                allowSave={noGrid || this.state.gridState === MapEditor.GRID_STATE_COMPLETE}
                getSaveMetadata={this.getSaveMetadata}
                metadata={this.props.metadata}
                className='mapEditor'
                controls={[
                    <Select
                        key='gridControl'
                        className='gridSelect'
                        options={this.gridTypeOptions}
                        value={this.state.appProperties.gridType}
                        onChange={(newValue) => {
                            if (newValue && !Array.isArray(newValue) && newValue.value) {
                                const gridType: GridType = newValue.value;
                                this.setState({
                                    appProperties: {
                                        ...this.state.appProperties,
                                        gridType,
                                        gridColour: (gridType !== GridType.NONE && this.state.appProperties.gridColour === GRID_NONE) ?
                                            'black' : this.state.appProperties.gridColour
                                    }
                                });
                            }
                        }}
                        clearable={false}
                    />,
                    noGrid ? null : (
                        <InputButton key='gridColourControl' type='button' onChange={async () => {
                            let gridColour = this.state.appProperties.gridColour;
                            let swatches: string[] | undefined = undefined;
                            const okOption = 'OK';
                            const result = this.context.promiseModal && await this.context.promiseModal({
                                children: (
                                    <div>
                                        <p>Set grid colour</p>
                                        <ColourPicker
                                            disableAlpha={true}
                                            initialColour={this.getGridColour()}
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
                                    appProperties: {
                                        ...this.state.appProperties,
                                        gridColour
                                    }
                                });
                                if (swatches) {
                                    this.props.dispatch(updateTabletopAction({gridColourSwatches: swatches}));
                                }
                            }
                        }}>
                            Color: <span className='gridColourSwatch' style={{backgroundColor: this.state.appProperties.gridColour}}>&nbsp;</span>
                        </InputButton>
                    ),
                    noGrid || this.state.gridState !== MapEditor.GRID_STATE_SCALING ? null : (
                        <InputButton key='aspectCheckbox' type='checkbox'
                                     selected={this.state.appProperties.gridHeight === undefined}
                                     onChange={() => {
                                         this.setState({
                                             appProperties: {
                                                 ...this.state.appProperties,
                                                 gridHeight: this.state.appProperties.gridHeight === undefined ? (this.state.appProperties.gridSize || 32) : undefined
                                             }
                                         })
                                     }}
                                     title='Turn off to define a non-square grid.  The map will be stretched on the tabletop to make the grid square again.'
                        >
                            Keep Map Aspect Ratio
                        </InputButton>
                    ),
                    noGrid || this.state.gridState !== MapEditor.GRID_STATE_COMPLETE ? null : (
                        <InputButton
                            key='showGridControl' type='checkbox' selected={this.state.appProperties.showGrid}
                            onChange={() => {this.setState({
                            appProperties: {
                                ...this.state.appProperties,
                                showGrid: !this.state.appProperties.showGrid
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

function mapStoreToProps(store: ReduxStoreType) {
    return  {
        tabletop: getTabletopFromStore(store)
    }
}

export default connect(mapStoreToProps)(MapEditor);