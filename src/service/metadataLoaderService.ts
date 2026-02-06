import {FileMetadata} from '../util/storage/storageContract';
import {FileAPI} from '../util/storage/storageContract';
import {PromiseChain} from '../util/promiseChain';

class MetadataLoaderService {

    private loading: {[id: string]: Promise<FileMetadata>} = {};
    private promiseChain= new PromiseChain<FileMetadata>();

    loadMetadata(metadataId: string, fileAPI: FileAPI): Promise<FileMetadata> {
        if (!this.loading[metadataId]) {
            this.loading[metadataId] = this.promiseChain.queuePromise(fileAPI.getFullMetadata(metadataId));
        }
        return this.loading[metadataId];
    }

}

export default new MetadataLoaderService();