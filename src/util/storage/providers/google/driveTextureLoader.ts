import * as THREE from 'three';

import googleAPI from './googleAPI';
import BaseTextureLoader from '../../baseTextureLoader';
import {FileMetadata, OnProgressParams, TextureLoadResult} from '../../storageContract';
import {isSupportedVideoMimeType} from '../../storageUtils';

/**
 * Texture loader for Google Drive storage provider.
 */
class DriveTextureLoader extends BaseTextureLoader {

    async loadImageBlob(metadata: Partial<FileMetadata>, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        const metadataId = metadata.id!;
        const cached: Blob = THREE.Cache.get(metadataId);
        if (cached) {
            return Promise.resolve(cached);
        } else {
            try {
                this.manager.itemStart(metadataId);
                const blob = await googleAPI.getFileContents(metadata);
                this.manager.itemEnd(metadataId);
                THREE.Cache.add(metadataId, blob);
                return blob;
            } catch (error) {
                this.manager.itemEnd(metadataId);
                this.manager.itemError(metadataId);
                throw error;
            }
        }
    }

    async loadTexture(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<TextureLoadResult> {
        // Fetch full metadata if mimeType is missing
        if (!metadata.mimeType) {
            metadata = await googleAPI.getFullMetadata(metadata.id);
        }
        if (isSupportedVideoMimeType(metadata.mimeType)) {
            return this.loadVideoTexture(metadata, onProgress);
        } else {
            return this.loadImageTexture(metadata, onProgress);
        }
    }
}

export default DriveTextureLoader;
