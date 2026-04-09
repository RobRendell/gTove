import {Color, Euler, EulerOrder, Texture, Vector2, Vector3, VideoTexture} from 'three';

import * as constants from './constants';
import {ObjectEuler, ObjectVector2, ObjectVector3} from './scenarioUtils';

export function buildVector2(position: ObjectVector2) {
    return new Vector2(position.x, position.y);
}

export function vector3ToObject(position: Vector3 | ObjectVector3): ObjectVector3 {
    return {x: position.x, y: position.y, z: position.z};
}

export function vector3ToArray(position: Vector3 | ObjectVector3): [number, number, number] {
    return [position.x, position.y, position.z];
}

export function objectVector3Sum(v1: ObjectVector3, v2: ObjectVector3): ObjectVector3 {
    return {x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z};
}

export function objectVector3Difference(v1: ObjectVector3, v2: ObjectVector3): ObjectVector3 {
    return {x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z};
}

export function buildVector3(position?: ObjectVector3): Vector3 {
    return (position) ? new Vector3(position.x, position.y, position.z) : new Vector3(0, 0, 0);
}

export function eulerToObject(euler: Euler | ObjectEuler): ObjectEuler {
    return {x: euler.x, y: euler.y, z: euler.z, order: euler.order};
}

export function buildEuler(rotation?: ObjectEuler): Euler {
    return rotation ? new Euler(rotation.x, rotation.y, rotation.z, rotation.order) : new Euler();
}

export function reverseEuler(rotation: Euler | ObjectEuler) {
    const order = rotation.order.split('').reverse().join('');
    return new Euler(-rotation.x, -rotation.y, -rotation.z, order as EulerOrder);
}

export function objectEulerAddY(euler: ObjectEuler, y: number): ObjectEuler {
    return {x: euler.x, y: euler.y + y, z: euler.z, order: euler.order};
}

export function objectEulerSubtractY(euler: ObjectEuler, y: number): ObjectEuler {
    return {x: euler.x, y: euler.y - y, z: euler.z, order: euler.order};
}

export function getTextureCornerColour(texture: Texture | VideoTexture | null) {
    let colour;
    if (texture && !isVideoTexture(texture) && texture.image) {
        const context = texture.image.getContext('2d');
        if (context) {
            const pixel = context.getImageData(0, 0, 1, 1);
            if (pixel.data[3] > 200) {
                colour = new Color(pixel.data[0] / 255, pixel.data[1] / 255, pixel.data[2] / 255);
            }
        }
    }
    return colour ? colour : new Color(1.0, 1.0, 1.0);
}

export function isColourDark(colour: Color) {
    const yiq = ((colour.r * 299) + (colour.g * 587) + (colour.b * 114)) / 1000;
    return (yiq < 0.5);
}

export function isVideoTexture(texture: any): texture is VideoTexture {
    return texture?.isVideoTexture;
}

export function hasAnyAudio(texture: VideoTexture): boolean {
    const video = texture.image;
    return video.mozHasAudio ||
        Boolean(video.webkitAudioDecodedByteCount) ||
        Boolean(video.audioTracks && video.audioTracks.length);
}

const topDownVector = new Vector3();
const DIR_DOWN = new Vector3(0, -1, 0);

export function isTopDown(position: Vector3, lookAt: Vector3) {
    topDownVector.copy(lookAt).sub(position).normalize();
    return topDownVector.dot(DIR_DOWN) > constants.TOPDOWN_DOT_PRODUCT;
}