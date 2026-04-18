import BaseTextureLoader from '../../baseTextureLoader';
import {FileMetadata} from '../../storageContract';
import googleAPI from './googleAPI';

/**
 * Texture loader for Google Drive storage provider.
 * Fetches file content as a Blob via the Google Drive API,
 * with an in-memory cache to avoid redundant network requests.
 */
class DriveTextureLoader extends BaseTextureLoader {

    private blobCache = new Map<string, Blob>();

    async loadImageBlob(metadata: Partial<FileMetadata>): Promise<Blob> {
        const id = metadata.id!;
        const cached = this.blobCache.get(id);
        if (cached) {
            return cached;
        }
        const blob = await googleAPI.getFileContents(metadata as FileMetadata);
        this.blobCache.set(id, blob);
        return blob;
    }
}

export default DriveTextureLoader;
