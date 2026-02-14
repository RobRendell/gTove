import * as THREE from 'three';

import {FileMetadata, OnProgressParams, TextureLoader, TextureLoadResult} from './storageContract';
import {isSupportedVideoMimeType} from './storageUtils';
import {MIME_TYPE_JPEG} from '../constants';

/**
 * Base texture loader with shared logic for converting blobs to THREE.js textures.
 * Storage providers should extend this class and implement loadImageBlob().
 */
abstract class BaseTextureLoader implements TextureLoader {

    protected manager: THREE.LoadingManager;

    constructor(manager: THREE.LoadingManager = THREE.DefaultLoadingManager) {
        this.manager = manager;
        THREE.Cache.enabled = true;
    }

    /**
     * Load an image blob from the given file metadata.
     * Must be implemented by each storage provider.
     */
    abstract loadImageBlob(
        metadata: Partial<FileMetadata>,
        onProgress?: (progress: OnProgressParams) => void): Promise<Blob>;

    /**
     * Load a video texture from the given file metadata.
     */
    async loadVideoTexture(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<TextureLoadResult> {
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
        });
    }

    /**
     * Load an image texture from the given file metadata.
     * Converts the blob into a canvas-backed THREE.Texture with power-of-two dimensions.
     */
    async loadImageTexture(metadata: Partial<FileMetadata>, onProgress?: (progress: OnProgressParams) => void): Promise<TextureLoadResult> {
        const blob = await this.loadImageBlob(metadata, onProgress);
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const texture = new THREE.Texture(canvas);
            // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
            texture.format = (metadata.mimeType === MIME_TYPE_JPEG) ? THREE.RGBFormat : THREE.RGBAFormat;
            const image = document.createElement('img');
            const context = canvas.getContext('2d');
            if (context === null) {
                reject(new Error('Unable to get 2D context for image'));
                return;
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
            image.onerror = () => {
                window.URL.revokeObjectURL(url);
                reject(new Error('Failed to load image from blob'));
            };
            image.src = url;
        });
    }

    /**
     * Load a texture from the given file metadata.
     * Automatically determines whether to load as image or video based on mime type.
     */
    async loadTexture(
        metadata: Partial<FileMetadata>,
        onProgress?: (progress: OnProgressParams) => void): Promise<TextureLoadResult> {
        if (isSupportedVideoMimeType(metadata.mimeType)) {
            return this.loadVideoTexture(metadata as FileMetadata, onProgress);
        } else {
            return this.loadImageTexture(metadata, onProgress);
        }
    }
}

export default BaseTextureLoader;
