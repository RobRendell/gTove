import * as THREE from 'three';

import {ObjectEuler, ObjectVector3} from './scenarioUtils';

export function vector3ToObject(position: THREE.Vector3 | ObjectVector3): ObjectVector3 {
    return {x: position.x, y: position.y, z: position.z};
}

export function vector3ToArray(position: THREE.Vector3 | ObjectVector3): [number, number, number] {
    return [position.x, position.y, position.z];
}

export function buildVector3(position?: ObjectVector3): THREE.Vector3 {
    return (position) ? new THREE.Vector3(position.x, position.y, position.z) : new THREE.Vector3(0, 0, 0);
}

export function eulerToObject(euler: THREE.Euler | ObjectEuler): ObjectEuler {
    return {x: euler.x, y: euler.y, z: euler.z, order: euler.order};
}

export function buildEuler(rotation: ObjectEuler): THREE.Euler {
    // The underscore values are for backwards compatibility - should be able to remove eventually.
    return (rotation) ? new THREE.Euler(rotation.x || rotation._x, rotation.y || rotation._y, rotation.z || rotation._z, 'XYZ') : new THREE.Euler();
}

export function reverseEuler(rotation: THREE.Euler) {
    const order = rotation.order.split('').reverse().join('');
    return new THREE.Euler(-rotation.x, -rotation.y, -rotation.z, order);
}

export function getTextureCornerColour(texture: THREE.Texture | THREE.VideoTexture | null) {
    let colour;
    if (texture && !isVideoTexture(texture) && texture.image) {
        const context = texture.image.getContext('2d');
        if (context) {
            const pixel = context.getImageData(0, 0, 1, 1);
            if (pixel.data[3] > 200) {
                colour = new THREE.Color(pixel.data[0] / 255, pixel.data[1] / 255, pixel.data[2] / 255);
            }
        }
    }
    return colour ? colour : new THREE.Color(1.0, 1.0, 1.0);
}

export function isColourDark(colour: THREE.Color) {
    const yiq = ((colour.r * 299) + (colour.g * 587) + (colour.b * 114)) / 1000;
    return (yiq < 0.5);
}

export function isVideoTexture(texture: any): texture is THREE.VideoTexture {
    return texture && texture.isVideoTexture;
}

export function hasAnyAudio(texture: THREE.VideoTexture): boolean {
    const video = texture.image;
    return video.mozHasAudio ||
        Boolean(video.webkitAudioDecodedByteCount) ||
        Boolean(video.audioTracks && video.audioTracks.length);
}