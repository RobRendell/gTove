import THREE from 'three';

import DriveTextureLoader from '../util/driveTextureLoader';
import {DriveMetadata} from '../util/googleDriveUtils';

interface TextureRecord {
    count: number;
    texturePromise: Promise<THREE.Texture>;
}

class TextureService {

    private textures: {[id: string]: TextureRecord} = {};

    async getTexture(metadata: DriveMetadata, textureLoader: DriveTextureLoader): Promise<THREE.Texture | THREE.VideoTexture> {
        const id = metadata.id;
        if (this.textures[id]) {
            this.textures[id].count++;
        } else {
            this.textures[id] = {
                count: 1,
                texturePromise: textureLoader.loadTexture(metadata)
            };
        }
        return this.textures[id].texturePromise;
    }

    async releaseTexture(metadata: DriveMetadata): Promise<boolean> {
        const id = metadata.id;
        if (this.textures[id] && --this.textures[id].count === 0) {
            const texture = await this.textures[id].texturePromise;
            texture.dispose();
            delete(this.textures[id]);
            return true;
        }
        return false;
    }
}

export default new TextureService();