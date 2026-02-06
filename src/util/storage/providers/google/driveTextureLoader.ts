import * as THREE from 'three';

import googleAPI from './googleAPI';
import * as constants from '../../../constants';
import {FileMetadata} from '../../storageContract';
import { OnProgressParams } from '../../storageContract';
import { isSupportedVideoMimeType } from '../../storageUtils';

export interface TextureLoaderContext {
    textureLoader: DriveTextureLoader;
}

class DriveTextureLoader {

    private manager: THREE.LoadingManager;

    constructor(manager: THREE.LoadingManager = THREE.DefaultLoadingManager) {
        this.manager = manager;
        THREE.Cache.enabled = true;
    }

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

    async loadVideoTexture(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<{texture: THREE.VideoTexture, width: number, height: number}> {
        const blob = await this.loadImageBlob(metadata, onProgress);
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const texture = new THREE.VideoTexture(video);
            video.muted = true;
            video.preload = 'auto';
            video.setAttribute('autoload', 'true');
            video.loop = true;
            const url = window.URL.createObjectURL(blob);
            video.onloadeddata = () => {
                const originalDispose = texture.dispose.bind(texture);
                texture.dispose = () => {
                    video.pause();
                    originalDispose();
                    video.remove();
                    window.URL.revokeObjectURL(url);
                };
                texture.needsUpdate = true;
                video.play();
                resolve({texture, width: video.width, height: video.height});
            };
            video.src = url;
        })
    }

    async loadImageTexture(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<{texture: THREE.Texture, width: number, height: number}> {
        const blob = await this.loadImageBlob(metadata, onProgress);
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const texture = new THREE.Texture(canvas);
            // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
            texture.format = (metadata.mimeType === constants.MIME_TYPE_JPEG) ? THREE.RGBFormat : THREE.RGBAFormat;
            const image = document.createElement('img');
            const context = canvas.getContext('2d');
            if (context === null) {
                throw new Error('Unable to get 2D context for image?');
            }
            const url = window.URL.createObjectURL(blob);
            image.onload = () => {
                canvas.width = THREE.MathUtils.ceilPowerOfTwo(image.width);
                canvas.height = THREE.MathUtils.ceilPowerOfTwo(image.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                window.URL.revokeObjectURL(url);
                const originalDispose = texture.dispose.bind(texture);
                texture.dispose = () => {
                    originalDispose();
                    image.remove();
                };
                texture.needsUpdate = true;
                resolve({texture, width: image.width, height: image.height});
            };
            image.src = url;
        });
    }

    async loadTexture(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<{texture: THREE.Texture | THREE.VideoTexture, width: number, height: number}> {
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