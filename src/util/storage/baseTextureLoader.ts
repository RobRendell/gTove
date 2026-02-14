import {FileMetadata, OnProgressParams, TextureLoader} from './storageContract';

/**
 * Base class for storage-provider texture loaders.
 * Subclasses only need to implement loadImageBlob() to fetch file content
 * as a Blob. The blob-to-THREE.Texture conversion is handled by TextureService.
 */
abstract class BaseTextureLoader implements TextureLoader {

    abstract loadImageBlob(
        metadata: Partial<FileMetadata>,
        onProgress?: (progress: OnProgressParams) => void): Promise<Blob>;
}

export default BaseTextureLoader;
