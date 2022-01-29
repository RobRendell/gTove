import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';

import {MINI_HEIGHT, MINI_WIDTH} from '../util/constants';
import {MINI_CORNER_RADIUS_PERCENT, MINI_THICKNESS} from './tabletopMiniComponent';

const TabletopMiniExtrusion: FunctionComponent = () => {
    const shape = useMemo(() => {
        const width = MINI_WIDTH;
        const height = MINI_HEIGHT;
        const cornerRadius = width * MINI_CORNER_RADIUS_PERCENT / 100;
        const shape = new THREE.Shape();
        shape.moveTo(-width/2, 0);
        shape.lineTo(-width/2, height - cornerRadius);
        shape.quadraticCurveTo(-width/2, height, cornerRadius - width/2, height);
        shape.lineTo(width/2 - cornerRadius, height);
        shape.quadraticCurveTo(width/2, height, width/2, height - cornerRadius);
        shape.lineTo(width/2, 0);
        shape.lineTo(-width/2, 0);
        return shape;
    }, []);
    return (
        <extrudeGeometry attach='geometry' args={[shape, {depth: MINI_THICKNESS, bevelEnabled: false}]}/>
    );
};

export default TabletopMiniExtrusion;
