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
    vUv = vec2(offU + uv.x * rangeU, offV + uv.y * rangeV);
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
    } else if (vNormal.y < 0.1) {
        gl_FragColor = vec4(0.8, 0.8, 0.8, opacity);
    } else if (vUv.x < 0.0 || vUv.x >= 1.0 || vUv.y < 0.0 || vUv.y >= 1.0) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, opacity);
    } else {
        vec4 pix = texture2D(texture1, vUv);
        if (pix.a < 0.1) {
            pix = vec4(1.0, 1.0, 1.0, opacity);
        } else {
            pix.a *= opacity;
        }
        gl_FragColor = pix;
    }
}
`);

export default function getTopDownMiniShaderMaterial(texture: THREE.Texture | null, opacity: number, appProperties: MiniAppProperties) {
    const derived = MiniEditor.calculateAppProperties(appProperties);
    const aspectRatio = Number(derived.aspectRatio);
    const scaleX = (aspectRatio > 1) ? 1 : 1 / aspectRatio;
    const scaleY = (aspectRatio > 1) ? aspectRatio : 1;
    const radius = Number(derived.topDownRadius);
    const rangeU = 2 * radius * scaleX;
    const rangeV = 2 * radius * scaleY;
    const offU = (Number(derived.topDownX) - radius) * scaleX;
    const offV = (Number(derived.topDownY) - radius) * scaleY;
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