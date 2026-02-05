import {FileMetadata, TextureLoader, TextureLoadResult} from '../util/storage/storageContract';
import {PromiseChain} from '../util/promiseChain';

interface TextureRecord {
    count: number;
    texturePromise: Promise<TextureLoadResult>;
    result?: TextureLoadResult;
}

class TextureService {

    private textures: {[id: string]: TextureRecord} = {};
    private promiseChain = new PromiseChain<TextureLoadResult>();

    async getTexture(metadata: FileMetadata, textureLoader: TextureLoader): Promise<TextureLoadResult> {
        const id = metadata.id;
        if (this.textures[id]?.count > 0) {
            this.textures[id].count++;
        } else {
            this.textures[id] = {
                count: 1,
                texturePromise: this.promiseChain.queuePromise(textureLoader.loadTexture(metadata))
                    .then((result) => {
                        this.textures[id].result = result;
                        return result;
                    })
            };
        }
        return this.textures[id].texturePromise;
    }

    getTextureSync(metadata: FileMetadata) {
        return this.textures[metadata.id]?.result;
    }

    async releaseTexture(metadataId: string): Promise<boolean> {
        if (this.textures[metadataId] && --this.textures[metadataId].count === 0) {
            const {texture} = await this.textures[metadataId].texturePromise;
            // The texture may have become used again in the meantime, so only release it if its count is still 0
            if (this.textures[metadataId].count === 0) {
                texture.dispose();
                delete(this.textures[metadataId]);
                return true;
            }
        }
        return false;
    }
}

export default new TextureService();
