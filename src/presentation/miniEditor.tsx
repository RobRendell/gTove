import {Component} from 'react';
import * as PropTypes from 'prop-types';
import {clamp} from 'lodash';
import * as THREE from 'three';
import ReactDropdown from 'react-dropdown-now';

import './miniEditor.scss';

import RenameFileEditor from './renameFileEditor';
import DriveTextureLoader from '../util/storage/providers/google/driveTextureLoader';
import {
    FileMetadata,
    MiniProperties,
    PieceVisibilityEnum
} from '../util/storage/storageContract';
import { isSizedEvent } from '../util/types';
import { isSupportedVideoMimeType } from '../util/storage/storageUtils';
import GestureControls from '../container/gestureControls';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import {MINI_CORNER_RADIUS_PERCENT} from './tabletopMiniComponent';
import ReactResizeDetector from 'react-resize-detector';
import {
    calculateMiniProperties,
    getColourHex,
    getColourHexString,
    GRID_COLOUR,
    ObjectVector2,
    ScenarioType
} from '../util/scenarioUtils';
import InputButton from './inputButton';
import InputField from './inputField';
import ColourPicker from './colourPicker';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {MINI_HEIGHT, MINI_WIDTH} from '../util/constants';
import VisibilitySlider from './visibilitySlider';

interface MiniEditorProps {
    metadata: FileMetadata<void, MiniProperties>;
    onClose: () => void;
    textureLoader: DriveTextureLoader;
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

class MiniEditor extends Component<MiniEditorProps, MiniEditorState> {

    static CAMERA_POSITION_ISOMETRIC = new THREE.Vector3(0, 2, 3);
    static CAMERA_POSITION_TOP_DOWN = new THREE.Vector3(0, 4, 0);
    static CAMERA_LOOK_AT = new THREE.Vector3(0, 0, 0);

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired
    };

    static DEFAULT_SCALE_OTHER = 'other';

    static DEFAULT_SCALE_OPTIONS = [
        {label: '¼', value: '0.25'}, {label: '½', value: '0.5'}, {label: '1', value: '1'}, {label: '2', value: '2'},
        {label: '3', value: '3'}, {label: 'Other', value: MiniEditor.DEFAULT_SCALE_OTHER}
    ];

    static contextTypes = {
        promiseModal: PropTypes.func
    };

    context: PromiseModalContext;

    constructor(props: MiniEditorProps) {
        super(props);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.onResize = this.onResize.bind(this);
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
        const properties = calculateMiniProperties(props.metadata.properties!, this.state?.properties);
        const selectedOption = this.getSelectedOption(properties.scale, false);
        const showOtherScale = selectedOption.value === MiniEditor.DEFAULT_SCALE_OTHER;
        return {
            textureUrl: undefined,
            loadError: undefined,
            movingFrame: false,
            isTopDown: false,
            cameraPosition: MiniEditor.CAMERA_POSITION_ISOMETRIC,
            editImagePanelWidth: 0,
            editImagePanelHeight: 0,
            showOtherScale,
            ...this.state as Partial<MiniEditorState>,
            properties,
            scenario: {
                updateSideEffect: false,
                snapToGrid: true,
                confirmMoves: false,
                headActionId: null,
                playerHeadActionId: null,
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
                        hideBase: false,
                        piecesRosterValues: {},
                        piecesRosterGMValues: {},
                        piecesRosterSimple: true
                    }
                }
            }
        };
    }

    setProperties(properties: MiniProperties) {
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
                this.setProperties(calculateMiniProperties(this.state.properties, {
                    topDownX: Number(this.state.properties.topDownX) + delta.x / size,
                    topDownY: Number(this.state.properties.topDownY) - delta.y / size
                }));
            } else {
                this.setProperties(calculateMiniProperties(this.state.properties, {
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
            this.setProperties(calculateMiniProperties(this.state.properties, {
                topDownRadius: clamp(Number(this.state.properties.topDownRadius) - delta.y / size, 0.2, maxRadius)
            }));
        } else {
            const beforeAspect = Number(this.state.properties.standeeRangeX) / Number(this.state.properties.standeeRangeY);
            const standeeRangeX = clamp(Number(this.state.properties.standeeRangeX) + delta.y / size, 0.2, 3);
            const standeeRangeY = standeeRangeX / beforeAspect;
            this.setProperties(calculateMiniProperties(this.state.properties, {
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

    getSaveMetadata(): Partial<FileMetadata> {
        return {properties: calculateMiniProperties(this.state.properties)};
    }

    private getImageScale() {
        return Math.min(1, (this.state.editImagePanelWidth && this.state.editImagePanelHeight && this.state.properties.width && this.state.properties.height) ?
            0.75 * Math.min(
            this.state.editImagePanelWidth / this.state.properties.width / MINI_WIDTH,
            this.state.editImagePanelHeight / this.state.properties.height / MINI_HEIGHT
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
        const frameHeight = imageHeight * MINI_HEIGHT / Number(this.state.properties.standeeRangeY);
        const frameLeft = (imageWidth * Number(this.state.properties.standeeX)) - frameWidth / 2;
        const frameBottom = imageHeight * Number(this.state.properties.standeeY);
        const borderRadius = MINI_CORNER_RADIUS_PERCENT + '% ' + MINI_CORNER_RADIUS_PERCENT + '% 0 0';
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

    onTextureLoad(width: number, height: number) {
        this.setProperties(calculateMiniProperties(this.state.properties, {width, height}));
    }

    private onResize(editImagePanelWidth?: number, editImagePanelHeight?: number) {
        if (editImagePanelWidth !== undefined && editImagePanelHeight !== undefined) {
            this.setState({editImagePanelWidth, editImagePanelHeight});
        }
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
                    <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={this.onResize}/>
                    <div className='miniImageDiv' style={{transform: `translate(-50%, -50%) scale(${this.getImageScale()})`}}>
                        {
                            isSupportedVideoMimeType(this.props.metadata.mimeType) ? (
                                <video loop={true} autoPlay={true} src={textureUrl} onLoadedMetadata={(evt: React.SyntheticEvent<HTMLVideoElement>) => {
                                    this.onTextureLoad(evt.currentTarget.videoWidth, evt.currentTarget.videoHeight);
                                }}>
                                    Your browser doesn't support embedded videos.
                                </video>
                            ) : (
                                <img src={textureUrl} alt='mini' onLoad={(evt) => {
                                    window.URL.revokeObjectURL(textureUrl);
                                    if (isSizedEvent(evt)) {
                                        this.onTextureLoad(evt.target.width, evt.target.height);
                                    }
                                }}/>
                            )
                        }
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

    private getSelectedOption(scale: number, forceOther: boolean) {
        const scaleString = scale.toString();
        const option = MiniEditor.DEFAULT_SCALE_OPTIONS.find((option) => (option.value === scaleString));
        return (!option || forceOther) ? MiniEditor.DEFAULT_SCALE_OPTIONS[MiniEditor.DEFAULT_SCALE_OPTIONS.length - 1] : option;
    }

    render() {
        const selectedOption = this.getSelectedOption(this.state.properties.scale, this.state.showOtherScale);
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
                        if (this.context.promiseModal?.isAvailable()) {
                            let colour = this.state.properties.colour;
                            const okOption = 'OK';
                            const defaultOption = 'Use Top Left Pixel';
                            const result = await this.context.promiseModal({
                                children: (
                                    <div>
                                        <p>Set background colour</p>
                                        <ColourPicker
                                            disableAlpha={true}
                                            initialColour={getColourHex((colour || GRID_COLOUR.white) as GRID_COLOUR)}
                                            onColourChange={(colourObj) => {
                                                colour = colourObj.hex;
                                            }}
                                        />
                                    </div>
                                ),
                                options: [okOption, defaultOption, 'Cancel']
                            });
                            if (result === okOption) {
                                this.setProperties({
                                    ...this.state.properties,
                                    colour: getColourHexString(colour || 0)
                                });
                            } else if (result === defaultOption) {
                                this.setProperties({...this.state.properties, colour: undefined});
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
                        <ReactDropdown
                            className='scaleSelect'
                            placeholder=''
                            options={MiniEditor.DEFAULT_SCALE_OPTIONS}
                            value={selectedOption}
                            onChange={(selection) => {
                                if (selection.value === MiniEditor.DEFAULT_SCALE_OTHER) {
                                    this.setState({showOtherScale: true});
                                } else {
                                    this.setProperties(calculateMiniProperties(this.state.properties, {scale: +selection.value}));
                                }
                            }}
                        />
                        {
                            (selectedOption.value !== MiniEditor.DEFAULT_SCALE_OTHER && !this.state.showOtherScale) ? null : (
                                <InputField type='number' className='otherScale' updateOnChange={true}
                                            initialValue={this.state.properties.scale}
                                            onChange={(scale: number) => {
                                                this.setProperties(calculateMiniProperties(this.state.properties, {scale}));
                                            }}
                                            onBlur={(scale: number) => {
                                                this.setState({showOtherScale: false});
                                                if (scale < 0.1) {
                                                    this.setProperties(calculateMiniProperties(this.state.properties, {scale: 0.1}));
                                                }
                                            }}
                                />
                            )
                        }
                    </div>,
                    <div className='defaultVisibility' key='defaultVisibility'>
                        <span>Default visibility:&nbsp;</span>
                        <VisibilitySlider visibility={this.state.properties.defaultVisibility || PieceVisibilityEnum.FOGGED} onChange={(value) => {
                            this.setProperties(calculateMiniProperties(this.state.properties, {defaultVisibility: value}));
                        }} />
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