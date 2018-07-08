import * as React from 'react';
import * as THREE from 'three';
import {MiniAppProperties} from '../util/googleDriveUtils';
import MiniEditor from '../presentation/miniEditor';

const vertex_shader: string = (`
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

const fragment_shader: string = (`
varying vec2 vUv;
varying vec3 vNormal;
uniform bool textureReady;
uniform sampler2D texture1;
uniform float opacity;
void main() {
    if (!textureReady) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, opacity);
    } else if (vNormal.z > -0.1 && vNormal.z < 0.1) {
        gl_FragColor = vec4(0.8, 0.8, 0.8, opacity);
    } else if (vUv.x < 0.0 || vUv.x >= 1.0 || vUv.y < 0.0 || vUv.y >= 1.0) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, opacity);
    } else {
        vec4 pix = texture2D(texture1, vUv);
        if (pix.a < 0.1) {
            pix = vec4(1.0, 1.0, 1.0, opacity);
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

export default function getUprightMiniShaderMaterial(texture: THREE.Texture | null, opacity: number, appProperties: MiniAppProperties) {
    const derived = MiniEditor.calculateAppProperties(appProperties);
    const rangeU = Number(derived.standeeRangeX);
    const rangeV = Number(derived.standeeRangeY);
    const offU = Number(derived.standeeX);
    const offV = Number(derived.standeeY);
    return (
        <shaderMaterial
            vertexShader={vertex_shader}
            fragmentShader={fragment_shader}
            transparent={opacity < 1.0}
        >
            <uniforms>
                <uniform type='b' name='textureReady' value={texture !== null} />
                <uniform type='t' name='texture1' value={texture} />
                <uniform type='f' name='opacity' value={opacity}/>
                <uniform type='f' name='rangeU' value={rangeU}/>
                <uniform type='f' name='rangeV' value={rangeV}/>
                <uniform type='f' name='offU' value={offU}/>
                <uniform type='f' name='offV' value={offV}/>
            </uniforms>
        </shaderMaterial>
    );
}