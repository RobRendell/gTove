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

    async loadTexture(metadata: DriveMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<THREE.Texture | THREE.VideoTexture> {
        if (isSupportedVideoMimeType(metadata.mimeType)) {
            return this.loadVideoTexture(metadata, onProgress);
        } else {
            return this.loadImageTexture(metadata, onProgress);
        }
    }
}

export default OfflineTextureLoader;