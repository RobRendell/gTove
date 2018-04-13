import React from 'react';
import * as THREE from 'three';

const uniforms = {
        c: {type: 'f', value: 0.7},
        glowColor: {type: 'c', value: new THREE.Color(0xffff00)},
        viewVector: {type: 'v3', value: new THREE.Vector3(0.0, 0.0, 1.0)}
    };

const vertex_shader = (`
uniform vec3 viewVector;
uniform float c;
varying float intensity;
void main() {
    vec3 vNormal = normalMatrix * normal;
    intensity = c - abs(dot(vNormal, viewVector));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragment_shader = (`
uniform vec3 glowColor;
varying float intensity;
void main() {
    vec3 glow = glowColor * intensity;
    gl_FragColor = vec4(glow, 1.0);
}
`);

export default function getHighlightShaderMaterial() {
    return (
        <shaderMaterial
            uniforms={uniforms}
            vertexShader={vertex_shader}
            fragmentShader={fragment_shader}
            blending={THREE.AdditiveBlending}
            transparent
        />
    );
}