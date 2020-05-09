import * as React from 'react';
import * as PropTypes from 'prop-types';
import {clamp} from 'lodash';
import * as THREE from 'three';
import Select, {Option} from 'react-select';

import {FileAPI} from '../util/fileUtils';
import RenameFileEditor from './renameFileEditor';
import DriveTextureLoader from '../util/driveTextureLoader';
import {castMiniProperties, DriveMetadata, MiniProperties} from '../util/googleDriveUtils';
import {isSizedEvent} from '../util/types';
import GestureControls, {ObjectVector2} from '../container/gestureControls';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import TabletopMiniComponent from './tabletopMiniComponent';
import ReactResizeDetector from 'react-resize-detector';
import {getColourHex, PieceVisibilityEnum, ScenarioType} from '../util/scenarioUtils';
import InputButton from './inputButton';
import InputField from './inputField';
import ColourPicker from './ColourPicker';
import {PromiseModalContext} from '../container/authenticatedContainer';
import {FOLDER_MINI} from '../util/constants';

import './miniEditor.scss';

interface MiniEditorProps {
    metadata: DriveMetadata<void, MiniProperties>;
    onClose: () => {};
    textureLoader: DriveTextureLoader;
    fileAPI: FileAPI;
}

interface MiniEditorState {
    properties: MiniProperties;
    textureUrl?: string;
    loadError?: string;
    movingFrame: boolean;
    editImagePanelWidth: number;
    editImagePanelHeight: number;
    scenario: ScenarioType;
    isTopDown: boolean;
    cameraPosition: THREE.Vector3;
    showOtherScale: boolean;
}

class MiniEditor extends React.Component<MiniEditorProps, MiniEditorState> {

    static CAMERA_POSITION_ISOMETRIC = new THREE.Vector3(0, 2, 3);
    static CAMERA_POSITION_TOP_DOWN = new THREE.Vector3(0, 4, 0);
    static CAMERA_LOOK_AT = new THREE.Vector3(0, 0, 0);

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired
    };

    static DEFAULT_SCALE_OTHER = -1;

    static DEFAULT_SCALE_OPTIONS = [
        {label: '¼', value: 0.25}, {label: '½', value: 0.5}, {label: '1', value: 1}, {label: '2', value: 2},
        {label: '3', value: 3}, {label: 'Other', value: MiniEditor.DEFAULT_SCALE_OTHER}
    ];

    static contextTypes = {
        promiseModal: PropTypes.func
    };

    context: PromiseModalContext;

    static calculateAppProperties(previous: MiniProperties, update: Partial<MiniProperties> = {}): MiniProperties {
        const combined = {
            rootFolder: FOLDER_MINI,
            topDownX: 0.5,
            topDownY: 0.5,
            topDownRadius: 0.5,
            aspectRatio: 1,
            standeeRangeX: TabletopMiniComponent.MINI_HEIGHT,
            standeeRangeY: TabletopMiniComponent.MINI_HEIGHT,
            standeeX: 0.5,
            standeeY: 0,
            scale: 1,
            ...previous,
            ...update
        };
        if (update.width && update.height && (Number(update.width) !== Number(previous.width) || Number(update.height) !== Number(previous.height))) {
            const aspectRatio = Number(combined.width) / Number(combined.height);
            const topDownX = (aspectRatio > 1) ? 0.5 : aspectRatio / 2;
            const topDownY = (aspectRatio > 1) ? 0.5 / aspectRatio : 0.5;
            const standeeRangeX = (aspectRatio > TabletopMiniComponent.MINI_ASPECT_RATIO ? TabletopMiniComponent.MINI_WIDTH : TabletopMiniComponent.MINI_HEIGHT * aspectRatio);
            const standeeRangeY = (aspectRatio > TabletopMiniComponent.MINI_ASPECT_RATIO ? TabletopMiniComponent.MINI_WIDTH / aspectRatio : TabletopMiniComponent.MINI_HEIGHT);
            const standeeX = 0.5;
            const standeeY = (1 - TabletopMiniComponent.MINI_HEIGHT / standeeRangeY) / 2;
            return {
                ...combined,
                topDownX,
                topDownY,
                aspectRatio,
                standeeRangeX,
                standeeRangeY,
                standeeX,
                standeeY
            };
        } else {
            return combined;
        }
    }

    constructor(props: MiniEditorProps) {
        super(props);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.state = this.getStateFromProps(props);
        this.loadTexture();
    }

    UNSAFE_componentWillReceiveProps(props: MiniEditorProps) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
            this.loadTexture();
        }
    }

    getStateFromProps(props: MiniEditorProps): MiniEditorState {
        const properties = MiniEditor.calculateAppProperties(castMiniProperties(props.metadata.properties), this.state ? this.state.properties : {});
        const defaultScaleIndex = this.getDefaultScaleIndex(properties.scale, false);
        const showOtherScale = MiniEditor.DEFAULT_SCALE_OPTIONS[defaultScaleIndex].value === MiniEditor.DEFAULT_SCALE_OTHER;
        return {
            textureUrl: undefined,
            loadError: undefined,
            movingFrame: false,
            isTopDown: false,
            cameraPosition: MiniEditor.CAMERA_POSITION_ISOMETRIC,
            editImagePanelWidth: 0,
            editImagePanelHeight: 0,
            showOtherScale,
            ...this.state,
            properties,
            scenario: {
                snapToGrid: true,
                confirmMoves: false,
                headActionIds: [],
                playerHeadActionIds: [],
                maps: {},
                minis: {
                    previewMini: {
                        metadata: {...props.metadata, properties},
                        name: '',
                        position: {x: 0, y: 0, z: 0},
                        rotation: {x: 0, y: 0, z: 0, order: 'XYZ'},
                        scale: properties.scale || 1,
                        elevation: 0,
                        visibility: PieceVisibilityEnum.REVEALED,
                        gmOnly: false,
                        selectedBy: null,
                        locked: true,
                        prone: false,
                        flat: false,
                        hideBase: false
                    }
                }
            }
        };
    }

    setAppProperties(properties: MiniProperties) {
        this.setState({
            properties,
            scenario: {
                ...this.state.scenario,
                minis: {
                    previewMini: {
                        ...this.state.scenario.minis.previewMini,
                        metadata: {
                            ...this.state.scenario.minis.previewMini.metadata,
                            properties
                        },
                        scale: properties.scale || 1
                    }
                }
            }
        })
    }

    getMaxDimension() {
        return Math.max(Number(this.state.properties.height), Number(this.state.properties.width));
    }

    onPan(delta: ObjectVector2) {
        if (this.state.movingFrame) {
            const size = this.getMaxDimension();
            if (this.state.isTopDown) {
                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {
                    topDownX: Number(this.state.properties.topDownX) + delta.x / size,
                    topDownY: Number(this.state.properties.topDownY) - delta.y / size
                }));
            } else {
                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {
                    standeeX: Number(this.state.properties.standeeX) + delta.x / size,
                    standeeY: Number(this.state.properties.standeeY) - delta.y / size
                }));
            }
        }
    }

    onZoom(delta: ObjectVector2) {
        const size = this.getMaxDimension();
        const aspectRatio = Number(this.state.properties.aspectRatio);
        if (this.state.isTopDown) {
            const maxRadius = ((aspectRatio < 1) ? 1 / aspectRatio : aspectRatio);
            this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {
                topDownRadius: clamp(Number(this.state.properties.topDownRadius) - delta.y / size, 0.2, maxRadius)
            }));
        } else {
            const beforeAspect = Number(this.state.properties.standeeRangeX) / Number(this.state.properties.standeeRangeY);
            const standeeRangeX = clamp(Number(this.state.properties.standeeRangeX) + delta.y / size, 0.2, 3);
            const standeeRangeY = standeeRangeX / beforeAspect;
            this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {
                standeeRangeX, standeeRangeY
            }));
        }
    }

    onGestureEnd() {
        this.setState({movingFrame: false});
    }

    loadTexture() {
        this.props.textureLoader.loadImageBlob(this.props.metadata)
            .then((blob) => {
                this.setState({textureUrl: window.URL.createObjectURL(blob)});
            })
            .catch((error) => {
                this.setState({loadError: error});
            });
    }

    getSaveMetadata(): Partial<DriveMetadata> {
        return {properties: this.state.properties};
    }

    private getImageScale() {
        return Math.min(1, (this.state.editImagePanelWidth && this.state.editImagePanelHeight && this.state.properties.width && this.state.properties.height) ?
            0.75 * Math.min(
            this.state.editImagePanelWidth / this.state.properties.width / TabletopMiniComponent.MINI_WIDTH,
            this.state.editImagePanelHeight / this.state.properties.height / TabletopMiniComponent.MINI_HEIGHT
            ) : 1);
    }

    renderTopDownFrame() {
        const size = this.getMaxDimension();
        const radius = size * Number(this.state.properties.topDownRadius);
        const topDownLeft = size * Number(this.state.properties.topDownX) - radius;
        const topDownBottom = size * Number(this.state.properties.topDownY) - radius;
        return (
            <div
                className='topDownFrame'
                style={{width: 2 * radius, height: 2 * radius, left: topDownLeft, bottom: topDownBottom}}
                onMouseDown={() => {
                    this.setState({movingFrame: true})
                }}
                onTouchStart={() => {
                    this.setState({movingFrame: true})
                }}
            />
        );
    }

    renderStandeeFrame() {
        const imageWidth = Number(this.state.properties.width);
        const imageHeight = Number(this.state.properties.height);
        if (!imageWidth || !imageHeight) {
            return null;
        }
        const frameWidth = imageWidth / Number(this.state.properties.standeeRangeX);
        const frameHeight = imageHeight * TabletopMiniComponent.MINI_HEIGHT / Number(this.state.properties.standeeRangeY);
        const frameLeft = (imageWidth * Number(this.state.properties.standeeX)) - frameWidth / 2;
        const frameBottom = imageHeight * Number(this.state.properties.standeeY);
        const borderRadius = TabletopMiniComponent.MINI_CORNER_RADIUS_PERCENT + '% ' + TabletopMiniComponent.MINI_CORNER_RADIUS_PERCENT + '% 0 0';
        return (
            <div
                className='standeeFrame'
                style={{borderRadius, left: frameLeft, bottom: frameBottom, width: frameWidth, height: frameHeight}}
                onMouseDown={() => {
                    this.setState({movingFrame: true})
                }}
                onTouchStart={() => {
                    this.setState({movingFrame: true})
                }}
            />
        );
    }

    getCameraPosition() {
        const zoom = this.state.properties.scale < 1 ? 1 : this.state.properties.scale;
        return (zoom > 1) ? this.state.cameraPosition.clone().multiplyScalar(zoom) : this.state.cameraPosition;
    }

    renderMiniEditor(textureUrl: string) {
        return (
            <div className='editorPanels'>
                <GestureControls
                    className='editImagePanel'
                    onPan={this.onPan}
                    onZoom={this.onZoom}
                    onGestureEnd={this.onGestureEnd}
                >
                    <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={(editImagePanelWidth, editImagePanelHeight) => {
                        this.setState({editImagePanelWidth, editImagePanelHeight});
                    }}/>
                    <div className='miniImageDiv' style={{transform: `translate(-50%, -50%) scale(${this.getImageScale()})`}}>
                        <img src={textureUrl} alt='mini' onLoad={(evt) => {
                            window.URL.revokeObjectURL(textureUrl);
                            if (isSizedEvent(evt)) {
                                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {
                                    width: evt.target.width,
                                    height: evt.target.height
                                }));
                            }
                        }}/>
                        {this.state.isTopDown ? this.renderTopDownFrame() : this.renderStandeeFrame()}
                    </div>
                </GestureControls>
                <TabletopPreviewComponent
                    scenario={this.state.scenario}
                    cameraLookAt={MiniEditor.CAMERA_LOOK_AT}
                    cameraPosition={this.getCameraPosition()}
                    topDownChanged={(isTopDown: boolean) => {this.setState({isTopDown})}}
                />
            </div>
        );
    }

    private getDefaultScaleIndex(scale: number, forceOther: boolean) {
        const defaultScaleIndex = MiniEditor.DEFAULT_SCALE_OPTIONS.findIndex((option) => (option.value === scale));
        return (defaultScaleIndex < 0 || forceOther) ? MiniEditor.DEFAULT_SCALE_OPTIONS.length - 1 : defaultScaleIndex;
    }

    render() {
        const defaultScaleIndex = this.getDefaultScaleIndex(this.state.properties.scale, this.state.showOtherScale);
        return (
            <RenameFileEditor
                className='miniEditor'
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.getSaveMetadata}
                controls={[
                    <InputButton key='topDownButton' type='checkbox' selected={this.state.isTopDown} onChange={() => {
                        const isTopDown = !this.state.isTopDown;
                        this.setState({
                            isTopDown,
                            cameraPosition: isTopDown ? MiniEditor.CAMERA_POSITION_TOP_DOWN : MiniEditor.CAMERA_POSITION_ISOMETRIC
                        });
                    }}>
                        View mini top-down
                    </InputButton>,
                    <InputButton key='colourControls' type='button' onChange={async () => {
                        if (this.context.promiseModal && !this.context.promiseModal.isBusy()) {
                            let colour = this.state.properties.colour;
                            const okOption = 'OK';
                            const defaultOption = 'Use Top Left Pixel';
                            const result = await this.context.promiseModal({
                                children: (
                                    <div>
                                        <p>Set background colour</p>
                                        <ColourPicker
                                            disableAlpha={true}
                                            initialColour={getColourHex(colour || 'white')}
                                            onColourChange={(colourObj) => {
                                                colour = colourObj.hex;
                                            }}
                                        />
                                    </div>
                                ),
                                options: [okOption, defaultOption, 'Cancel']
                            });
                            if (result === okOption) {
                                this.setAppProperties({
                                    ...this.state.properties,
                                    colour: '#' + ('000000' + (colour || 0).toString(16)).slice(-6)
                                });
                            } else if (result === defaultOption) {
                                this.setAppProperties({...this.state.properties, colour: undefined});
                            }
                        }
                    }}>
                        Background:
                        {
                            this.state.properties.colour ? (
                                <span className='backgroundColourSwatch' style={{backgroundColor: this.state.properties.colour}}>&nbsp;</span>
                            ) : (
                                <span>(top left pixel)</span>
                            )
                        }
                    </InputButton>,
                    <div className='defaultScale' key='defaultScale'>
                        <span>Default scale:&nbsp;</span>
                        <Select
                            className='scaleSelect'
                            placeholder=''
                            options={MiniEditor.DEFAULT_SCALE_OPTIONS}
                            value={MiniEditor.DEFAULT_SCALE_OPTIONS[defaultScaleIndex]}
                            clearable={false}
                            onChange={(selection: Option<number> | null) => {
                                if (selection && selection.value) {
                                    if (selection.value === MiniEditor.DEFAULT_SCALE_OTHER) {
                                        this.setState({showOtherScale: true});
                                    } else {
                                        this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {scale: selection.value}));
                                    }
                                }
                            }}
                        />
                        {
                            (MiniEditor.DEFAULT_SCALE_OPTIONS[defaultScaleIndex].value !== MiniEditor.DEFAULT_SCALE_OTHER && !this.state.showOtherScale) ? null : (
                                <InputField type='number' className='otherScale' updateOnChange={true}
                                            initialValue={this.state.properties.scale}
                                            onChange={(scale: number) => {
                                                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {scale}));
                                            }}
                                            onBlur={(scale: number) => {
                                                this.setState({showOtherScale: false});
                                                if (scale < 0.1) {
                                                    this.setAppProperties(MiniEditor.calculateAppProperties(this.state.properties, {scale: 0.1}));
                                                }
                                            }}
                                />
                            )
                        }
                    </div>
                ]}
            >
                {
                    this.state.textureUrl ? (
                        this.renderMiniEditor(this.state.textureUrl)
                    ) : this.state.loadError ? (
                        <span>An error occurred while loading this file from Google Drive: {this.state.loadError}</span>
                    ) : (
                        <span>Loading...</span>
                    )
                }
            </RenameFileEditor>
        );
    }
}

export default MiniEditor;