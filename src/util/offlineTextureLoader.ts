import * as THREE from 'three';

import offlineAPI from './offlineAPI';
import DriveTextureLoader from './driveTextureLoader';
import {DriveMetadata} from './googleDriveUtils';
import {isSupportedVideoMimeType, OnProgressParams} from './fileUtils';

class OfflineTextureLoader extends DriveTextureLoader {

    async loadImageBlob(metadata: DriveMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        onProgress && onProgress({total: 100, loaded: 100});
        return await offlineAPI.getFileContents(metadata);
    }

    async loadTexture(metadata: DriveMetadata, onLoad: (texture: THREE.Texture | THREE.VideoTexture) => void,
                      onProgress?: (progress: OnProgressParams) => void, onError?: (err: any) => void): Promise<void> {
        if (isSupportedVideoMimeType(metadata.mimeType)) {
            await this.loadVideoTexture(metadata, onLoad, onProgress, onError);
        } else {
            await this.loadImageTexture(metadata, onLoad, onProgress, onError);
        }
    }
}

export default OfflineTextureLoader;