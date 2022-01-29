import {FunctionComponent} from 'react';
import * as THREE from 'three';

import {MINI_THICKNESS} from './tabletopMiniComponent';

interface TabletopMiniElevationArrowProps {
    length: number;
}

const ORIGIN = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ARROW_SIZE = 0.1;

const TabletopMiniElevationArrow: FunctionComponent<TabletopMiniElevationArrowProps> = ({length}) => {
    return length > ARROW_SIZE ? (
        <arrowHelper args={[UP, ORIGIN, length + MINI_THICKNESS, undefined, ARROW_SIZE, ARROW_SIZE]}/>
    ) : null
};

export default TabletopMiniElevationArrow;