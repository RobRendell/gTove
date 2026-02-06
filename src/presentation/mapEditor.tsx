import './mapEditor.scss';

import {FunctionComponent, useCallback, useContext, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import ReactDropdown from 'react-dropdown-now';
import {omit} from 'lodash';

import RenameFileEditor from './renameFileEditor';
import GridEditorComponent from './gridEditorComponent';
import DriveTextureLoader from '../util/storage/providers/google/driveTextureLoader';
import InputButton from './inputButton';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import ColourPicker from './colourPicker';
import {getTabletopFromStore} from '../redux/mainReducer';
import {
    DistanceMode,
    distanceModeStrings,
    DistanceRound,
    distanceRoundStrings,
    getColourHex,
    GRID_COLOUR
} from '../util/scenarioUtils';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {GRID_NONE} from '../util/constants';
import { defaultMapProperties, FileMetadata, GridType, MapProperties } from '../util/storage/storageContract';
import { castMapProperties, isSupportedVideoMimeType } from '../util/storage/storageUtils';
import InputField from './inputField';
import EnumSelect from './enumSelect';

enum GridStateEnum {
    GRID_STATE_ALIGNING, GRID_STATE_SCALING, GRID_STATE_COMPLETE
}

const GRID_TYPE_LABELS: Record<GridType, string> = {
    [GridType.NONE]: 'No Grid',
    [GridType.SQUARE]: 'Square Grid',
    [GridType.HEX_VERT]: 'Hexagonal (Vertical)',
    [GridType.HEX_HORZ]: 'Hexagonal (Horizontal)'
};

const gridTypeOptions = Object.keys(GridType)
    .map((type) => ({
        label: GRID_TYPE_LABELS[GridType[type as keyof typeof GridType]],
        value: GridType[type as keyof typeof GridType]}));

const DEFAULT_COLOUR_SWATCHES = [
    '#000000', '#9b9b9b', '#ffffff', '#8b572a',
    '#c77f16', '#ff0000', '#ffff00', '#00ff00',
    '#00ffff', '#0000ff', '#ff00ff', '#ffa500',
    '#7ed321', '#417505', '#4a90e2', '#50e3c2'
];

interface MapEditorProps {
    metadata: FileMetadata<void, MapProperties>;
    onClose: () => void;
    textureLoader: DriveTextureLoader;
}

const MapEditor: FunctionComponent<MapEditorProps> = ({metadata, onClose, textureLoader}) => {
    const [properties, setProperties] = useState({
        ...defaultMapProperties,
        ...castMapProperties(metadata.properties) as Partial<MapProperties>
    } as MapProperties);
    const [gridState, setGridState] = useState(GridStateEnum.GRID_STATE_ALIGNING);
    const [textureUrl, setTextureUrl] = useState<string | undefined>();
    const [loadError, setLoadError] = useState<string | undefined>();
    const loadMapTexture = useCallback(async () => {
        setTextureUrl(undefined);
        setLoadError(undefined);
        try {
            const blob = await textureLoader.loadImageBlob(metadata);
            setTextureUrl(window.URL.createObjectURL(blob));
        } catch (error) {
            setLoadError((error as Error).message);
        }
    }, [metadata, textureLoader]);
    useEffect(() => {
        setProperties({
            ...defaultMapProperties,
            ...castMapProperties(metadata.properties) as Partial<MapProperties>
        });
        setGridState(GridStateEnum.GRID_STATE_ALIGNING);
        loadMapTexture();
    }, [loadMapTexture, metadata]);
    const getSaveMetadata = useCallback(() => ({
        properties: {...properties}
    }), [properties]);
    const setGrid = useCallback((width: number, height: number, gridSize: number, gridOffsetX: number, gridOffsetY: number, fogWidth: number, fogHeight: number, gridState: number, gridHeight?: number) => {
        setProperties((properties) => ({
            ...properties, width, height, gridSize, gridHeight, gridOffsetX, gridOffsetY, fogWidth, fogHeight
        }))
        setGridState(gridState);
    }, []);

    const promiseModalDialog = useContext(PromiseModalContextObject);
    const tabletop = useSelector(getTabletopFromStore);
    const dispatch = useDispatch();
    const noGrid = (properties.gridType === GridType.NONE);
    return (
        <RenameFileEditor
            onClose={onClose}
            allowSave={noGrid || gridState === GridStateEnum.GRID_STATE_COMPLETE}
            getSaveMetadata={getSaveMetadata}
            metadata={metadata}
            className='mapEditor'
            controls={[
                <ReactDropdown
                    key='gridControl'
                    className='gridSelect'
                    options={gridTypeOptions}
                    value={gridTypeOptions.find((option) => (option.value === properties.gridType))}
                    onChange={(newValue) => {
                        const gridType: GridType = GridType[newValue.value as keyof typeof GridType];
                        setProperties((properties) => ({
                            ...properties,
                            gridType,
                            gridColour: (gridType !== GridType.NONE && properties.gridColour === GRID_NONE) ?
                                'black' : properties.gridColour
                        }));
                    }}
                />,
                noGrid ? null : (
                    <InputButton key='gridColourControl' type='button' onChange={async () => {
                        if (promiseModalDialog?.isAvailable()) {
                            let gridColour = properties.gridColour;
                            let swatches: string[] | undefined = undefined;
                            const okOption = 'OK';
                            const result = await promiseModalDialog({
                                children: (
                                    <div>
                                        <p>Set grid colour</p>
                                        <ColourPicker
                                            disableAlpha={true}
                                            initialColour={getColourHex(properties.gridColour as GRID_COLOUR)}
                                            onColourChange={(colourObj) => {
                                                gridColour = colourObj.hex;
                                            }}
                                            initialSwatches={tabletop.gridColourSwatches || DEFAULT_COLOUR_SWATCHES}
                                            onSwatchChange={(newSwatches: string[]) => {
                                                swatches = newSwatches;
                                            }}
                                        />
                                    </div>
                                ),
                                options: [okOption, 'Cancel']
                            });
                            if (result === okOption) {
                                setProperties((properties) => ({
                                    ...properties,
                                    gridColour
                                }));
                                if (swatches) {
                                    dispatch(updateTabletopAction({gridColourSwatches: swatches}));
                                }
                            }
                        }
                    }}>
                        Color: <span className='gridColourSwatch' style={{backgroundColor: properties.gridColour}}>&nbsp;</span>
                    </InputButton>
                ),
                noGrid || gridState !== GridStateEnum.GRID_STATE_SCALING ? null : (
                    <InputButton key='aspectCheckbox' type='checkbox'
                                 selected={properties.gridHeight === undefined}
                                 onChange={() => {
                                     setProperties((properties) => ({
                                         ...properties,
                                         gridHeight: properties.gridHeight === undefined ? (properties.gridSize || 32) : undefined
                                     }));
                                 }}
                                 tooltip='Turn off to define a non-square grid.  The map will be stretched on the tabletop to make the grid square again.'
                    >
                        Keep Map Aspect Ratio
                    </InputButton>
                ),
                noGrid || gridState !== GridStateEnum.GRID_STATE_COMPLETE ? null : (
                    <InputButton
                        key='showGridControl' type='checkbox' selected={properties.showGrid}
                        onChange={() => {
                            setProperties((properties) => ({
                                ...properties,
                                showGrid: !properties.showGrid
                            }));
                        }}
                    >
                        Show grid overlay on tabletop
                    </InputButton>
                ),
                noGrid ? null : (
                    <>
                        <InputButton type='checkbox' selected={properties.gridScale !== undefined} onChange={() => {
                            setProperties((properties) => (
                                properties.gridScale === undefined ? {
                                    ...properties,
                                    gridScale: tabletop.gridScale,
                                    gridUnit: tabletop.gridUnit
                                } : omit(properties, 'gridScale', 'gridUnit')
                            ));
                        }}>Custom Scale</InputButton>
                        {
                            properties.gridScale === undefined ? null : (
                                <>
                                    <InputField type='number' value={properties.gridScale} onChange={(gridScale) => {
                                        setProperties((properties) => ({...properties, gridScale}));
                                    }} placeholder='Enter scale' className='scaleInputField' />
                                    <InputField type='text' value={properties.gridUnit ?? ''} onChange={(gridUnit) => {
                                        setProperties((properties) => ({...properties, gridUnit}));
                                    }} placeholder='foot/feet etc.' className='scaleInputField' />
                                    <label>Measure distance</label>
                                    <EnumSelect
                                        className='inlineEnumSelect'
                                        containingObject={properties}
                                        fieldName='distanceMode'
                                        enumObject={DistanceMode}
                                        labels={distanceModeStrings}
                                        defaultValue={tabletop.distanceMode}
                                        onChange={setProperties}
                                    />
                                    <label>Distances are</label>
                                    <EnumSelect
                                        className='inlineEnumSelect'
                                        containingObject={properties}
                                        fieldName='distanceRound'
                                        enumObject={DistanceRound}
                                        labels={distanceRoundStrings}
                                        defaultValue={tabletop.distanceRound}
                                        onChange={setProperties}
                                    />
                                </>
                            )
                        }
                    </>
                ),
                noGrid || !textureUrl
                || gridState === GridStateEnum.GRID_STATE_COMPLETE ? null : (
                    <div key='alignTips' className='alignTips'>
                        {
                            gridState === GridStateEnum.GRID_STATE_ALIGNING
                                ? 'Align the grid with the first pushpin - pin it down when finished.'
                                : 'Scale the grid with the second pushpin - pin it down when finished.'
                        }
                    </div>
                )
            ]}
        >
            {
                textureUrl ? (
                    <GridEditorComponent
                        properties={properties}
                        setGrid={setGrid}
                        textureUrl={textureUrl}
                        videoTexture={isSupportedVideoMimeType(metadata.mimeType)}
                    />
                ) : (
                    <div>
                        {
                            loadError ? (
                                <span>An error occurred while loading this file: {loadError}</span>
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

export default MapEditor;