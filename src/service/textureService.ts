import {MathUtils, RGBAFormat, RGBFormat, Texture, VideoTexture} from 'three';

import {MIME_TYPE_JPEG} from '../util/constants';
import {PromiseChain} from '../util/promiseChain';
import {FileMetadata, TextureLoader, TextureLoadResult} from '../util/storage/storageContract';
import {isSupportedVideoMimeType} from '../util/storage/storageUtils';

// ============================================================================
// Blob-to-texture conversion (generic, not storage-provider-specific)
// ============================================================================

function blobToImageTexture(blob: Blob, mimeType?: string): Promise<TextureLoadResult> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const texture = new Texture(canvas);
        texture.format = (mimeType === MIME_TYPE_JPEG) ? RGBFormat : RGBAFormat;
        const image = document.createElement('img');
        const context = canvas.getContext('2d');
        if (context === null) {
            reject(new Error('Unable to get 2D context for image'));
            return;
        }
        const url = window.URL.createObjectURL(blob);
        image.onload = () => {
            canvas.width = MathUtils.ceilPowerOfTwo(image.width);
            canvas.height = MathUtils.ceilPowerOfTwo(image.height);
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

function blobToVideoTexture(blob: Blob): Promise<TextureLoadResult> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const texture = new VideoTexture(video);
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

async function blobToTexture(blob: Blob, metadata: Partial<FileMetadata>): Promise<TextureLoadResult> {
    if (isSupportedVideoMimeType(metadata.mimeType)) {
        return blobToVideoTexture(blob);
    } else {
        return blobToImageTexture(blob, metadata.mimeType);
    }
}

// ============================================================================
// TextureService -- caches textures by file ID with reference counting
// ============================================================================

interface TextureRecord {
    count: number;
    texturePromise: Promise<TextureLoadResult>;
    result?: TextureLoadResult;
}

class TextureService {

    private textures: {[id: string]: TextureRecord} = {};
    private promiseChain = new PromiseChain<TextureLoadResult>();

    async getTexture(metadata: FileMetadata, textureLoader: TextureLoader): Promise<TextureLoadResult> {
        const id = metadata.id;
        if (this.textures[id]?.count > 0) {
            this.textures[id].count++;
        } else {
            const loadAndConvert = textureLoader.loadImageBlob(metadata)
                .then((blob) => blobToTexture(blob, metadata));
            this.textures[id] = {
                count: 1,
                texturePromise: this.promiseChain.queuePromise(loadAndConvert)
                    .then((result) => {
                        this.textures[id].result = result;
                        return result;
                    })
            };
        }
        return this.textures[id].texturePromise;
    }

    getTextureSync(metadata: FileMetadata) {
        return this.textures[metadata.id]?.result;
    }

    async releaseTexture(metadataId: string): Promise<boolean> {
        if (this.textures[metadataId] && --this.textures[metadataId].count === 0) {
            const {texture} = await this.textures[metadataId].texturePromise;
            // The texture may have become used again in the meantime, so only release it if its count is still 0
            if (this.textures[metadataId].count === 0) {
                texture.dispose();
                delete(this.textures[metadataId]);
                return true;
            }
        }
        return false;
    }
}

export default new TextureService();
