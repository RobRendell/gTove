import * as React from 'react';
import * as THREE from 'three';
import {useFrame} from '@react-three/fiber';

import {isVideoTexture} from '../util/threeUtils';
import {GridType} from '../util/storage/storageContract';
import {getShaderFogOffsets} from '../util/scenarioUtils';

const vertexShader: string = (`
varying vec2 vUv;
void main() {
    vUv = uv;
    if (normal.y < 0.0) {
        // Flip texture vertically if we're looking up at the map from below.
        vUv.y = 1.0 - vUv.y;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragmentShaderHead = (`
varying vec2 vUv;
uniform bool textureReady;
uniform bool useFogOfWar;
uniform sampler2D texture1;
uniform float opacity;
uniform float mapWidth;
uniform float mapHeight;
uniform bool gmView;
uniform bool transparentFog;
uniform sampler2D fogOfWar;
uniform float fogWidth;
uniform float fogHeight;
uniform float dx;
uniform float dy;
uniform bool usePaintTexture;
uniform sampler2D paintTexture;
void main() {
    vec2 fogPos = vec2(vUv.x * mapWidth + dx, vUv.y * mapHeight + dy);
`);

const fragmentShaderFoot = (`
    vec2 quantised = vec2((floor(fogPos.x) + 0.5) / fogWidth, (floor(fogPos.y) + 0.5) / fogHeight);
    vec4 fog = texture2D(fogOfWar, quantised);
    vec4 pix = textureReady ? texture2D(texture1, vUv) : vec4(0.2, 0.4, 0.2, 1);

    // For debugging - show the full fog map, scale down texture1
    // vec2 quantised = vec2((floor(vUv.x * fogWidth) + 0.5) / fogWidth, (floor(vUv.y * fogHeight) + 0.5) / fogWidth);
    // vec4 fog = texture2D(fogOfWar, quantised);
    // vec2 scaled = vec2((vUv.x * fogWidth - dx) / mapWidth, (vUv.y * fogHeight - dy) / mapHeight);
    // vec4 pix = (scaled.x < 0.0 || scaled.x > 1.0 || scaled.y < 0.0 || scaled.y > 1.0) ? vec4(0.0, 0.0, 0.0, opacity) : texture2D(texture1, scaled);

    if (usePaintTexture) {
        vec4 paint = texture2D(paintTexture, vUv);
        pix = mix(pix, paint, paint.a);
    }

    pix.a *= opacity;
    if (useFogOfWar && fog.a < 0.5) {
        if (gmView) {
            pix = mix(pix, vec4(0.8, 0.8, 0.8, opacity), 0.7);
        } else if (transparentFog) {
            pix = vec4(0., 0., 0., 0.);
        } else {
            pix = vec4(0.8, 0.8, 0.8, opacity);
        }
    }
    gl_FragColor = pix;
}
`);

const fragmentShaderHexHorz = (`
    fogPos.y *= 2.0 / sqrt(3.0);
    vec2 hexSquareGrid = fogPos * vec2(2.0, 3.0);
    float oddRow = floor(mod(fogPos.y + fogHeight + 1.0, 2.0));
    fogPos.x += 0.5 * oddRow;
    if (floor(mod(hexSquareGrid.y, 3.0)) > 1.0) {
        vec2 lines = hexSquareGrid - floor(hexSquareGrid);
        float hexHalf = floor(mod(hexSquareGrid.x + oddRow, 2.0));
        float outside = hexHalf * step(1.0 - lines.x, lines.y) + (1.0 - hexHalf) * step(lines.x, lines.y);
        fogPos.x -= outside * (oddRow - hexHalf);
        fogPos.y += outside;
    }
`);

const fragmentShaderHexVert = (`
    fogPos.x *= 2.0 / sqrt(3.0);
    vec2 hexSquareGrid = fogPos * vec2(3.0, 2.0);
    float oddCol = floor(mod(fogPos.x, 2.0));
    fogPos.y += 0.5 * oddCol;
    if (floor(mod(hexSquareGrid.x, 3.0)) > 1.0) {
        vec2 lines = hexSquareGrid - floor(hexSquareGrid);
        float hexHalf = floor(mod(hexSquareGrid.y + oddCol, 2.0));
        float outside = hexHalf * step(1.0 - lines.y, lines.x) + (1.0 - hexHalf) * step(lines.y, lines.x);
        fogPos.x += outside;
        fogPos.y -= outside * (oddCol - hexHalf);
    }
`);

const shaderCode: Partial<Record<GridType, string>> = {
    [GridType.HEX_HORZ]: fragmentShaderHead + fragmentShaderHexHorz + fragmentShaderFoot,
    [GridType.HEX_VERT]: fragmentShaderHead + fragmentShaderHexVert + fragmentShaderFoot
}

interface MapShaderProps {
    texture: THREE.Texture | THREE.VideoTexture | null;
    opacity: number;
    mapWidth: number;
    mapHeight: number;
    gmView: boolean;
    fogOfWar?: THREE.Texture;
    dx: number;
    dy: number;
    paintTexture?: THREE.Texture;
    transparent: boolean;
    gridType: GridType;
}

export default function MapShaderMaterial({texture, opacity, mapWidth, mapHeight, gmView, fogOfWar, dx, dy, paintTexture, transparent, gridType}: MapShaderProps) {
    useFrame(({invalidate}) => {
        if (isVideoTexture(texture)) {
            // Video textures require constant updating
            invalidate();
        }
    });
    const fogWidth = fogOfWar && fogOfWar.image.width;
    const fogHeight = fogOfWar && fogOfWar.image.height;
    const uniforms = React.useMemo(() => {
        const {shaderDX, shaderDY} = getShaderFogOffsets(gridType, dx, dy, mapWidth, mapHeight, fogWidth, fogHeight);
        return {
            textureReady: {value: texture !== null, type: 'b'},
            useFogOfWar: {value: fogOfWar !== undefined, type: 'b'},
            texture1: {value: texture, type: 't'},
            opacity: {value: opacity, type: 'f'},
            mapWidth: {value: mapWidth, type: 'f'},
            mapHeight: {value: mapHeight, type: 'f'},
            gmView: {value: gmView, type: 'b'},
            transparentFog: {value: transparent, type: 'b'},
            fogOfWar: {value: fogOfWar, type: 'f'},
            fogWidth: {value: fogWidth, type: 'f'},
            fogHeight: {value: fogHeight, type: 'f'},
            dx: {value: shaderDX, type: 'f'},
            dy: {value: shaderDY, type: 'f'},
            usePaintTexture: {value: paintTexture !== undefined, type: 'b'},
            paintTexture: {value: paintTexture, type: 't'},
        };
    }, [gridType, dx, dy, mapWidth, mapHeight, fogWidth, fogHeight, texture, fogOfWar, opacity, gmView, transparent, paintTexture]);
    const fragmentShader = shaderCode[gridType] || (fragmentShaderHead + fragmentShaderFoot);
    return (
        <shaderMaterial attach='material' args={[{uniforms, vertexShader, fragmentShader, transparent: (transparent || opacity < 1.0)}]} />
    );
}