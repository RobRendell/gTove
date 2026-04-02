import {createContext, FunctionComponent, PropsWithChildren} from 'react';

import DriveTextureLoader from '../util/storage/providers/google/driveTextureLoader';
import {FileAPI} from '../util/storage/storageContract';

interface FileAPIContextBridgeProps extends PropsWithChildren {
    fileAPI: FileAPI;
    textureLoader: DriveTextureLoader;
}

export const FileAPIContextObject = createContext({} as FileAPI);
export const TextureLoaderContextObject = createContext({} as DriveTextureLoader);

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