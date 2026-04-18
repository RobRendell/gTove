import BaseTextureLoader from '../../baseTextureLoader';
import {FileMetadata, OnProgressParams} from '../../storageContract';
import localFileSystemAPI from './localFileSystemAPI';

/**
 * Texture loader for the local file system storage provider.
 */
class LocalTextureLoader extends BaseTextureLoader {

    async loadImageBlob(metadata: FileMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        onProgress?.({total: 100, loaded: 100});
        return await localFileSystemAPI.getFileContents(metadata);
    }
}

export default LocalTextureLoader;
