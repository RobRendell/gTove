import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Dispatch} from 'redux';

import {FileAPI} from '../util/fileUtils';
import RenameFileEditor from './renameFileEditor';
import DriveTextureLoader from '../util/driveTextureLoader';
import {DriveMetadata, MiniAppProperties} from '../@types/googleDrive';
import {ReduxStoreType} from '../redux/mainReducer';
import {isSizedEvent} from '../util/types';

interface MiniEditorProps {
    metadata: DriveMetadata<MiniAppProperties>;
    name: string;
    onClose: () => {};
    dispatch: Dispatch<ReduxStoreType>;
    textureLoader: DriveTextureLoader;
    fileAPI: FileAPI;
}

interface MiniEditorState {
    appProperties: MiniAppProperties;
    textureUrl?: string;
    loadError?: string;
}

class MiniEditor extends React.Component<MiniEditorProps, MiniEditorState> {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        name: PropTypes.string.isRequired,
        onClose: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired,
        textureLoader: PropTypes.object.isRequired,
        fileAPI: PropTypes.object.isRequired
    };

    constructor(props: MiniEditorProps) {
        super(props);
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

    getStateFromProps(props: MiniEditorProps): MiniEditorState {
        return {
            appProperties: {...props.metadata.appProperties},
            textureUrl: undefined,
            loadError: undefined
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

    render() {
        // Assign to const to ensure textureUrl doesn't change between rendering and the img "onLoad" event firing.
        const textureUrl = this.state.textureUrl;
        return (
            <RenameFileEditor
                metadata={this.props.metadata}
                onClose={this.props.onClose}
                getSaveMetadata={this.getSaveMetadata}
            >
                <div className='editImagePanel'>
                    {
                        textureUrl ? (
                            <img src={textureUrl} alt='map' onLoad={(evt) => {
                                window.URL.revokeObjectURL(textureUrl);
                                if (isSizedEvent(evt)) {
                                    this.setState({
                                        appProperties: {
                                            ...this.state.appProperties,
                                            width: evt.target.width / 50,
                                            height: evt.target.height / 50
                                        }
                                    });
                                }
                            }}/>
                        ) : (
                            this.state.loadError ? (
                                <span>An error occurred while loading this file from Google Drive: {this.state.loadError}</span>
                            ) : (
                                <span>Loading...</span>
                            )
                        )
                    }
                </div>
            </RenameFileEditor>
        );
    }
}

export default MiniEditor;