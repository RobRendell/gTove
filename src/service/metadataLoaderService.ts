import {DriveMetadata} from '../util/googleDriveUtils';
import {FileAPI} from '../util/fileUtils';

class MetadataLoaderService {

    private loading: {[id: string]: Promise<DriveMetadata>} = {};

    loadMetadata(metadataId: string, fileAPI: FileAPI): Promise<DriveMetadata> {
        if (!this.loading[metadataId]) {
            this.loading[metadataId] = fileAPI.getFullMetadata(metadataId);
        }
        return this.loading[metadataId];
    }

}

export default new MetadataLoaderService();