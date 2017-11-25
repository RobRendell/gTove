import * as THREE from 'three';
import {getAuthorisation, getFileResourceMediaUrl} from './googleAPIUtils';
import {fetchWithProgress} from './fetchWithProgress';

class DriveTextureLoader {

    constructor(manager = THREE.DefaultLoadingManager) {
        this.manager = manager;
    }

    load(metadata, onLoad, onProgress, onError) {
        let location = getFileResourceMediaUrl(metadata);
        let texture = new THREE.Texture();
        // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
        let isJPEG = metadata.name.search(/\.(jpg|jpeg)$/) > 0;
        texture.format = isJPEG ? THREE.RGBFormat : THREE.RGBAFormat;
        const cached = THREE.Cache.get(location);
        if (cached) {
            texture.image = cached;
            texture.needsUpdate = true;
            if (onLoad) {
                onLoad(texture);
            }
        } else {
            texture.image = document.createElementNS('http://www.w3.org/1999/xhtml', 'img');
            const options = {
                headers: {
                    'Authorization': getAuthorisation()
                },
                responseType: 'blob'
            };
            this.manager.itemStart(location);
            fetchWithProgress(location, options, onProgress)
                .then((response) => {
                    if (response.status < 200 || response.status >= 300) {
                        throw new Error(response);
                    }
                    return response.binary()
                        .then((binary) => {
                            return new Blob(
                                [ binary ],
                                { type: response.headers.get('Content-Type') }
                            );
                        });
                })
                .then((blob) => {
                    this.manager.itemEnd(location);
                    const url = window.URL.createObjectURL(blob);
                    texture.image.onload = () => {
                        window.URL.revokeObjectURL(url);
                        texture.needsUpdate = true;
                        if (onLoad) {
                            onLoad(texture);
                        }
                    };
                    texture.image.src = url;
                    THREE.Cache.add(location, texture.image);
                })
                .catch((error) => {
                    this.manager.itemEnd(location);
                    this.manager.itemError(location);
                    if (onError) {
                        onError(error);
                    }
                });
        }
        return texture;
    }
}

export default DriveTextureLoader;