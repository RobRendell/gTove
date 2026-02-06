import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import ReactDropdown from 'react-dropdown-now';
import {AnyAction} from 'redux';
import {ThunkAction} from 'redux-thunk';
import {connect} from 'react-redux';

import {FileAPI} from '../util/storage/storageContract';
import RenameFileEditor from './renameFileEditor';
import {
    defaultMiniProperties,
    FileMetadata,
    IconShapeEnum,
    PieceVisibilityEnum,
    TemplateProperties,
    TemplateShape } from '../util/storage/storageContract';
import { castTemplateProperties } from '../util/storage/storageUtils';
import { getColourHexString } from '../util/scenarioUtils';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import { MiniType, ScenarioType, TabletopType } from '../util/scenarioUtils';
import InputField from './inputField';
import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import InputButton from './inputButton';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducer';
import ColourPicker from './colourPicker';
import {getTabletopFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {FOLDER_TEMPLATE} from '../util/constants';
import VisibilitySlider from './visibilitySlider';
import {compareAlphanumeric} from '../util/stringUtils';

import './templateEditor.scss';

interface TemplateEditorStoreProps extends GtoveDispatchProp {
    tabletop: TabletopType;
}

interface TemplateEditorOwnProps {
    metadata: FileMetadata<void, TemplateProperties>;
    onClose: () => void;
    fileAPI: FileAPI;
}

type TemplateEditorProps = TemplateEditorStoreProps & TemplateEditorOwnProps;

interface TemplateEditorState {
    properties: TemplateProperties;
    scenario: ScenarioType;
    showColourPicker: boolean;
    adjustPosition: boolean;
    templateColourSwatches?: string[];
}

class TemplateEditor extends React.Component<TemplateEditorProps, TemplateEditorState> {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
    };

    static templateShapeStrings = {
        [TemplateShape.RECTANGLE]: 'Rectangle',
        [TemplateShape.CIRCLE]: 'Circle',
        [TemplateShape.ARC]: 'Arc',
        [TemplateShape.ICON]: 'Icon'
    };

    static iconShapeStrings = {
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

    static PREVIEW_TEMPLATE = 'previewTemplate';

    static previewInitialCameraLookAt = new THREE.Vector3(0.5, 0, 0.5);
    static previewInitialCameraPosition = new THREE.Vector3(0.5, 4, 5.5);

    static calculateAppProperties(previous: TemplateProperties, update: Partial<TemplateProperties> = {}): TemplateProperties {
        return {
            rootFolder: FOLDER_TEMPLATE,
            ...previous as Partial<TemplateProperties>,
            ...update
        } as TemplateProperties;
    }

    constructor(props: TemplateEditorProps) {
        super(props);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.fakeDispatch = this.fakeDispatch.bind(this);
        this.state = this.getStateFromProps(props);
    }

    UNSAFE_componentWillReceiveProps(props: TemplateEditorProps) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
        }
    }

    getStateFromProps(props: TemplateEditorProps): TemplateEditorState {
        const properties = TemplateEditor.calculateAppProperties(castTemplateProperties(this.props.metadata.properties!), this.state ? this.state.properties : {});
        return {
            showColourPicker: false,
            adjustPosition: false,
            templateColourSwatches: props.tabletop.templateColourSwatches,
            ...this.state as Partial<TemplateEditorProps>,
            properties: properties,
            scenario: {
                updateSideEffect: false,
                snapToGrid: false,
                confirmMoves: false,
                headActionId: null,
                playerHeadActionId: null,
                maps: {},
                minis: {
                    [TemplateEditor.PREVIEW_TEMPLATE]: {
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
                        ...(this.state && this.state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE]) as Partial<MiniType>,
                        metadata: {...props.metadata, properties: {...properties}}
                    } as MiniType,
                    referenceMini: {
                        name: '',
                        position: {x: 0.5, y: 0, z: 0.5},
                        rotation: {x: 0, y: 0, z: 0, order: 'XYZ'},
                        scale: 1,
                        elevation: 0,
                        visibility: PieceVisibilityEnum.REVEALED,
                        gmOnly: true,
                        selectedBy: null,
                        locked: true,
                        prone: false,
                        flat: false,
                        hideBase: false,
                        piecesRosterValues: {},
                        piecesRosterGMValues: {},
                        piecesRosterSimple: true,
                        metadata: {
                            ...props.metadata,
                            properties: {
                                ...defaultMiniProperties,
                                defaultVisibility: PieceVisibilityEnum.REVEALED
                            }
                        }
                    }
                }
            }
        };
    }

    updateTemplateProperties(appPropertiesUpdate: Partial<TemplateProperties>) {
        this.setState((state) => {
            const properties = {...state.properties, ...appPropertiesUpdate};
            return {
                properties,
                scenario: {
                    ...state.scenario,
                    minis: {
                        ...state.scenario.minis,
                        [TemplateEditor.PREVIEW_TEMPLATE]: {
                            ...state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE],
                            metadata: {
                                ...state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE].metadata,
                                properties
                            }
                        }
                    }
                }
            };
        });
    }

    updateTemplateObject(templateUpdate: Partial<MiniType>) {
        this.setState((state) => ({
            scenario: {
                ...state.scenario,
                minis: {
                    ...state.scenario.minis,
                    [TemplateEditor.PREVIEW_TEMPLATE]: {
                        ...state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE],
                        ...templateUpdate
                    }
                }
            }
        }));
    }

    getSaveMetadata(): Partial<FileMetadata<void, TemplateProperties>> {
        if (this.state.templateColourSwatches) {
            this.props.dispatch(updateTabletopAction({templateColourSwatches: this.state.templateColourSwatches}));
        }
        return {properties: this.state.properties};
    }

    fakeDispatch(action: AnyAction | ThunkAction<void, ReduxStoreType, {}, AnyAction>) {
        if (typeof(action) === 'function') {
            action(this.fakeDispatch, () => ({undoableState: {present: {scenario: this.state.scenario}}} as ReduxStoreType), {});
        } else if (action.type === ScenarioReducerActionTypes.UPDATE_MINI_ACTION && action.miniId === TemplateEditor.PREVIEW_TEMPLATE) {
            if (action.mini.position || action.mini.elevation || action.mini.rotation) {
                if (!action.mini.selectedBy && action.mini.position) {
                    const cos = Math.cos(+this.state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE].rotation.y);
                    const sin = Math.sin(+this.state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE].rotation.y);
                    const x = action.mini.position.x - 0.5;
                    const z = action.mini.position.z - 0.5;
                    this.updateTemplateProperties({
                        offsetX: this.state.properties.offsetX + cos * x - sin * z,
                        offsetZ: this.state.properties.offsetZ + sin * x + cos * z
                    });
                    this.updateTemplateObject({position: {x: 0.5, y: 0, z: 0.5}, selectedBy: null});
                } else if (!action.mini.selectedBy && action.mini.elevation !== undefined) {
                    this.updateTemplateProperties({offsetY: action.mini.elevation + this.state.properties.offsetY});
                    this.updateTemplateObject({elevation: 0, selectedBy: null});
                } else {
                    this.updateTemplateObject(action.mini);
                }
            }
        }
    }

    renderSelect<E>(enumObject: E, labels: {[key in keyof E]: string}, field: string, defaultValue: keyof E) {
        const options = Object.keys(enumObject as any)
            .map((key) => ({label: labels[key as keyof E], value: enumObject[key as keyof E]}))
            .sort((o1, o2) => (compareAlphanumeric(o1.label, o2.label)));
        const currentValue = this.state.properties[field as keyof TemplateProperties] as unknown as E[keyof E];
        const value = options.find(
            (option) => (option.value === (currentValue || enumObject[defaultValue])));
        return (
            <ReactDropdown
                className='select'
                options={options}
                value={value}
                onChange={(selection) => {
                    this.updateTemplateProperties({[field]: selection.value});
                }}
            />
        );
    }

    renderColourControl() {
        return (
            <div key='colourControl'>
                <span>Color</span>
                <div className='colourPicker'>
                    <div className='colourSwatch' onClick={() => {this.setState({showColourPicker: true})}}>
                        <div style={{backgroundColor: getColourHexString(this.state.properties.colour)}}/>
                    </div>
                    {
                        this.state.showColourPicker ? (
                            <OnClickOutsideWrapper onClickOutside={() => {this.setState({showColourPicker: false})}}>
                                <ColourPicker
                                    initialColour={this.state.properties.colour}
                                    initialAlpha={this.state.properties.opacity}
                                    onColourChange={(colourObj) => {
                                        const colour = (colourObj.rgb.r << 16) + (colourObj.rgb.g << 8) + colourObj.rgb.b;
                                        const opacity = colourObj.rgb.a;
                                        this.updateTemplateProperties({colour, opacity});
                                    }}
                                    initialSwatches={this.state.templateColourSwatches}
                                    onSwatchChange={(templateColourSwatches: string[]) => {
                                        this.setState({templateColourSwatches});
                                    }}
                                />
                            </OnClickOutsideWrapper>
                        ) : null
                    }
                </div>
            </div>
        );
    }

    renderHeightControl() {
        return (
            <div key='heightControl' className='heightControl'>
                <span>Height</span>
                <InputField type='number' initialValue={this.state.properties.height} onChange={(height: number) => {
                    this.updateTemplateProperties({height});
                }} minValue={0} updateOnChange={true}/>
            </div>
        );
    }

    renderShapeControls() {
        switch (this.state.properties.templateShape) {
            case TemplateShape.RECTANGLE:
                return [
                    this.renderColourControl(),
                    this.renderHeightControl(),
                    (
                        <div key='rectangleWidth'>
                            <span>Width</span>
                            <InputField type='number' initialValue={this.state.properties.width} onChange={(width: number) => {
                                this.updateTemplateProperties({width});
                            }} minValue={0} updateOnChange={true}/>
                        </div>
                    ), (
                        <div key='rectangleDepth'>
                            <span>Depth</span>
                            <InputField type='number' initialValue={this.state.properties.depth} onChange={(depth: number) => {
                                this.updateTemplateProperties({depth});
                            }} minValue={0} updateOnChange={true}/>
                        </div>
                    )
                ];
            case TemplateShape.CIRCLE:
                return [
                    this.renderColourControl(),
                    this.renderHeightControl(),
                    (
                        <div key='circleRadius'>
                            <span>Radius</span>
                            <InputField type='number' initialValue={this.state.properties.width} onChange={(width: number) => {
                                this.updateTemplateProperties({width});
                            }} minValue={0.1} updateOnChange={true}/>
                        </div>
                    )
                    ];
            case TemplateShape.ARC:
                return [
                    this.renderColourControl(),
                    this.renderHeightControl(),
                    (
                        <div key='arcLength'>
                            <span>Length</span>
                            <InputField type='number' initialValue={this.state.properties.width} onChange={(width: number) => {
                                this.updateTemplateProperties({width});
                            }} minValue={0.1} updateOnChange={true}/>
                        </div>
                    ), (
                        <div key='arcAngle'>
                            <span>Angle</span>
                            <InputField type='number' initialValue={this.state.properties.angle || 60} onChange={(angle: number) => {
                                this.updateTemplateProperties({angle});
                            }} minValue={1} maxValue={359} updateOnChange={true}/>
                            <InputField type='range' initialValue={this.state.properties.angle || 60} onChange={(angle: number) => {
                                this.updateTemplateProperties({angle});
                            }} minValue={1} maxValue={359} step={1}/>
                        </div>
                    )
                ];
            case TemplateShape.ICON:
                return [
                    this.renderColourControl(),
                    (
                        <div key='iconShape'>
                            <span>Icon</span>
                            {this.renderSelect(IconShapeEnum, TemplateEditor.iconShapeStrings, 'iconShape', IconShapeEnum.comment)}
                        </div>
                    )
                ];
        }
    }

    renderAdjustPosition() {
        return (
            <div>
                <InputButton type='checkbox' selected={this.state.adjustPosition} onChange={() => {
                    this.setState({adjustPosition: !this.state.adjustPosition});
                }}>Adjust Position</InputButton>
                {
                    !this.state.adjustPosition ? null : (
                        <div>
                            <span>Elevation</span>
                            <InputField type='number' updateOnChange={true} initialValue={this.state.properties.offsetY} onChange={(value) => {
                                this.updateTemplateProperties({offsetY: Number(value)});
                            }}/>
                        </div>
                    )
                }
            </div>
        );
    }

    renderTemplateEditor() {
        return (
            <div className='editorPanels'>
                <div className='templateEditorPanel'>
                    <fieldset>
                        <legend>Template Parameters</legend>
                        <div>
                            <span>Shape</span>
                            {this.renderSelect(TemplateShape, TemplateEditor.templateShapeStrings, 'templateShape', TemplateShape.RECTANGLE)}
                        </div>
                        {this.renderShapeControls()}
                        <div>
                            <span>Default visibility:</span>
                            <VisibilitySlider visibility={this.state.properties.defaultVisibility || PieceVisibilityEnum.FOGGED} onChange={(value) => {
                                this.updateTemplateProperties({defaultVisibility: value});
                            }} />
                        </div>
                        {this.renderAdjustPosition()}
                        <div>
                            <InputButton type='button'
                                disabled={this.state.properties.offsetX === 0 && this.state.properties.offsetY === 0 && this.state.properties.offsetZ === 0}
                                onChange={() => {
                                    this.updateTemplateProperties({offsetX: 0, offsetY: 0, offsetZ: 0});
                                }}
                            >Reset Position to Origin</InputButton>
                        </div>
                    </fieldset>
                </div>
                <TabletopPreviewComponent
                    scenario={this.state.scenario}
                    dispatch={this.fakeDispatch}
                    cameraLookAt={TemplateEditor.previewInitialCameraLookAt}
                    cameraPosition={TemplateEditor.previewInitialCameraPosition}
                    readOnly={!this.state.adjustPosition}
                    playerView={!this.state.adjustPosition}
                />
            </div>
        );
    }

    render() {
        return (
            <RenameFileEditor
                className='templateEditor'
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.getSaveMetadata}
            >
                {this.renderTemplateEditor()}
            </RenameFileEditor>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        tabletop: getTabletopFromStore(store)
    }
}

export default connect(mapStoreToProps)(TemplateEditor);