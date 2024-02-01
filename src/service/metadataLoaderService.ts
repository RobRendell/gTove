import {DriveMetadata} from '../util/googleDriveUtils';
import {FileAPI} from '../util/fileUtils';
import {PromiseChain} from '../util/promiseChain';

class MetadataLoaderService {

    private loading: {[id: string]: Promise<DriveMetadata>} = {};
    private promiseChain= new PromiseChain<DriveMetadata>();

    loadMetadata(metadataId: string, fileAPI: FileAPI): Promise<DriveMetadata> {
        if (!this.loading[metadataId]) {
            this.loading[metadataId] = this.promiseChain.queuePromise(fileAPI.getFullMetadata(metadataId));
        }
        return this.loading[metadataId];
    }

}

export default new MetadataLoaderService();