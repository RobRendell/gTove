import * as THREE from 'three';
import {useMemo} from 'react';

const VIEW_VECTOR = new THREE.Vector3(0.0, 0.0, 1.0);

const vertexShader: string = (`
uniform vec3 viewVector;
uniform float intensityFactor;
varying float intensity;
void main() {
    vec3 vNormal = normalMatrix * normal;
    intensity = intensityFactor - abs(dot(vNormal, viewVector));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragmentShader: string = (`
uniform vec3 glowColor;
varying float intensity;
void main() {
    vec3 glow = glowColor * intensity;
    gl_FragColor = vec4(glow, 1.0);
}
`);

interface HighlightShaderMaterialProps {
    colour: THREE.Color;
    intensityFactor: number;
}

export default function HighlightShaderMaterial({colour, intensityFactor}: HighlightShaderMaterialProps) {
    const uniforms = useMemo(() => ({
        intensityFactor: {value: intensityFactor, type: 'f'},
        glowColor: {value: colour, type: 'c'},
        viewVector: {value: VIEW_VECTOR, type: 'c'}
    }), [intensityFactor, colour]);
    return (
        <shaderMaterial attach='material' args={[{uniforms, vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending}]} />
    );
}