import * as THREE from 'three';

import googleAPI from './googleAPI';
import * as constants from './constants';
import {DriveMetadata} from './googleDriveUtils';
import {OnProgressParams} from './fileUtils';

export interface TextureLoaderContext {
    textureLoader: DriveTextureLoader;
}

class DriveTextureLoader {

    private manager: THREE.LoadingManager;

    constructor(manager: THREE.LoadingManager = THREE.DefaultLoadingManager) {
        this.manager = manager;
        THREE.Cache.enabled = true;
    }

    loadImageBlob(metadata: Partial<DriveMetadata>, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        const metadataId = metadata.id!;
        const cached: Blob = THREE.Cache.get(metadataId);
        if (cached) {
            return Promise.resolve(cached);
        } else {
            this.manager.itemStart(metadataId);
            return googleAPI.getFileContents(metadata)
                .then((result: Blob) => {
                    this.manager.itemEnd(metadataId);
                    THREE.Cache.add(metadataId, result);
                    return result;
                })
                .catch((error: Error) => {
                    this.manager.itemEnd(metadataId);
                    this.manager.itemError(metadataId);
                    throw error;
                });
        }
    }

    loadTexture(metadata: DriveMetadata, onLoad?: (texture: THREE.Texture) => void,
                onProgress?: (progress: OnProgressParams) => void, onError?: (err: any) => void): THREE.Texture {
        let texture = new THREE.Texture();
        // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
        let isJPEG = (metadata.mimeType === constants.MIME_TYPE_JPEG);
        texture.format = isJPEG ? THREE.RGBFormat : THREE.RGBAFormat;
        texture.image = document.createElementNS('http://www.w3.org/1999/xhtml', 'img') as HTMLImageElement;

        // Don't return the promise, just start it.
        this.loadImageBlob(metadata, onProgress)
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                texture.image.onload = () => {
                    window.URL.revokeObjectURL(url);
                    texture.needsUpdate = true;
                    if (onLoad) {
                        onLoad(texture);
                    }
                };
                texture.image.src = url;
            })
            .catch((error: any) => {
                if (onError) {
                    onError(error);
                }
            });
        // Return the texture that will be updated when the promise resolves
        return texture;
    }
}

export default DriveTextureLoader;