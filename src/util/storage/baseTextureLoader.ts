import * as THREE from 'three';

import {FileMetadata, OnProgressParams, TextureLoader, TextureLoadResult} from './storageContract';
import {isSupportedVideoMimeType} from './storageUtils';

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
     * Load a texture from the given file metadata.
     * Automatically determines whether to load as image or video based on mime type.
     */
    async loadTexture(
        metadata: Partial<FileMetadata>,
        onProgress?: (progress: OnProgressParams) => void): Promise<TextureLoadResult> {
        if (isSupportedVideoMimeType(metadata.mimeType)) {
            return this.loadVideoTexture(metadata as FileMetadata, onProgress);
        } else {
            const blob = await this.loadImageBlob(metadata, onProgress);
            return {texture: new THREE.Texture(new Image()), width: 0, height: 0};
        }
    }
}

export default BaseTextureLoader;
