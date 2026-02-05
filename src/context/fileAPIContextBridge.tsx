import {Component, createContext} from 'react';
import PropTypes from 'prop-types';

import {FileAPI, FileAPIContext, TextureLoader, TextureLoaderContext} from '../util/storage/storageContract';

interface FileAPIContextBridgeProps {
    fileAPI: FileAPI;
    textureLoader: TextureLoader;
}

export const FileAPIContextObject = createContext({} as FileAPI);
export const TextureLoaderContextObject = createContext({} as TextureLoader);

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