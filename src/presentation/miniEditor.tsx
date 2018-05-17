import * as React from 'react';
import * as PropTypes from 'prop-types';
import {clamp} from 'lodash';

import {FileAPI} from '../util/fileUtils';
import RenameFileEditor from './renameFileEditor';
import DriveTextureLoader from '../util/driveTextureLoader';
import {DriveMetadata, MiniAppProperties} from '../@types/googleDrive';
import {isSizedEvent} from '../util/types';
import GestureControls, {ObjectVector2} from '../container/gestureControls';

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
}

class MiniEditor extends React.Component<MiniEditorProps, MiniEditorState> {

    static MINI_SCALE = 50;

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        onClose: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired
    };

    static calculateAppProperties(previous: MiniAppProperties, update: Partial<MiniAppProperties> = {}): MiniAppProperties {
        const combined = {...previous, ...update};
        const aspectRatio = (combined.width && combined.height) ? Number(combined.width) / Number(combined.height) : combined.aspectRatio;
        const topDownX = (combined.topDownX !== undefined || !aspectRatio) ? combined.topDownX : 0.5;
        const topDownY = (combined.topDownY !== undefined || !aspectRatio) ? combined.topDownY : 0.5;
        const topDownRadius = (combined.topDownRadius !== undefined) ? combined.topDownRadius : 0.5;
        return {aspectRatio, topDownX, topDownY, topDownRadius, ...combined};
    }

    constructor(props: MiniEditorProps) {
        super(props);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.getSaveMetadata = this.getSaveMetadata.bind(this);
        this.state = this.getStateFromProps(props);
        this.loadMapTexture();
    }

    componentWillReceiveProps(props: MiniEditorProps) {
        if (props.metadata.id !== this.props.metadata.id) {
            this.setState(this.getStateFromProps(props));
            this.loadMapTexture();
        }
    }

    getSize() {
        return Math.max(Number(this.state.appProperties.height), Number(this.state.appProperties.width)) * MiniEditor.MINI_SCALE;
    }

    onPan(delta: ObjectVector2) {
        if (this.state.movingFrame) {
            const size = this.getSize();
            this.setState({
                appProperties: MiniEditor.calculateAppProperties(this.state.appProperties, {
                    topDownX: Number(this.state.appProperties.topDownX) + delta.x / size,
                    topDownY: Number(this.state.appProperties.topDownY) - delta.y / size
                })
            });
        }
    }

    onZoom(delta: ObjectVector2) {
        const size = this.getSize();
        const aspectRatio = Number(this.state.appProperties.aspectRatio);
        const maxRadius = ((aspectRatio < 1) ? 1 / aspectRatio : aspectRatio) * 0.6;
        this.setState({
            appProperties: MiniEditor.calculateAppProperties(this.state.appProperties, {
                topDownRadius: clamp(Number(this.state.appProperties.topDownRadius) - delta.y / size, 0.2, maxRadius)
            })
        });
    }

    onGestureEnd() {
        this.setState({movingFrame: false});
    }

    getStateFromProps(props: MiniEditorProps): MiniEditorState {
        return {
            appProperties: MiniEditor.calculateAppProperties(props.metadata.appProperties, this.state ? this.state.appProperties : {}),
            textureUrl: undefined,
            loadError: undefined,
            movingFrame: (this.state && this.state.movingFrame)
        };
    }

    loadMapTexture() {
        this.props.textureLoader.loadImageBlob({id: this.props.metadata.id})
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

    renderMiniEditor(textureUrl: string) {
        const size = this.getSize();
        const radius = size * Number(this.state.appProperties.topDownRadius);
        const topDownLeft = size * Number(this.state.appProperties.topDownX) - radius;
        const topDownBottom = size * Number(this.state.appProperties.topDownY) - radius;
        return (
            <GestureControls
                className='editImagePanel'
                onPan={this.onPan}
                onZoom={this.onZoom}
                onGestureEnd={this.onGestureEnd}
            >
                <img src={textureUrl} alt='map' onLoad={(evt) => {
                    window.URL.revokeObjectURL(textureUrl);
                    if (isSizedEvent(evt)) {
                        this.setState({
                            appProperties: MiniEditor.calculateAppProperties(this.state.appProperties, {
                                width: evt.target.width / MiniEditor.MINI_SCALE,
                                height: evt.target.height / MiniEditor.MINI_SCALE
                            })
                        });
                    }
                }}/>
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
            </GestureControls>
        );
    }

    render() {
        return (
            <RenameFileEditor
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