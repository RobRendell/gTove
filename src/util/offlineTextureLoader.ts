import {getFileResource} from './offlineAPI';
import DriveTextureLoader from './driveTextureLoader';
import {DriveMetadata} from './googleDriveUtils';
import {OnProgressParams} from './fileUtils';

class OfflineTextureLoader extends DriveTextureLoader {

    loadImageBlob(metadata: DriveMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        onProgress && onProgress({total: 100, loaded: 100});
        return getFileResource(metadata);
    }
}

export default OfflineTextureLoader;