import {getFileResource} from './offlineUtils';
import DriveTextureLoader from './DriveTextureLoader';

class OfflineTextureLoader extends DriveTextureLoader {

    loadImageBlob(metadata) {
        return getFileResource(metadata);
    }
}

export default OfflineTextureLoader;