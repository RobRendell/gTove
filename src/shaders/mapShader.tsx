import * as React from 'react';
import * as THREE from 'three';

const vertex_shader: string = (`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragment_shader: string = (`
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
void main() {
    if (!textureReady) {
        gl_FragColor = vec4(0.8, 0.8, 0.8, opacity);
    } else {
        vec2 quantised = vec2((floor(vUv.x * mapWidth + dx) + 0.5) / fogWidth, (floor(vUv.y * mapHeight + dy) + 0.5) / fogHeight);
        vec4 fog = texture2D(fogOfWar, quantised);
        vec4 pix = texture2D(texture1, vUv);

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

export default function getMapShaderMaterial(texture: THREE.Texture | null, opacity: number, mapWidth: number, mapHeight: number,
                                             transparentFog: boolean, fogOfWar: THREE.Texture | undefined, dx: number, dy: number) {
    const fogWidth = fogOfWar && fogOfWar.image.width;
    const fogHeight = fogOfWar && fogOfWar.image.height;
    // Textures have their origin at the bottom left corner, so dx and dy need to be transformed from being the offset
    // (in tiles) from the top left of the map image to the nearest grid intersection on the map image (in the positive
    // direction) to being the offset (in tiles) from the bottom left of the fogOfWar overlay to the bottom left corner
    // of the map image.  Each pixel in fogOfWar will be scaled to cover a whole tile on the map image.
    return (
        <shaderMaterial
            vertexShader={vertex_shader}
            fragmentShader={fragment_shader}
            transparent={opacity < 1.0}
        >
            <uniforms>
                <uniform type='b' name='textureReady' value={texture !== null} />
                <uniform type='b' name='useFogOfWar' value={fogOfWar !== undefined} />
                <uniform type='t' name='texture1' value={texture} />
                <uniform type='f' name='opacity' value={opacity}/>
                <uniform type='f' name='mapWidth' value={mapWidth}/>
                <uniform type='f' name='mapHeight' value={mapHeight}/>
                <uniform type='b' name='transparentFog' value={transparentFog} />
                <uniform type='t' name='fogOfWar' value={fogOfWar}/>
                <uniform type='f' name='fogWidth' value={fogWidth}/>
                <uniform type='f' name='fogHeight' value={fogHeight}/>
                <uniform type='f' name='dx' value={1 - dx}/>
                <uniform type='f' name='dy' value={fogHeight && (fogHeight - mapHeight - 1 + dy)}/>
            </uniforms>
        </shaderMaterial>
    );
}