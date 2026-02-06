import * as React from 'react';
import * as THREE from 'three';
import {useFrame} from '@react-three/fiber';

import {MiniProperties} from '../util/storage/storageContract';
import {isVideoTexture} from '../util/threeUtils';

const vertexShader: string = (`
varying vec2 vUv;
varying vec3 vNormal;
uniform float rangeU;
uniform float rangeV;
uniform float offU;
uniform float offV;
void main() {
    vUv = vec2(offU + uv.x / rangeU, offV + uv.y / rangeV);
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragmentShader: string = (`
varying vec2 vUv;
varying vec3 vNormal;
uniform bool textureReady;
uniform sampler2D texture1;
uniform vec3 colour;
uniform float opacity;
void main() {
    if (!textureReady) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, opacity);
    } else if (vNormal.z > -0.1 && vNormal.z < 0.1) {
        gl_FragColor = vec4(0.6 * colour + 0.2, opacity);
    } else if (vUv.x < 0.0 || vUv.x >= 1.0 || vUv.y < 0.0 || vUv.y >= 1.0) {
        if (vNormal.z < 0.0) {
            float grey = (colour.x + colour.y + colour.z)/3.0;
            gl_FragColor = vec4(grey, grey, grey, opacity);
        } else {
            gl_FragColor = vec4(colour, opacity);
        }
    } else {
        vec4 pix = texture2D(texture1, vUv);
        if (pix.a < 0.1) {
            pix = vec4(colour, opacity);
        } else if (vNormal.z < 0.0) {
            float grey = (pix.x + pix.y + pix.z)/3.0;
            pix = vec4(grey, grey, grey, opacity);
        } else {
            pix.a *= opacity;
        }
        gl_FragColor = pix;
    }
}
`);

interface UprightMiniShaderMaterialProps {
    texture: THREE.Texture | null;
    opacity: number;
    colour: THREE.Color;
    properties: MiniProperties;
}

export default function UprightMiniShaderMaterial({texture, opacity, colour, properties}: UprightMiniShaderMaterialProps) {
    useFrame(({invalidate}) => {
        if (isVideoTexture(texture)) {
            // Video textures require constant updating
            invalidate();
        }
    });
    const rangeU = Number(properties.standeeRangeX);
    const rangeV = Number(properties.standeeRangeY);
    const offU = Number(properties.standeeX);
    const offV = Number(properties.standeeY);
    const uniforms = React.useMemo(() => ({
        textureReady: {value: texture !== null, type: 'b'},
        texture1: {value: texture, type: 't'},
        opacity: {value: opacity, type: 'f'},
        colour: {value: colour, type: 'c'},
        rangeU: {value: rangeU, type: 'f'},
        rangeV: {value: rangeV, type: 'f'},
        offU: {value: offU, type: 'f'},
        offV: {value: offV, type: 'f'}
    }), [texture, opacity, colour, rangeU, rangeV, offU, offV]);
    return (
        <shaderMaterial attach='material' args={[{uniforms, vertexShader, fragmentShader, transparent: opacity < 1.0}]} />
    );
}