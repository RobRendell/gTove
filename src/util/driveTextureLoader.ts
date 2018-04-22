import * as THREE from 'three';

import {getAuthorisation, getFileResourceMediaUrl} from './googleAPI';
import {fetchWithProgress, FetchWithProgressResponse} from './fetchWithProgress';
import * as constants from './constants';
import {DriveMetadata} from '../@types/googleDrive';
import {OnProgressParams} from './fileUtils';

class DriveTextureLoader {

    private manager: THREE.LoadingManager;

    constructor(manager: THREE.LoadingManager = THREE.DefaultLoadingManager) {
        this.manager = manager;
    }

    loadImageBlob(metadata: DriveMetadata, onProgress?: (progress: OnProgressParams) => void): Promise<Blob> {
        let location = getFileResourceMediaUrl(metadata);
        const cached = THREE.Cache.get(location);
        if (cached) {
            return cached;
        } else {
            const options = {
                headers: {
                    'Authorization': getAuthorisation()
                },
                responseType: 'blob' as XMLHttpRequestResponseType
            };
            this.manager.itemStart(location);
            return fetchWithProgress(location, options, onProgress)
                .then((response: FetchWithProgressResponse) => {
                    if (!response.ok) {
                        throw new Error(response.toString());
                    }
                    return response.body()
                        .then((binary: object) => {
                            this.manager.itemEnd(location);
                            const result = new Blob(
                                [ binary ],
                                { type: response.headers.get('Content-Type') || undefined }
                            );
                            THREE.Cache.add(location, result);
                            return result;
                        });
                })
                .catch((error: Error) => {
                    this.manager.itemEnd(location);
                    this.manager.itemError(location);
                    throw error;
                });
        }
    }

    loadTexture(metadata: DriveMetadata, onLoad?: (texture: THREE.Texture) => void,
                onProgress?: (progress: OnProgressParams) => void, onError?: (err: any) => void): THREE.Texture {
        let texture = new THREE.Texture();
        // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
        let isJPEG = (metadata.mimeType === constants.MIME_TYPE_JPEG);
        texture.format = isJPEG ? THREE.RGBFormat : THREE.RGBAFormat;
        texture.image = document.createElementNS('http://www.w3.org/1999/xhtml', 'img');
        // Don't return the promise, just start it.
        this.loadImageBlob(metadata, onProgress)
            .then((blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                texture.image.onload = () => {
                    window.URL.revokeObjectURL(url);
                    texture.needsUpdate = true;
                    if (onLoad) {
                        onLoad(texture);
                    }
                };
                texture.image.src = url;
            })
            .catch((error: any) => {
                if (onError) {
                    onError(error);
                }
            });
        // Return the texture that will be updated when the promise resolves
        return texture;
    }
}

export default DriveTextureLoader;