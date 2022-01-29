import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';

import {getColourHexString} from '../util/scenarioUtils';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import {MINI_THICKNESS, RENDER_ORDER_ADJUST} from './tabletopMiniComponent';

interface TabletopMiniBaseComponentProps {
    miniId: string;
    baseColour?: number;
    hideBase: boolean;
    renderOrder: number;
    opacity: number;
    highlight: THREE.Color | null;
    scaleFactor: number;
}

const TabletopMiniBaseComponent: FunctionComponent<TabletopMiniBaseComponentProps> = (
    {
        miniId, baseColour, hideBase, renderOrder, opacity,
        highlight, scaleFactor
    }
) => {
    const color = useMemo(() => (getColourHexString(baseColour || 0)), [baseColour]);
    const scale = useMemo(() => (new THREE.Vector3(scaleFactor, 1, scaleFactor)), [scaleFactor]);
    const highlightScale = useMemo(() => ( scale.clone().addScalar(0.1)), [scale]);
    return hideBase ? null : (
        <group userData={{miniId}}>
            <mesh key='miniBase' scale={scale} renderOrder={renderOrder + RENDER_ORDER_ADJUST}>
                <cylinderGeometry attach='geometry' args={[0.5, 0.5, MINI_THICKNESS, 32]}/>
                <meshPhongMaterial attach='material' args={[{color, transparent: opacity < 1.0, opacity}]}/>
            </mesh>
            {
                (!highlight) ? null : (
                    <mesh scale={highlightScale} renderOrder={renderOrder + RENDER_ORDER_ADJUST}>
                        <cylinderGeometry attach='geometry' args={[0.5, 0.5, MINI_THICKNESS, 32]}/>
                        <HighlightShaderMaterial colour={highlight} intensityFactor={1}/>
                    </mesh>
                )
            }
        </group>
    );
}

export default TabletopMiniBaseComponent;