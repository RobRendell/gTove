import * as THREE from 'three';

export function buildVector3(position) {
    return (position) ? new THREE.Vector3(position.x, position.y, position.z) : new THREE.Vector3(0, 0, 0);
}

export function buildEuler(rotation) {
    return (rotation) ? new THREE.Euler(rotation._x, rotation._y, rotation._z, rotation._order) : new THREE.Euler();
}

