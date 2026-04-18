import {createContext, FunctionComponent, PropsWithChildren} from 'react';

import BaseTextureLoader from '../util/storage/baseTextureLoader';
import {FileAPI} from '../util/storage/storageContract';

interface FileAPIContextBridgeProps extends PropsWithChildren {
    fileAPI: FileAPI;
    textureLoader: BaseTextureLoader;
}

export const FileAPIContextObject = createContext({} as FileAPI);
export const TextureLoaderContextObject = createContext({} as BaseTextureLoader);

const FileAPIProvider: FunctionComponent<FileAPIContextBridgeProps> = ({fileAPI, textureLoader, children}) => {
    return (
        <FileAPIContextObject.Provider value={fileAPI}>
            <TextureLoaderContextObject.Provider value={textureLoader}>
                {children}
            </TextureLoaderContextObject.Provider>
        </FileAPIContextObject.Provider>
    );
}

export default FileAPIProvider;