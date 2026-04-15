import './templateEditor.scss';

import {FunctionComponent, useCallback, useMemo, useState} from 'react';
import ReactDropdown from 'react-dropdown-now';
import {useDispatch, useSelector} from 'react-redux';
import {AnyAction} from 'redux';
import {ThunkAction} from 'redux-thunk';
import {Vector3} from 'three';

import {BaseEditorProps} from '../container/browseFilesComponent';
import InputField from '../container/inputField';
import {getTabletopFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducerTypes';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {FOLDER_TEMPLATE} from '../util/constants';
import {MiniType, ScenarioType} from '../util/scenarioUtils';
import {IconShapeEnum, PieceVisibilityEnum, TemplateProperties, TemplateShape} from '../util/storage/storageContract';
import {castTemplateProperties} from '../util/storage/storageUtils';
import {compareAlphanumeric} from '../util/stringUtils';
import ColourPickerButton from './colourPickerButton';
import InputButton from './inputButton';
import RenameFileEditor from './renameFileEditor';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import VisibilitySlider from './visibilitySlider';

const templateShapeStrings = {
    [TemplateShape.RECTANGLE]: 'Rectangle',
    [TemplateShape.CIRCLE]: 'Circle',
    [TemplateShape.ARC]: 'Arc',
    [TemplateShape.ICON]: 'Icon'
};

const iconShapeStrings = {
    [IconShapeEnum.comment]: 'Comment',
    [IconShapeEnum.account_balance]: 'Temple',
    [IconShapeEnum.build]: 'Wrench',
    [IconShapeEnum.home]: 'Hut',
    [IconShapeEnum.lock]: 'Locked',
    [IconShapeEnum.lock_open]: 'Unlocked',
    [IconShapeEnum.place]: 'Place',
    [IconShapeEnum.brightness_2]: 'Moon',
    [IconShapeEnum.brightness_5]: 'Sun',
    [IconShapeEnum.star]: 'Star',
    [IconShapeEnum.cloud]: 'Cloud',
    [IconShapeEnum.assistant_photo]: 'Flag',
    [IconShapeEnum.close]: 'Cross'
};

const PREVIEW_TEMPLATE = 'previewTemplate';

const previewInitialCameraLookAt = new Vector3(0.5, 0, 0.5);
const previewInitialCameraPosition = new Vector3(0.5, 4, 5.5);

interface TemplateEditorProps extends BaseEditorProps<void, TemplateProperties> {
}

const TemplateEditor: FunctionComponent<TemplateEditorProps> = ({metadata, onClose}) => {
    const tabletop = useSelector(getTabletopFromStore);
    const dispatch = useDispatch();
    
    const [properties, setProperties] = useState<TemplateProperties>(calculateAppProperties(castTemplateProperties(metadata.properties!), {}));
    const [adjustPosition, setAdjustPosition] = useState(false);
    const [templateColourSwatches, setTemplateColourSwatches] = useState(tabletop.templateColourSwatches);
    const [template, setTemplate] = useState<MiniType>({
        name: '',
        position: {x: 0.5, y: 0, z: 0.5},
        rotation: {x: 0, y: 0, z: 0, order: 'XYZ'},
        scale: 1,
        elevation: 0,
        gmOnly: false,
        selectedBy: null,
        locked: false,
        prone: false,
        flat: false,
        hideBase: false,
        visibility: PieceVisibilityEnum.REVEALED,
        piecesRosterValues: {},
        piecesRosterGMValues: {},
        piecesRosterSimple: true,
        metadata
    });
    
    const updateTemplateProperties = useCallback((update: Partial<TemplateProperties>) => {
        setProperties((properties) => ({...properties, ...update}));
    }, []);
    
    const updateTemplateObject = useCallback((update: Partial<MiniType>) => {
        setTemplate((template) => ({...template, ...update}));
    }, []);
    
    const scenario = useMemo<ScenarioType>(() => ({
        updateSideEffect: false,
        snapToGrid: false,
        confirmMoves: false,
        headActionId: null,
        playerHeadActionId: null,
        maps: {},
        minis: {
            [PREVIEW_TEMPLATE]: {
                ...template,
                metadata: {...metadata, properties: {...properties}}
            } as MiniType
        }
    }), [metadata, properties, template]);
    
    const getSaveMetadata = useCallback(() => {
        if (templateColourSwatches) {
            dispatch(updateTabletopAction({templateColourSwatches}));
        }
        return {properties};
    }, [dispatch, properties, templateColourSwatches]);
    
    const fakeDispatch = useCallback((action: AnyAction | ThunkAction<void, ReduxStoreType, {}, AnyAction>) => {
        if (typeof(action) === 'function') {
            action(fakeDispatch, () => ({undoableState: {present: {scenario}}} as unknown as ReduxStoreType), {});
        } else if (action.type === ScenarioReducerActionTypes.UPDATE_MINI_ACTION && action.miniId === PREVIEW_TEMPLATE) {
            if (action.mini.position || action.mini.elevation || action.mini.rotation) {
                if (!action.mini.selectedBy && action.mini.position) {
                    const cos = Math.cos(+template.rotation.y);
                    const sin = Math.sin(+template.rotation.y);
                    const x = action.mini.position.x - 0.5;
                    const z = action.mini.position.z - 0.5;
                    updateTemplateProperties({
                        offsetX: properties.offsetX + cos * x - sin * z,
                        offsetZ: properties.offsetZ + sin * x + cos * z
                    });
                    updateTemplateObject({position: {x: 0.5, y: 0, z: 0.5}, selectedBy: null});
                } else if (!action.mini.selectedBy && action.mini.elevation !== undefined) {
                    updateTemplateProperties({offsetY: action.mini.elevation + properties.offsetY});
                    updateTemplateObject({elevation: 0, selectedBy: null});
                } else {
                    updateTemplateObject(action.mini);
                }
            }
        }
    }, [properties.offsetX, properties.offsetY, properties.offsetZ, scenario, template.rotation.y, updateTemplateObject, updateTemplateProperties]);
    
    const renderSelect = useCallback(<E,>(enumObject: E, labels: {[key in keyof E]: string}, field: string, defaultValue: keyof E) => {
        const options = Object.keys(enumObject as any)
            .map((key) => ({label: labels[key as keyof E], value: enumObject[key as keyof E]}))
            .sort((o1, o2) => (compareAlphanumeric(o1.label, o2.label)));
        const currentValue = properties[field as keyof TemplateProperties] as unknown as E[keyof E];
        const value = options.find(
            (option) => (option.value === (currentValue || enumObject[defaultValue])));
        return (
            <ReactDropdown
                className='select'
                options={options}
                value={value}
                onChange={(selection) => {
                    updateTemplateProperties({[field]: selection.value});
                }}
            />
        );
    }, [properties, updateTemplateProperties]);
    
    const renderColourControl = useCallback(() => {
        return (
            <div key='colourControl'>
                <span>Colour</span>
                <ColourPickerButton
                    initialColour={properties.colour}
                    initialAlpha={properties.opacity}
                    onColourChange={(colourObj) => {
                        const colour = (colourObj.rgb.r << 16) + (colourObj.rgb.g << 8) + colourObj.rgb.b;
                        const opacity = colourObj.rgb.a;
                        updateTemplateProperties({colour, opacity});
                    }}
                    initialSwatches={templateColourSwatches}
                    onSwatchChange={setTemplateColourSwatches}
                    className='colourPicker'
                />
            </div>
        );
    }, [properties.colour, properties.opacity, templateColourSwatches, updateTemplateProperties]);
    
    const renderHeightControl = useCallback(() => {
        return (
            <div key='heightControl' className='heightControl'>
                <span>Height</span>
                <InputField type='number' initialValue={properties.height} onChange={(height: number) => {
                    updateTemplateProperties({height});
                }} minValue={0} updateOnChange={true}/>
            </div>
        );
    }, [properties.height, updateTemplateProperties]);
    
    const renderShapeControls = useCallback(() => {
        switch (properties.templateShape) {
            case TemplateShape.RECTANGLE:
                return [
                    renderColourControl(),
                    renderHeightControl(),
                    (
                        <div key='rectangleWidth'>
                            <span>Width</span>
                            <InputField type='number' initialValue={properties.width} onChange={(width: number) => {
                                updateTemplateProperties({width});
                            }} minValue={0} updateOnChange={true}/>
                        </div>
                    ), (
                        <div key='rectangleDepth'>
                            <span>Depth</span>
                            <InputField type='number' initialValue={properties.depth} onChange={(depth: number) => {
                                updateTemplateProperties({depth});
                            }} minValue={0} updateOnChange={true}/>
                        </div>
                    )
                ];
            case TemplateShape.CIRCLE:
                return [
                    renderColourControl(),
                    renderHeightControl(),
                    (
                        <div key='circleRadius'>
                            <span>Radius</span>
                            <InputField type='number' initialValue={properties.width} onChange={(width: number) => {
                                updateTemplateProperties({width});
                            }} minValue={0.1} updateOnChange={true}/>
                        </div>
                    )
                ];
            case TemplateShape.ARC:
                return [
                    renderColourControl(),
                    renderHeightControl(),
                    (
                        <div key='arcLength'>
                            <span>Length</span>
                            <InputField type='number' initialValue={properties.width} onChange={(width: number) => {
                                updateTemplateProperties({width});
                            }} minValue={0.1} updateOnChange={true}/>
                        </div>
                    ), (
                        <div key='arcAngle'>
                            <span>Angle</span>
                            <InputField type='number' initialValue={properties.angle || 60} onChange={(angle: number) => {
                                updateTemplateProperties({angle});
                            }} minValue={1} maxValue={359} updateOnChange={true}/>
                            <InputField type='range' initialValue={properties.angle || 60} onChange={(angle: number) => {
                                updateTemplateProperties({angle});
                            }} minValue={1} maxValue={359} step={1}/>
                        </div>
                    )
                ];
            case TemplateShape.ICON:
                return [
                    renderColourControl(),
                    (
                        <div key='iconShape'>
                            <span>Icon</span>
                            {renderSelect(IconShapeEnum, iconShapeStrings, 'iconShape', IconShapeEnum.comment)}
                        </div>
                    )
                ];
        }
    }, [properties, renderColourControl, renderHeightControl, renderSelect, updateTemplateProperties]);

    return (
        <RenameFileEditor
            className='templateEditor'
            metadata={metadata}
            onClose={onClose}
            getSaveMetadata={getSaveMetadata}
        >
            <div className='editorPanels'>
                <div className='templateEditorPanel'>
                    <fieldset>
                        <legend>Template Parameters</legend>
                        <div>
                            <span>Shape</span>
                            {renderSelect(TemplateShape, templateShapeStrings, 'templateShape', TemplateShape.RECTANGLE)}
                        </div>
                        {renderShapeControls()}
                        <div>
                            <span>Default visibility:</span>
                            <VisibilitySlider visibility={properties.defaultVisibility || PieceVisibilityEnum.FOGGED} onChange={(value) => {
                                updateTemplateProperties({defaultVisibility: value});
                            }} />
                        </div>
                        <div>
                            <InputButton type='checkbox' selected={adjustPosition} onChange={() => {
                                setAdjustPosition(!adjustPosition);
                            }}>Adjust Position</InputButton>
                            {
                                !adjustPosition ? null : (
                                    <div>
                                        <span>Elevation</span>
                                        <InputField type='number' updateOnChange={true} initialValue={properties.offsetY} onChange={(value) => {
                                            updateTemplateProperties({offsetY: Number(value)});
                                        }}/>
                                    </div>
                                )
                            }
                        </div>
                        <div>
                            <InputButton type='button'
                                         disabled={properties.offsetX === 0 && properties.offsetY === 0 && properties.offsetZ === 0}
                                         onChange={() => {
                                             updateTemplateProperties({offsetX: 0, offsetY: 0, offsetZ: 0});
                                         }}
                            >Reset Position to Origin</InputButton>
                        </div>
                    </fieldset>
                </div>
                <TabletopPreviewComponent
                    scenario={scenario}
                    dispatch={fakeDispatch}
                    cameraLookAt={previewInitialCameraLookAt}
                    cameraPosition={previewInitialCameraPosition}
                    readOnly={!adjustPosition}
                    playerView={!adjustPosition}
                />
            </div>
        </RenameFileEditor>
    );
};

export default TemplateEditor;

function calculateAppProperties(previous: TemplateProperties, update: Partial<TemplateProperties> = {}): TemplateProperties {
    return {
        rootFolder: FOLDER_TEMPLATE,
        ...previous as Partial<TemplateProperties>,
        ...update
    } as TemplateProperties;
}