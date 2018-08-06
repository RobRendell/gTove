import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import Select from 'react-select';
import {ChromePicker} from 'react-color';
import {AnyAction} from 'redux';
import {ThunkAction} from 'redux-thunk';

import {FileAPI} from '../util/fileUtils';
import RenameFileEditor from './renameFileEditor';
import {castTemplateAppProperties, DriveMetadata, TemplateAppProperties, TemplateShape} from '../util/googleDriveUtils';
import TabletopViewComponent from './tabletopViewComponent';
import {VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import {MiniType, ScenarioType, TabletopType} from '../util/scenarioUtils';
import InputField from './inputField';
import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import InputButton from './inputButton';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducer';

import './templateEditor.css';

interface TemplateEditorProps {
    metadata: DriveMetadata<TemplateAppProperties>;
    onClose: () => {};
    fileAPI: FileAPI;
}

interface TemplateEditorState extends VirtualGamingTabletopCameraState {
    appProperties: TemplateAppProperties;
    scenario: ScenarioType;
    showColourPicker: boolean;
    adjustPosition: boolean;
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

    static calculateAppProperties(previous: TemplateAppProperties, update: Partial<TemplateAppProperties> = {}): TemplateAppProperties {
        return {...previous, ...update};
    }

    constructor(props: TemplateEditorProps) {
        super(props);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.setCameraParameters = this.setCameraParameters.bind(this);
        this.fakeDispatch = this.fakeDispatch.bind(this);
        this.state = this.getStateFromProps(props);
    }

    componentWillReceiveProps(props: TemplateEditorProps) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
        }
    }

    getStateFromProps(props: TemplateEditorProps): TemplateEditorState {
        const appProperties = TemplateEditor.calculateAppProperties(castTemplateAppProperties(this.props.metadata.appProperties), this.state ? this.state.appProperties : {});
        return {
            cameraLookAt: new THREE.Vector3(0.5, 0, 0.5),
            cameraPosition: new THREE.Vector3(0.5, 4, 5.5),
            showColourPicker: false,
            adjustPosition: false,
            ...this.state,
            appProperties,
            scenario: {
                snapToGrid: false,
                confirmMoves: false,
                lastActionId: '',
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
                        prone: false,
                        flat: false,
                        ...(this.state && this.state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE]),
                        metadata: {...props.metadata, appProperties: {...appProperties}}
                    },
                    referenceMini: {
                        name: '',
                        position: {x: 0.5, y: 0, z: 0.5},
                        rotation: {x: 0, y: 0, z: 0, order: 'XYZ'},
                        scale: 1,
                        elevation: 0,
                        gmOnly: true,
                        selectedBy: null,
                        prone: false,
                        flat: false,
                        metadata: {
                            ...props.metadata,
                            appProperties: {
                                width: 1,
                                height: 1,
                                aspectRatio: 1,
                                topDownX: 0,
                                topDownY: 0,
                                topDownRadius: 1,
                                standeeX: 0,
                                standeeY: 0,
                                standeeRangeX: 1,
                                standeeRangeY: 1
                            }
                        }
                    }
                }
            }
        };
    }

    updateTemplateAppProperties(appPropertiesUpdate: Partial<TemplateAppProperties>) {
        this.setState((state) => {
            const appProperties = {...state.appProperties, ...appPropertiesUpdate};
            return {
                appProperties,
                scenario: {
                    ...state.scenario,
                    minis: {
                        ...state.scenario.minis,
                        [TemplateEditor.PREVIEW_TEMPLATE]: {
                            ...state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE],
                            metadata: {
                                ...state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE].metadata,
                                appProperties
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

    getSaveMetadata(): Partial<DriveMetadata<TemplateAppProperties>> {
        // If the template's position or elevation has been adjusted, incorporate them into the appProperties.
        return {appProperties: this.state.appProperties};
    }

    setCameraParameters(cameraParameters: Partial<VirtualGamingTabletopCameraState>) {
        this.setState({
            cameraPosition: cameraParameters.cameraPosition || this.state.cameraPosition,
            cameraLookAt: cameraParameters.cameraLookAt || this.state.cameraLookAt
        });
    }

    fakeDispatch(action: AnyAction | ThunkAction<any, any, any>) {
        if (typeof(action) === 'function') {
            action(this.fakeDispatch, () => ({scenario: this.state.scenario}), undefined);
        } else if (action.type === ScenarioReducerActionTypes.UPDATE_MINI_ACTION && action.miniId === TemplateEditor.PREVIEW_TEMPLATE) {
            if (action.mini.position || action.mini.elevation || action.mini.rotation) {
                if (!action.mini.selectedBy && action.mini.position) {
                    const cos = Math.cos(this.state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE].rotation.y);
                    const sin = Math.sin(this.state.scenario.minis[TemplateEditor.PREVIEW_TEMPLATE].rotation.y);
                    const x = action.mini.position.x - 0.5;
                    const z = action.mini.position.z - 0.5;
                    this.updateTemplateAppProperties({
                        offsetX: this.state.appProperties.offsetX + cos * x - sin * z,
                        offsetZ: this.state.appProperties.offsetZ + sin * x + cos * z
                    });
                    this.updateTemplateObject({position: {x: 0.5, y: 0, z: 0.5}, selectedBy: null});
                } else if (!action.mini.selectedBy && action.mini.elevation !== undefined) {
                    this.updateTemplateAppProperties({offsetY: action.mini.elevation + this.state.appProperties.offsetY});
                    this.updateTemplateObject({elevation: 0, selectedBy: null});
                } else {
                    this.updateTemplateObject(action.mini);
                }
            }
        }
    }

    renderSelect<E>(enumObject: E, labels: {[key in keyof E]: string}, field: string, defaultValue: keyof E) {
        return (
            <Select
                options={Object.keys(enumObject).map((key) => ({label: labels[key], value: enumObject[key]}))}
                value={this.state.appProperties[field] || defaultValue}
                clearable={false}
                onChange={(selection) => {
                    if (selection && !Array.isArray(selection) && selection.value) {
                        this.updateTemplateAppProperties({[field]: selection.value});
                    }
                }}
            />
        );
    }

    renderShapeControls() {
        switch (this.state.appProperties.templateShape) {
            case TemplateShape.RECTANGLE:
                return [(
                    <div key='rectangleWidth'>
                        <span>Width</span>
                        <InputField type='number' initialValue={this.state.appProperties.width} onChange={(width: number) => {
                            this.updateTemplateAppProperties({width});
                        }} minValue={0} updateOnChange={true}/>
                    </div>
                ), (
                    <div key='rectangleDepth'>
                        <span>Depth</span>
                        <InputField type='number' initialValue={this.state.appProperties.depth} onChange={(depth: number) => {
                            this.updateTemplateAppProperties({depth});
                        }} minValue={0} updateOnChange={true}/>
                    </div>
                )];
            case TemplateShape.CIRCLE:
                return (
                    <div key='circleRadius'>
                        <span>Radius</span>
                        <InputField type='number' initialValue={this.state.appProperties.width} onChange={(width: number) => {
                            this.updateTemplateAppProperties({width});
                        }} minValue={0.1} updateOnChange={true}/>
                    </div>
                );
            case TemplateShape.ARC:
                return [(
                    <div key='arcLength'>
                        <span>Length</span>
                        <InputField type='number' initialValue={this.state.appProperties.width} onChange={(width: number) => {
                            this.updateTemplateAppProperties({width});
                        }} minValue={0.1} updateOnChange={true}/>
                    </div>
                ), (
                    <div key='arcAngle'>
                        <span>Angle</span>
                        <InputField type='number' initialValue={this.state.appProperties.angle || 60} onChange={(angle: number) => {
                            this.updateTemplateAppProperties({angle});
                        }} minValue={1} maxValue={359} updateOnChange={true}/>
                        <InputField type='range' initialValue={this.state.appProperties.angle || 60} onChange={(angle: number) => {
                            this.updateTemplateAppProperties({angle});
                        }} minValue={1} maxValue={359} step={1}/>
                    </div>
                )];
        }
    }

    renderTemplateEditor() {
        const colourObj = {
            r: (this.state.appProperties.colour >> 16) & 0xff,
            g: (this.state.appProperties.colour >> 8) & 0xff,
            b: this.state.appProperties.colour & 0xff,
            a: this.state.appProperties.opacity
        };
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
                                    <div style={{backgroundColor: `#${('000000' + this.state.appProperties.colour.toString(16)).slice(-6)}`}}/>
                                </div>
                                {
                                    this.state.showColourPicker ? (
                                        <OnClickOutsideWrapper onClickOutside={() => {this.setState({showColourPicker: false})}}>
                                            <ChromePicker color={colourObj} onChangeComplete={(colourObj) => {
                                                const colour = (colourObj.rgb.r << 16) + (colourObj.rgb.g << 8) + colourObj.rgb.b;
                                                const opacity = colourObj.rgb.a;
                                                this.updateTemplateAppProperties({colour, opacity});
                                            }}/>
                                        </OnClickOutsideWrapper>
                                    ) : null
                                }
                            </div>
                        </div>
                        <div>
                            <span>Height</span>
                            <InputField type='number' initialValue={this.state.appProperties.height} onChange={(height: number) => {
                                this.updateTemplateAppProperties({height});
                            }} minValue={0} updateOnChange={true}/>
                        </div>
                        {this.renderShapeControls()}
                        <div>
                            <InputButton selected={this.state.adjustPosition} onChange={() => {
                                this.setState({adjustPosition: !this.state.adjustPosition});
                            }} text='Adjust Position'/>
                        </div>
                    </fieldset>
                </div>
                <div className='previewPanel'>
                    <TabletopViewComponent
                        scenario={this.state.scenario}
                        tabletop={{gm: ''} as TabletopType}
                        fullDriveMetadata={{}}
                        dispatch={this.fakeDispatch}
                        cameraPosition={this.state.cameraPosition}
                        cameraLookAt={this.state.cameraLookAt}
                        setCamera={this.setCameraParameters}
                        focusMapId={undefined}
                        setFocusMapId={() => {}}
                        readOnly={!this.state.adjustPosition}
                        transparentFog={false}
                        fogOfWarMode={false}
                        endFogOfWarMode={() => {}}
                        snapToGrid={false}
                        userIsGM={true}
                        playerView={!this.state.adjustPosition}
                        labelSize={0.4}
                        findPositionForNewMini={() => ({x: 0, y: 0, z: 0})}
                        findUnusedMiniName={() => (['', 0])}
                        myPeerId='templateEditor'
                        disableTapMenu={true}
                    />
                </div>
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

export default TemplateEditor;