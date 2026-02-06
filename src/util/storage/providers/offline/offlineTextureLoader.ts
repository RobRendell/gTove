import * as THREE from 'three';

import DriveTextureLoader from '../google/driveTextureLoader';
import {FileMetadata} from '../../storageContract';
import {isSupportedVideoMimeType} from '../../storageUtils';
import { OnProgressParams } from '../../storageContract';
import offlineAPI from './offlineAPI';

class OfflineTextureLoader extends DriveTextureLoader {

    async loadImageBlob(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        onProgress && onProgress({total: 100, loaded: 100});
        return await offlineAPI.getFileContents(metadata);
    }

    async loadTexture(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<{texture: THREE.Texture | THREE.VideoTexture, width: number, height: number}> {
        if (isSupportedVideoMimeType(metadata.mimeType)) {
            return this.loadVideoTexture(metadata, onProgress);
        } else {
            return this.loadImageTexture(metadata, onProgress);
        }
    }
}

export default OfflineTextureLoader;