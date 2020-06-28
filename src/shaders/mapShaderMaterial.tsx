import * as React from 'react';
import * as THREE from 'three';
import {ShaderMaterial} from 'react-three-fiber/components';
import {useFrame} from 'react-three-fiber';

import {isVideoTexture} from '../util/threeUtils';

const vertexShader: string = (`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragmentShader: string = (`
varying vec2 vUv;
uniform bool textureReady;
uniform bool useFogOfWar;
uniform sampler2D texture1;
uniform float opacity;
uniform float mapWidth;
uniform float mapHeight;
uniform bool transparentFog;
uniform sampler2D fogOfWar;
uniform float fogWidth;
uniform float fogHeight;
uniform float dx;
uniform float dy;
uniform bool usePaintTexture;
uniform sampler2D paintTexture;
void main() {
    if (!textureReady) {
        gl_FragColor = vec4(0.8, 0.8, 0.8, opacity);
    } else {
        vec2 quantised = vec2((floor(vUv.x * mapWidth + dx) + 0.5) / fogWidth, (floor(vUv.y * mapHeight + dy) + 0.5) / fogHeight);
        vec4 fog = texture2D(fogOfWar, quantised);
        vec4 pix = texture2D(texture1, vUv);
        if (usePaintTexture) {
            vec4 paint = texture2D(paintTexture, vUv);
            pix = mix(pix, paint, paint.a);
        }

        // For debugging - show the full fog map, scale down texture1
        // vec2 quantised = vec2((floor(vUv.x * fogWidth) + 0.5) / fogWidth, (floor(vUv.y * fogHeight) + 0.5) / fogWidth);
        // vec4 fog = texture2D(fogOfWar, quantised);
        // vec2 scaled = vec2((vUv.x * fogWidth - dx) / mapWidth, (vUv.y * fogHeight - dy) / mapHeight);
        // vec4 pix = (scaled.x < 0.0 || scaled.x > 1.0 || scaled.y < 0.0 || scaled.y > 1.0) ? vec4(0.0, 0.0, 0.0, opacity) : texture2D(texture1, scaled);

        pix.a *= opacity;
        if (useFogOfWar && fog.a < 0.5) {
            if (transparentFog) {
                pix = mix(pix, vec4(0.8, 0.8, 0.8, opacity), 0.7);
            } else {
                pix = vec4(0.8, 0.8, 0.8, opacity);
            }
        }
        gl_FragColor = pix;
    }
}
`);

interface MapShaderProps {
    texture: THREE.Texture | THREE.VideoTexture | null;
    opacity: number;
    mapWidth: number;
    mapHeight: number;
    transparentFog: boolean;
    fogOfWar?: THREE.Texture;
    dx: number;
    dy: number;
    paintTexture?: THREE.Texture;
}

export default function MapShaderMaterial({texture, opacity, mapWidth, mapHeight, transparentFog, fogOfWar, dx, dy, paintTexture}: MapShaderProps) {
    useFrame(({invalidate}) => {
        if (isVideoTexture(texture)) {
            // Video textures require constant updating
            invalidate();
        }
    });
    const fogWidth = fogOfWar && fogOfWar.image.width;
    const fogHeight = fogOfWar && fogOfWar.image.height;
    // Textures have their origin at the bottom left corner, so dx and dy need to be transformed from being the offset
    // (in tiles) from the top left of the map image to the nearest grid intersection on the map image (in the positive
    // direction) to being the offset (in tiles) from the bottom left of the fogOfWar overlay to the bottom left corner
    // of the map image.  Each pixel in fogOfWar will be scaled to cover a whole tile on the map image.
    const uniforms = React.useMemo(() => ({
        textureReady: {value: texture !== null, type: 'b'},
        useFogOfWar: {value: fogOfWar !== undefined, type: 'b'},
        texture1: {value: texture, type: 't'},
        opacity: {value: opacity, type: 'f'},
        mapWidth: {value: mapWidth, type: 'f'},
        mapHeight: {value: mapHeight, type: 'f'},
        transparentFog: {value: transparentFog, type: 'b'},
        fogOfWar: {value: fogOfWar, type: 'f'},
        fogWidth: {value: fogWidth, type: 'f'},
        fogHeight: {value: fogHeight, type: 'f'},
        dx: {value: 1 - dx, type: 'f'},
        dy: {value: fogHeight && (fogHeight - mapHeight - 1 + dy), type: 'f'},
        usePaintTexture: {value: paintTexture !== undefined, type: 'b'},
        paintTexture: {value: paintTexture, type: 't'}
    }), [texture, fogOfWar, opacity, mapWidth, mapHeight, transparentFog, fogWidth, fogHeight, dx, dy, paintTexture]);
    return (
        <ShaderMaterial attach='material' args={[{uniforms, vertexShader, fragmentShader, transparent: opacity < 1.0}]} />
    );
}