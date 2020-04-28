import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import Select, {Option} from 'react-select';
import {AnyAction} from 'redux';
import {ThunkAction} from 'redux-thunk';
import {connect} from 'react-redux';

import {FileAPI} from '../util/fileUtils';
import RenameFileEditor from './renameFileEditor';
import {castTemplateProperties, DriveMetadata, TemplateProperties, TemplateShape} from '../util/googleDriveUtils';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import {MiniType, PieceVisibilityEnum, ScenarioType, TabletopType} from '../util/scenarioUtils';
import InputField from './inputField';
import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import InputButton from './inputButton';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducer';
import ColourPicker from './ColourPicker';
import {getTabletopFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {updateTabletopAction} from '../redux/tabletopReducer';
import {FOLDER_MINI, FOLDER_TEMPLATE} from '../util/constants';

import './templateEditor.scss';

interface TemplateEditorStoreProps extends GtoveDispatchProp {
    tabletop: TabletopType;
}

interface TemplateEditorOwnProps {
    metadata: DriveMetadata<void, TemplateProperties>;
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
        [TemplateShape.ARC]: 'Arc'
    };

    static PREVIEW_TEMPLATE = 'previewTemplate';

    static calculateAppProperties(previous: TemplateProperties, update: Partial<TemplateProperties> = {}): TemplateProperties {
        return {
            rootFolder: FOLDER_TEMPLATE,
            ...previous,
            ...update
        };
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
        const properties = TemplateEditor.calculateAppProperties(castTemplateProperties(this.props.metadata.properties), this.state ? this.state.properties : {});
        return {
            showColourPicker: false,
            adjustPosition: false,
            templateColourSwatches: props.tabletop.templateColourSwatches,
            ...this.state,
            properties: properties,
            scenario: {
                snapToGrid: false,
                confirmMoves: false,
                headActionIds: [],
                playerHeadActionIds: [],
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
                        ...(this.state && this.state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE]),
                        metadata: {...props.metadata, properties: {...properties}}
                    },
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
                        metadata: {
                            ...props.metadata,
                            properties: {
                                rootFolder: FOLDER_MINI,
                                width: 1,
                                height: 1,
                                aspectRatio: 1,
                                topDownX: 0,
                                topDownY: 0,
                                topDownRadius: 1,
                                standeeX: 0,
                                standeeY: 0,
                                standeeRangeX: 1,
                                standeeRangeY: 1,
                                scale: 1
                            }
                        }
                    }
                }
            }
        };
    }

    updateTemplateAppProperties(appPropertiesUpdate: Partial<TemplateProperties>) {
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

    getSaveMetadata(): Partial<DriveMetadata<void, TemplateProperties>> {
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
                    this.updateTemplateAppProperties({
                        offsetX: this.state.properties.offsetX + cos * x - sin * z,
                        offsetZ: this.state.properties.offsetZ + sin * x + cos * z
                    });
                    this.updateTemplateObject({position: {x: 0.5, y: 0, z: 0.5}, selectedBy: null});
                } else if (!action.mini.selectedBy && action.mini.elevation !== undefined) {
                    this.updateTemplateAppProperties({offsetY: action.mini.elevation + this.state.properties.offsetY});
                    this.updateTemplateObject({elevation: 0, selectedBy: null});
                } else {
                    this.updateTemplateObject(action.mini);
                }
            }
        }
    }

    renderSelect<E>(enumObject: E, labels: {[key in keyof E]: string}, field: string, defaultValue: keyof E) {
        const options = Object.keys(enumObject).map((key) => ({label: labels[key], value: enumObject[key]}));
        const value = options.find((option) => (option.value === (this.state.properties[field] || defaultValue)));
        return (
            <Select
                className='select'
                options={options}
                value={value}
                clearable={false}
                onChange={(selection: Option<string> | null) => {
                    if (selection && selection.value) {
                        this.updateTemplateAppProperties({[field]: selection.value});
                    }
                }}
            />
        );
    }

    renderShapeControls() {
        switch (this.state.properties.templateShape) {
            case TemplateShape.RECTANGLE:
                return [(
                    <div key='rectangleWidth'>
                        <span>Width</span>
                        <InputField type='number' initialValue={this.state.properties.width} onChange={(width: number) => {
                            this.updateTemplateAppProperties({width});
                        }} minValue={0} updateOnChange={true}/>
                    </div>
                ), (
                    <div key='rectangleDepth'>
                        <span>Depth</span>
                        <InputField type='number' initialValue={this.state.properties.depth} onChange={(depth: number) => {
                            this.updateTemplateAppProperties({depth});
                        }} minValue={0} updateOnChange={true}/>
                    </div>
                )];
            case TemplateShape.CIRCLE:
                return (
                    <div key='circleRadius'>
                        <span>Radius</span>
                        <InputField type='number' initialValue={this.state.properties.width} onChange={(width: number) => {
                            this.updateTemplateAppProperties({width});
                        }} minValue={0.1} updateOnChange={true}/>
                    </div>
                );
            case TemplateShape.ARC:
                return [(
                    <div key='arcLength'>
                        <span>Length</span>
                        <InputField type='number' initialValue={this.state.properties.width} onChange={(width: number) => {
                            this.updateTemplateAppProperties({width});
                        }} minValue={0.1} updateOnChange={true}/>
                    </div>
                ), (
                    <div key='arcAngle'>
                        <span>Angle</span>
                        <InputField type='number' initialValue={this.state.properties.angle || 60} onChange={(angle: number) => {
                            this.updateTemplateAppProperties({angle});
                        }} minValue={1} maxValue={359} updateOnChange={true}/>
                        <InputField type='range' initialValue={this.state.properties.angle || 60} onChange={(angle: number) => {
                            this.updateTemplateAppProperties({angle});
                        }} minValue={1} maxValue={359} step={1}/>
                    </div>
                )];
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
                                this.updateTemplateAppProperties({offsetY: Number(value)});
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
                        <div>
                            <span>Color</span>
                            <div className='colourPicker'>
                                <div className='colourSwatch' onClick={() => {this.setState({showColourPicker: true})}}>
                                    <div style={{backgroundColor: `#${('000000' + this.state.properties.colour.toString(16)).slice(-6)}`}}/>
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
                                                    this.updateTemplateAppProperties({colour, opacity});
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
                        <div>
                            <span>Height</span>
                            <InputField type='number' initialValue={this.state.properties.height} onChange={(height: number) => {
                                this.updateTemplateAppProperties({height});
                            }} minValue={0} updateOnChange={true}/>
                        </div>
                        {this.renderShapeControls()}
                        {this.renderAdjustPosition()}
                        <div>
                            <InputButton type='button'
                                disabled={this.state.properties.offsetX === 0 && this.state.properties.offsetY === 0 && this.state.properties.offsetZ === 0}
                                onChange={() => {
                                    this.updateTemplateAppProperties({offsetX: 0, offsetY: 0, offsetZ: 0});
                                }}
                            >Reset Position to Origin</InputButton>
                        </div>
                    </fieldset>
                </div>
                <TabletopPreviewComponent
                    scenario={this.state.scenario}
                    dispatch={this.fakeDispatch}
                    cameraLookAt={new THREE.Vector3(0.5, 0, 0.5)}
                    cameraPosition={new THREE.Vector3(0.5, 4, 5.5)}
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