import * as React from 'react';
import * as THREE from 'three';

const VIEW_VECTOR = new THREE.Vector3(0.0, 0.0, 1.0);

const vertex_shader: string = (`
uniform vec3 viewVector;
uniform float intensityFactor;
varying float intensity;
void main() {
    vec3 vNormal = normalMatrix * normal;
    intensity = intensityFactor - abs(dot(vNormal, viewVector));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragment_shader: string = (`
uniform vec3 glowColor;
varying float intensity;
void main() {
    vec3 glow = glowColor * intensity;
    gl_FragColor = vec4(glow, 1.0);
}
`);

export default function getHighlightShaderMaterial(colour: THREE.Color, intensityFactor: number) {
    return (
        <shaderMaterial
            vertexShader={vertex_shader}
            fragmentShader={fragment_shader}
            blending={THREE.AdditiveBlending}
            transparent={true}
        >
            <uniforms>
                <uniform type='f' name='intensityFactor' value={intensityFactor}/>
                <uniform type='c' name='glowColor' value={colour}/>
                <uniform type='f' name='viewVector' value={VIEW_VECTOR}/>
            </uniforms>
        </shaderMaterial>
    );
}