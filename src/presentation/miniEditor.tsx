import * as React from 'react';
import * as PropTypes from 'prop-types';
import {clamp} from 'lodash';
import * as THREE from 'three';
import Select from 'react-select';

import {FileAPI} from '../util/fileUtils';
import RenameFileEditor from './renameFileEditor';
import DriveTextureLoader from '../util/driveTextureLoader';
import {castMiniAppProperties, DriveMetadata, MiniAppProperties} from '../util/googleDriveUtils';
import {isSizedEvent} from '../util/types';
import GestureControls, {ObjectVector2} from '../container/gestureControls';
import TabletopPreviewComponent from './tabletopPreviewComponent';
import TabletopMiniComponent from './tabletopMiniComponent';
import ReactResizeDetector from 'react-resize-detector';
import {ScenarioType} from '../util/scenarioUtils';
import InputButton from './inputButton';
import InputField from './inputField';

import './miniEditor.css';

interface MiniEditorProps {
    metadata: DriveMetadata<MiniAppProperties>;
    onClose: () => {};
    textureLoader: DriveTextureLoader;
    fileAPI: FileAPI;
}

interface MiniEditorState {
    appProperties: MiniAppProperties;
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


    static calculateAppProperties(previous: MiniAppProperties, update: Partial<MiniAppProperties> = {}): MiniAppProperties {
        const combined = {
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

    componentWillReceiveProps(props: MiniEditorProps) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
            this.loadTexture();
        }
    }

    getStateFromProps(props: MiniEditorProps): MiniEditorState {
        const appProperties = MiniEditor.calculateAppProperties(castMiniAppProperties(props.metadata.appProperties), this.state ? this.state.appProperties : {});
        const defaultScaleIndex = this.getDefaultScaleIndex(appProperties.scale, false);
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
            appProperties,
            scenario: {
                snapToGrid: true,
                confirmMoves: false,
                headActionIds: [],
                playerHeadActionIds: [],
                maps: {},
                minis: {
                    previewMini: {
                        metadata: {...props.metadata, appProperties},
                        name: '',
                        position: {x: 0, y: 0, z: 0},
                        rotation: {x: 0, y: 0, z: 0, order: 'XYZ'},
                        scale: appProperties.scale || 1,
                        elevation: 0,
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

    setAppProperties(appProperties: MiniAppProperties) {
        this.setState({
            appProperties,
            scenario: {
                ...this.state.scenario,
                minis: {
                    previewMini: {
                        ...this.state.scenario.minis.previewMini,
                        metadata: {
                            ...this.state.scenario.minis.previewMini.metadata,
                            appProperties
                        },
                        scale: appProperties.scale || 1
                    }
                }
            }
        })
    }

    getMaxDimension() {
        return Math.max(Number(this.state.appProperties.height), Number(this.state.appProperties.width));
    }

    onPan(delta: ObjectVector2) {
        if (this.state.movingFrame) {
            const size = this.getMaxDimension();
            if (this.state.isTopDown) {
                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {
                    topDownX: Number(this.state.appProperties.topDownX) + delta.x / size,
                    topDownY: Number(this.state.appProperties.topDownY) - delta.y / size
                }));
            } else {
                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {
                    standeeX: Number(this.state.appProperties.standeeX) + delta.x / size,
                    standeeY: Number(this.state.appProperties.standeeY) - delta.y / size
                }));
            }
        }
    }

    onZoom(delta: ObjectVector2) {
        const size = this.getMaxDimension();
        const aspectRatio = Number(this.state.appProperties.aspectRatio);
        if (this.state.isTopDown) {
            const maxRadius = ((aspectRatio < 1) ? 1 / aspectRatio : aspectRatio) * 0.6;
            this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {
                topDownRadius: clamp(Number(this.state.appProperties.topDownRadius) - delta.y / size, 0.2, maxRadius)
            }));
        } else {
            const beforeAspect = Number(this.state.appProperties.standeeRangeX) / Number(this.state.appProperties.standeeRangeY);
            const standeeRangeX = clamp(Number(this.state.appProperties.standeeRangeX) + delta.y / size, 0.2, 3);
            const standeeRangeY = standeeRangeX / beforeAspect;
            this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {
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
        return {appProperties: this.state.appProperties};
    }

    private getImageScale() {
        return Math.min(1, (this.state.editImagePanelWidth && this.state.editImagePanelHeight && this.state.appProperties.width && this.state.appProperties.height) ?
            0.75 * Math.min(
            this.state.editImagePanelWidth / this.state.appProperties.width / TabletopMiniComponent.MINI_WIDTH,
            this.state.editImagePanelHeight / this.state.appProperties.height / TabletopMiniComponent.MINI_HEIGHT
            ) : 1);
    }

    renderTopDownFrame() {
        const size = this.getMaxDimension();
        const radius = size * Number(this.state.appProperties.topDownRadius);
        const topDownLeft = size * Number(this.state.appProperties.topDownX) - radius;
        const topDownBottom = size * Number(this.state.appProperties.topDownY) - radius;
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
        const imageWidth = Number(this.state.appProperties.width);
        const imageHeight = Number(this.state.appProperties.height);
        if (!imageWidth || !imageHeight) {
            return null;
        }
        const frameWidth = imageWidth / Number(this.state.appProperties.standeeRangeX);
        const frameHeight = imageHeight * TabletopMiniComponent.MINI_HEIGHT / Number(this.state.appProperties.standeeRangeY);
        const frameLeft = (imageWidth * Number(this.state.appProperties.standeeX)) - frameWidth / 2;
        const frameBottom = imageHeight * Number(this.state.appProperties.standeeY);
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
        const zoom = this.state.appProperties.scale < 1 ? 1 : this.state.appProperties.scale;
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
                                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {
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
                    topDownChanged={(isTopDown) => {this.setState({isTopDown})}}
                />
            </div>
        );
    }

    private getDefaultScaleIndex(scale: number, forceOther: boolean) {
        const defaultScaleIndex = MiniEditor.DEFAULT_SCALE_OPTIONS.findIndex((option) => (option.value === scale));
        return (defaultScaleIndex < 0 || forceOther) ? MiniEditor.DEFAULT_SCALE_OPTIONS.length - 1 : defaultScaleIndex;
    }

    render() {
        const defaultScaleIndex = this.getDefaultScaleIndex(this.state.appProperties.scale, this.state.showOtherScale);
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
                    <div className='defaultScale' key='defaultScale'>
                        <span>Default scale:&nbsp;</span>
                        <Select
                            placeholder=''
                            options={MiniEditor.DEFAULT_SCALE_OPTIONS}
                            value={MiniEditor.DEFAULT_SCALE_OPTIONS[defaultScaleIndex]}
                            clearable={false}
                            onChange={(selection) => {
                                if (selection && !Array.isArray(selection) && selection.value) {
                                    if (selection.value === MiniEditor.DEFAULT_SCALE_OTHER) {
                                        this.setState({showOtherScale: true});
                                    } else {
                                        this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {scale: selection.value}));
                                    }
                                }
                            }}
                        />
                        {
                            (MiniEditor.DEFAULT_SCALE_OPTIONS[defaultScaleIndex].value !== MiniEditor.DEFAULT_SCALE_OTHER && !this.state.showOtherScale) ? null : (
                                <InputField type='number' className='otherScale' updateOnChange={true}
                                            initialValue={this.state.appProperties.scale}
                                            onChange={(scale: number) => {
                                                this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {scale}));
                                            }}
                                            onBlur={(scale: number) => {
                                                this.setState({showOtherScale: false});
                                                if (scale < 0.1) {
                                                    this.setAppProperties(MiniEditor.calculateAppProperties(this.state.appProperties, {scale: 0.1}));
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