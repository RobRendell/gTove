import React from 'react';

const vertex_shader = (`
varying vec2 vUv;
varying vec3 vNormal;
void main() {
    vUv = uv;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`);

const fragment_shader = (`
varying vec2 vUv;
uniform bool textureReady;
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
        pix.a *= opacity;
        if (fog.a < 0.5) {
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

export default function getMapShaderMaterial(texture, opacity, mapWidth, mapHeight, transparentFog, fogOfWar, dx, dy) {
    const fogWidth = fogOfWar && fogOfWar.image.width;
    const fogHeight = fogOfWar && fogOfWar.image.height;
    console.log('opacity', opacity);
    return (
        <shaderMaterial
            vertexShader={vertex_shader}
            fragmentShader={fragment_shader}
            transparent={true}
        >
            <uniforms>
                <uniform type='b' name='textureReady' value={texture !== null && fogOfWar !== null} />
                <uniform type='t' name='texture1' value={texture} />
                <uniform type='f' name='opacity' value={opacity}/>
                <uniform type='f' name='mapWidth' value={mapWidth}/>
                <uniform type='f' name='mapHeight' value={mapHeight}/>
                <uniform type='b' name='transparentFog' value={transparentFog} />
                <uniform type='t' name='fogOfWar' value={fogOfWar}/>
                <uniform type='f' name='fogWidth' value={fogWidth}/>
                <uniform type='f' name='fogHeight' value={fogHeight}/>
                <uniform type='f' name='dx' value={1 - dx}/>
                <uniform type='f' name='dy' value={dy}/>
            </uniforms>
        </shaderMaterial>
    );
}