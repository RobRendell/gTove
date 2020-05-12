import * as THREE from 'three';

import googleAPI from './googleAPI';
import * as constants from './constants';
import {DriveMetadata} from './googleDriveUtils';
import {isSupportedVideoMimeType, OnProgressParams} from './fileUtils';

export interface TextureLoaderContext {
    textureLoader: DriveTextureLoader;
}

class DriveTextureLoader {

    private manager: THREE.LoadingManager;

    constructor(manager: THREE.LoadingManager = THREE.DefaultLoadingManager) {
        this.manager = manager;
        THREE.Cache.enabled = true;
    }

    async loadImageBlob(metadata: Partial<DriveMetadata>, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
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

    async loadVideoTexture(metadata: DriveMetadata, onLoad: (texture: THREE.VideoTexture) => void,
                     onProgress?: (progress: OnProgressParams) => void, onError?: (err: any) => void): Promise<void> {
        const video = document.createElement('video');
        const texture = new THREE.VideoTexture(video);
        const blob = await this.loadImageBlob(metadata, onProgress);
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
            onLoad(texture);
        };
        video.src = url;
    }

    async loadImageTexture(metadata: DriveMetadata, onLoad: (texture: THREE.Texture) => void,
                onProgress?: (progress: OnProgressParams) => void, onError?: (err: any) => void): Promise<void> {
        const canvas = document.createElement('canvas');
        const texture = new THREE.Texture(canvas);
        // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
        texture.format = (metadata.mimeType === constants.MIME_TYPE_JPEG) ? THREE.RGBFormat : THREE.RGBAFormat;
        const blob = await this.loadImageBlob(metadata, onProgress);
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
            onLoad(texture);
        };
        image.src = url;
    }

    async loadTexture(metadata: DriveMetadata, onLoad: (texture: THREE.Texture | THREE.VideoTexture) => void,
                onProgress?: (progress: OnProgressParams) => void, onError?: (err: any) => void): Promise<void> {
        if (!metadata.mimeType) {
            metadata = await googleAPI.getFullMetadata(metadata.id);
        }
        try {
            if (isSupportedVideoMimeType(metadata.mimeType)) {
                await this.loadVideoTexture(metadata, onLoad, onProgress, onError);
            } else {
                await this.loadImageTexture(metadata, onLoad, onProgress, onError);
            }
        } catch (error) {
            console.error(error);
            if (onError) {
                onError(error);
            }
        }
    }
}

export default DriveTextureLoader;