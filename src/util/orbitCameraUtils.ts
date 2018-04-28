import * as THREE from 'three';
import {clamp} from 'lodash';
import {ObjectVector2} from '../container/gestureControls';

// Code based on ThreeJS's OrbitControls example.

let offset = new THREE.Vector3();
let delta = new THREE.Vector3();

function panLeft(camera: any, distance: number, offset: THREE.Vector3) {
    delta.setFromMatrixColumn(camera.matrix, 0); // get X-basis column of camera.matrix
    delta.multiplyScalar(-distance);
    offset.add(delta);
}

function panUp(camera: any, distance: number, offset: THREE.Vector3) {
    delta.setFromMatrixColumn(camera.matrix, 2); // get Z-basis column of camera.matrix
    delta.set(delta.x, 0, delta.z).normalize(); // remove y component.
    delta.multiplyScalar(-distance);
    offset.add(delta);
}

export function panCamera({x: deltaX, y: deltaY}: ObjectVector2, camera: any, clientWidth: number, clientHeight: number) {
    if (camera.isPerspectiveCamera) {
        let lookAt = camera.userData._lookAt;
        offset.copy(camera.position).sub(lookAt);
        let targetDistance = offset.length();

        // half of the fov is center to top of screen
        targetDistance *= Math.tan(( camera.fov / 2 ) * Math.PI / 180.0);

        offset.set(0, 0, 0);
        // we actually don't use clientWidth, since perspective camera is fixed to screen height
        panLeft(camera, 2 * deltaX * targetDistance / clientHeight, offset);
        panUp(camera, 2 * deltaY * targetDistance / clientHeight, offset);
    } else if (camera.isOrthographicCamera) {
        offset.set(0, 0, 0);
        panLeft(camera, deltaX * ( camera.right - camera.left ) / camera.zoom / clientWidth, offset);
        panUp(camera, deltaY * ( camera.top - camera.bottom ) / camera.zoom / clientHeight, offset);
    } else {
        // camera neither orthographic nor perspective
        console.warn('WARNING: panCamera() encountered an unknown camera type');
    }
    return {cameraPosition: camera.position.clone().add(offset), cameraLookAt: camera.userData._lookAt.clone().add(offset)}
}

const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0));
const quatInverse = quat.clone().inverse();

let spherical = new THREE.Spherical();

export function rotateCamera({x: deltaX, y: deltaY}: ObjectVector2, camera: any, clientWidth: number, clientHeight: number) {
    // rotating across whole screen goes 180 degrees around
    const deltaTheta = -Math.PI * deltaX / clientWidth;
    // rotating up and down along whole screen attempts to go 180
    const deltaPhi = -Math.PI * deltaY / clientHeight;
    // Perform rotation calculation
    let lookAt = camera.userData._lookAt;
    offset.copy(camera.position).sub(lookAt);
    spherical.setFromVector3(offset);
    spherical.theta += deltaTheta;
    spherical.phi = clamp(spherical.phi + deltaPhi, 0, Math.PI / 3);
    spherical.makeSafe();
    offset.setFromSpherical(spherical);
    // rotate offset back to "camera-up-vector-is-up" space
    offset.applyQuaternion(quatInverse);
    return {cameraPosition: lookAt.clone().add(offset)};
}

export function zoomCamera({y: deltaY}: {y: number}, camera: any, minDistance: number, maxDistance: number) {
    let lookAt = camera.userData._lookAt;
    offset.copy(camera.position).sub(lookAt);
    let distance = offset.length();
    let scale = clamp((100 + deltaY)/100, minDistance/distance, maxDistance/distance);
    offset.multiplyScalar(scale);
    return {cameraPosition: lookAt.clone().add(offset)};
}