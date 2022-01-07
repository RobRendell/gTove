import THREE from 'three';

import DriveTextureLoader from '../util/driveTextureLoader';
import {DriveMetadata} from '../util/googleDriveUtils';

export interface TexturePromiseResult {
    texture: THREE.Texture | THREE.VideoTexture;
    width: number;
    height: number;
}

interface TextureRecord {
    count: number;
    texturePromise: Promise<TexturePromiseResult>;
}

class TextureService {

    private textures: {[id: string]: TextureRecord} = {};

    async getTexture(metadata: DriveMetadata, textureLoader: DriveTextureLoader): Promise<TexturePromiseResult> {
        const id = metadata.id;
        if (this.textures[id]?.count > 0) {
            this.textures[id].count++;
        } else {
            this.textures[id] = {
                count: 1,
                texturePromise: textureLoader.loadTexture(metadata)
            };
        }
        return this.textures[id].texturePromise;
    }

    async releaseTexture(metadataId: string): Promise<boolean> {
        if (this.textures[metadataId] && --this.textures[metadataId].count === 0) {
            const {texture} = await this.textures[metadataId].texturePromise;
            texture.dispose();
            delete(this.textures[metadataId]);
            return true;
        }
        return false;
    }
}

export default new TextureService();