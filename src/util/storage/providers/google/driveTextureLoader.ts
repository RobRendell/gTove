import googleAPI from './googleAPI';
import {FileMetadata, OnProgressParams, TextureLoadResult} from '../../storageContract';
import {isSupportedVideoMimeType} from '../../storageUtils';
import BaseTextureLoader from '../../baseTextureLoader';

/**
 * Texture loader for Google Drive storage provider.
 */
class DriveTextureLoader extends BaseTextureLoader {

    /**
     * Load an image blob from the given file metadata.
     * Must be implemented by each storage provider.
     */
    async loadImageBlob(metadata: Partial<FileMetadata>, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        return await googleAPI.getFileContents(metadata as FileMetadata);
    }

    /**
     * Load a texture from the given file metadata.
     * Automatically determines whether to load as image or video based on mime type.
     */
    async loadTexture(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<TextureLoadResult> {
        if (isSupportedVideoMimeType(metadata.mimeType)) {
            return this.loadVideoTexture(metadata, onProgress);
        } else {
            return super.loadTexture(metadata, onProgress);
        }
    }
}

export default DriveTextureLoader;
