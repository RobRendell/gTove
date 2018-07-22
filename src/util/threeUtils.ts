import * as THREE from 'three';

import {ObjectEuler, ObjectVector3} from './scenarioUtils';

export function vector3ToObject(position: THREE.Vector3 | ObjectVector3): ObjectVector3 {
    return {x: position.x, y: position.y, z: position.z};
}

export function buildVector3(position: ObjectVector3): THREE.Vector3 {
    return (position) ? new THREE.Vector3(position.x, position.y, position.z) : new THREE.Vector3(0, 0, 0);
}

export function eulerToObject(euler: THREE.Euler | ObjectEuler): ObjectEuler {
    return {x: euler.x, y: euler.y, z: euler.z, order: euler.order};
}

export function buildEuler(rotation: ObjectEuler): THREE.Euler {
    // The underscore values are for backwards compatibility - should be able to remove eventually.
    return (rotation) ? new THREE.Euler(rotation.x || rotation._x, rotation.y || rotation._y, rotation.z || rotation._z, 'XYZ') : new THREE.Euler();
}

