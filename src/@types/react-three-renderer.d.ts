declare module JSX {

    interface IntrinsicElements {
        shaderMaterial: any,
        uniforms: any,
        uniform: any,
        group: any,
        mesh: any,
        boxGeometry: any,
        extrudeGeometry: any,
        resources: any,
        shape: any,
        moveTo: any,
        lineTo: any,
        absArc: any,
        quadraticCurveTo: any,
        cylinderGeometry: any,
        shapeResource: any,
        geometryResource: any,
        arrowHelper: any,
        meshPhongMaterial: any,
        scene: any,
        perspectiveCamera: any,
        ambientLight: any,
        sprite: any,
        spriteMaterial: any,
        gridHelper: any,
        geometry: any,
        lineSegments: any,
        lineBasicMaterial: any,
        edgesGeometry: any
    }

}

declare module 'react-three-renderer' {
    const React3: any;
    export default React3;
}