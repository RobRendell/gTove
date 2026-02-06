import {Component, createContext} from 'react';
import PropTypes from 'prop-types';

import {FileAPI} from '../util/storage/storageContract';
import { FileAPIContext } from '../util/storage/storageContract';
import DriveTextureLoader, {TextureLoaderContext} from '../util/storage/providers/google/driveTextureLoader';

interface FileAPIContextBridgeProps {
    fileAPI: FileAPI;
    textureLoader: DriveTextureLoader;
}

export const FileAPIContextObject = createContext({} as FileAPI);
export const TextureLoaderContextObject = createContext({} as DriveTextureLoader);

/** Support both legacy and new context APIs until we finish migrating to the new API. */
export default class FileAPIContextBridge extends Component<FileAPIContextBridgeProps> {

    static childContextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object
    }

    getChildContext(): FileAPIContext & TextureLoaderContext {
        return {
            fileAPI: this.props.fileAPI,
            textureLoader: this.props.textureLoader
        };
    }

    render() {
        return (
            <FileAPIContextObject.Provider value={this.props.fileAPI}>
                <TextureLoaderContextObject.Provider value={this.props.textureLoader}>
                    {this.props.children}
                </TextureLoaderContextObject.Provider>
            </FileAPIContextObject.Provider>
        )
    }
}