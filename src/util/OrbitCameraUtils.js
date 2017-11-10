import * as THREE from 'three';
import {clamp} from 'lodash';

// Code based on ThreeJS's OrbitControls example.

let offset = new THREE.Vector3();
let v = new THREE.Vector3();

function panLeft(camera, distance) {
    v.setFromMatrixColumn(camera.matrix, 0); // get X column of camera.matrix
    v.multiplyScalar(-distance);
    camera.position.add(v);
    camera.userData._lookAt.add(v);
}

function panUp(camera, distance) {
    v.setFromMatrixColumn(camera.matrix, 2); // get Z column of camera.matrix
    v.set(v.x, 0, v.z).normalize(); // remove y component.
    v.multiplyScalar(-distance);
    camera.position.add(v);
    camera.userData._lookAt.add(v);
}

export function panCamera({x: deltaX, y: deltaY}, camera, clientWidth, clientHeight) {
    if (!camera) {
        return;
    }
    if (camera.isPerspectiveCamera) {
        let lookAt = camera.userData._lookAt;
        offset.copy(camera.position).sub(lookAt);
        let targetDistance = offset.length();

        // half of the fov is center to top of screen
        targetDistance *= Math.tan(( camera.fov / 2 ) * Math.PI / 180.0);

        // we actually don't use clientWidth, since perspective camera is fixed to screen height
        panLeft(camera, 2 * deltaX * targetDistance / clientHeight);
        panUp(camera, 2 * deltaY * targetDistance / clientHeight);
    } else if (camera.isOrthographicCamera) {
        panLeft(camera, deltaX * ( camera.right - camera.left ) / camera.zoom / clientWidth);
        panUp(camera, deltaY * ( camera.top - camera.bottom ) / camera.zoom / clientHeight);
    } else {
        // camera neither orthographic nor perspective
        console.warn('WARNING: panCamera() encountered an unknown camera type');
    }
}

const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0));
const quatInverse = quat.clone().inverse();

let spherical = new THREE.Spherical();

export function rotateCamera({x: deltaX, y: deltaY}, camera, clientWidth, clientHeight) {
    if (!camera) {
        return;
    }
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
    camera.position.copy(lookAt).add(offset);
    camera.lookAt(lookAt);
}

export function zoomCamera({y: deltaY}, camera, minDistance, maxDistance) {
    if (!camera) {
        return;
    }
    let lookAt = camera.userData._lookAt;
    offset.copy(camera.position).sub(lookAt);
    let distance = offset.length();
    let scale = clamp((100 + deltaY)/100, minDistance/distance, maxDistance/distance);
    offset.multiplyScalar(scale);
    camera.position.copy(lookAt).add(offset);
}