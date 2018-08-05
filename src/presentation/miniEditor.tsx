import * as React from 'react';
import * as PropTypes from 'prop-types';
import {clamp} from 'lodash';
import * as THREE from 'three';

import {FileAPI} from '../util/fileUtils';
import RenameFileEditor from './renameFileEditor';
import DriveTextureLoader from '../util/driveTextureLoader';
import {DriveMetadata, MiniAppProperties} from '../util/googleDriveUtils';
import {isSizedEvent} from '../util/types';
import GestureControls, {ObjectVector2} from '../container/gestureControls';
import TabletopViewComponent from './tabletopViewComponent';
import TabletopMiniComponent from './tabletopMiniComponent';
import {VirtualGamingTabletopCameraState} from './virtualGamingTabletop';
import SizeAwareContainer from '../container/sizeAwareContainer';
import {ScenarioType, TabletopType} from '../util/scenarioUtils';
import * as constants from '../util/constants';

import './miniEditor.css';

interface MiniEditorProps {
    metadata: DriveMetadata<MiniAppProperties>;
    onClose: () => {};
    textureLoader: DriveTextureLoader;
    fileAPI: FileAPI;
}

interface MiniEditorState extends VirtualGamingTabletopCameraState {
    appProperties: MiniAppProperties;
    textureUrl?: string;
    loadError?: string;
    movingFrame: boolean;
    editImagePanelWidth: number;
    editImagePanelHeight: number;
    scenario: ScenarioType;
}

class MiniEditor extends React.Component<MiniEditorProps, MiniEditorState> {

    static DIR_DOWN = new THREE.Vector3(0, -1, 0);

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired
    };

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
            ...previous,
            ...update
        };
        if (update.width && update.height) {
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
        this.setCameraParameters = this.setCameraParameters.bind(this);
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
        const appProperties = MiniEditor.calculateAppProperties(props.metadata.appProperties, this.state ? this.state.appProperties : {});
        return {
            textureUrl: undefined,
            loadError: undefined,
            movingFrame: false,
            cameraLookAt: new THREE.Vector3(0.5, 0, 0.5),
            cameraPosition: new THREE.Vector3(0.5, 2, 3.5),
            editImagePanelWidth: 0,
            editImagePanelHeight: 0,
            ...this.state,
            appProperties,
            scenario: {
                snapToGrid: true,
                confirmMoves: false,
                lastActionId: '',
                maps: {},
                minis: {
                    previewMini: {
                        metadata: {...props.metadata, appProperties},
                        name: '',
                        position: {x: 0.5, y: 0, z: 0.5},
                        rotation: {x: 0, y: 0, z: 0, order: 'XYZ'},
                        scale: 1,
                        elevation: 0,
                        gmOnly: false,
                        selectedBy: null,
                        prone: false,
                        flat: false
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
                        }
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
            if (this.isTopDown()) {
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
        if (this.isTopDown()) {
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

    setCameraParameters(cameraParameters: Partial<VirtualGamingTabletopCameraState>) {
        this.setState({
            cameraPosition: cameraParameters.cameraPosition || this.state.cameraPosition,
            cameraLookAt: cameraParameters.cameraLookAt || this.state.cameraLookAt
        });
    }

    private getImageScale() {
        return Math.min(1, (this.state.editImagePanelWidth && this.state.editImagePanelHeight && this.state.appProperties.width && this.state.appProperties.height) ?
            0.75 * Math.min(
            this.state.editImagePanelWidth / this.state.appProperties.width / TabletopMiniComponent.MINI_WIDTH,
            this.state.editImagePanelHeight / this.state.appProperties.height / TabletopMiniComponent.MINI_HEIGHT
            ) : 1);
    }

    private isTopDown() {
        const offset = this.state.cameraLookAt.clone().sub(this.state.cameraPosition).normalize();
        return (offset.dot(MiniEditor.DIR_DOWN) > constants.TOPDOWN_DOT_PRODUCT);
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

    renderMiniEditor(textureUrl: string) {
        return (
            <div className='editorPanels'>
                <SizeAwareContainer onSizeChanged={(editImagePanelWidth, editImagePanelHeight) => {
                    this.setState({editImagePanelWidth, editImagePanelHeight});
                }}>
                    <GestureControls
                        className='editImagePanel'
                        onPan={this.onPan}
                        onZoom={this.onZoom}
                        onGestureEnd={this.onGestureEnd}
                    >
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
                            {this.isTopDown() ? this.renderTopDownFrame() : this.renderStandeeFrame()}
                        </div>
                    </GestureControls>
                </SizeAwareContainer>
                <div className='previewPanel'>
                    <TabletopViewComponent
                        scenario={this.state.scenario}
                        tabletop={{gm: ''} as TabletopType}
                        fullDriveMetadata={{}}
                        dispatch={() => {}}
                        cameraPosition={this.state.cameraPosition}
                        cameraLookAt={this.state.cameraLookAt}
                        setCamera={this.setCameraParameters}
                        focusMapId={undefined}
                        setFocusMapId={() => {}}
                        readOnly={true}
                        transparentFog={false}
                        fogOfWarMode={false}
                        endFogOfWarMode={() => {}}
                        snapToGrid={false}
                        userIsGM={false}
                        playerView={false}
                        labelSize={0.4}
                        findPositionForNewMini={() => ({x: 0, y: 0, z: 0})}
                        findUnusedMiniName={() => (['', 0])}
                        myPeerId=''
                    />
                </div>
            </div>
        );
    }

    render() {
        return (
            <RenameFileEditor
                className='miniEditor'
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.getSaveMetadata}
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