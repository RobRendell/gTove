import googleAPI from './googleAPI';
import {FileMetadata, OnProgressParams} from '../../storageContract';
import BaseTextureLoader from '../../baseTextureLoader';

/**
 * Texture loader for Google Drive storage provider.
 * Fetches file content as a Blob via the Google Drive API.
 */
class DriveTextureLoader extends BaseTextureLoader {

    async loadImageBlob(metadata: Partial<FileMetadata>, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        return await googleAPI.getFileContents(metadata as FileMetadata);
    }
}

export default DriveTextureLoader;
