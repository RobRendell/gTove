import * as THREE from 'three';

import {getAuthorisation, getFileResourceMediaUrl} from './googleAPIUtils';
import {fetchWithProgress} from './fetchWithProgress';
import * as constants from './constants';

class DriveTextureLoader {

    constructor(manager = THREE.DefaultLoadingManager) {
        this.manager = manager;
    }

    loadImageBlob(metadata, onProgress = undefined) {
        let location = getFileResourceMediaUrl(metadata);
        const cached = THREE.Cache.get(location);
        if (cached) {
            return cached;
        } else {
            const options = {
                headers: {
                    'Authorization': getAuthorisation()
                },
                responseType: 'blob'
            };
            this.manager.itemStart(location);
            return fetchWithProgress(location, options, onProgress)
                .then((response) => {
                    if (response.status < 200 || response.status >= 300) {
                        throw new Error(response);
                    }
                    return response.binary()
                        .then((binary) => {
                            this.manager.itemEnd(location);
                            const result = new Blob(
                                [ binary ],
                                { type: response.headers.get('Content-Type') }
                            );
                            THREE.Cache.add(location, result);
                            return result;
                        });
                })
                .catch((error) => {
                    this.manager.itemEnd(location);
                    this.manager.itemError(location);
                    throw error;
                });
        }
    }

    loadTexture(metadata, onLoad, onProgress, onError) {
        let texture = new THREE.Texture();
        // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
        let isJPEG = (metadata.mimeType === constants.MIME_TYPE_JPEG);
        texture.format = isJPEG ? THREE.RGBFormat : THREE.RGBAFormat;
        texture.image = document.createElementNS('http://www.w3.org/1999/xhtml', 'img');
        // Don't return the promise, just start it.
        this.loadImageBlob(metadata, onProgress)
            .then((blob) => {
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
            .catch((error) => {
                if (onError) {
                    onError(error);
                }
            });
        // Return the texture that will be updated when the promise resolves
        return texture;
    }
}

export default DriveTextureLoader;