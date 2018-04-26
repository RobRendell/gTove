import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Dispatch} from 'redux';

import {FileAPI, splitFileName, updateFileMetadataAndDispatch} from '../util/fileUtils';
import InputField from './inputField';
import EditorFrame from './editorFrame';
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
    name: string;
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
        this.onSave = this.onSave.bind(this);
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
            name: props.name,
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

    onSave() {
        const {suffix} = splitFileName(this.props.metadata.name);
        return updateFileMetadataAndDispatch(this.props.fileAPI, {
            id: this.props.metadata.id,
            name: this.state.name + suffix,
            appProperties: this.state.appProperties
        }, this.props.dispatch);
    }

    render() {
        // Assign to const to ensure textureUrl doesn't change between rendering and the img "onLoad" event firing.
        const textureUrl = this.state.textureUrl;
        return (
            <EditorFrame onClose={this.props.onClose} onSave={this.onSave}>
                <InputField heading='File name' type='text' initialValue={this.state.name}
                            onChange={(name: string) => {
                                this.setState({name});
                            }}/>
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
            </EditorFrame>
        );
    }
}

export default MiniEditor;