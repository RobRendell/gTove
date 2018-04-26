declare module JSX {

    interface IntrinsicElements {
        'shaderMaterial': any,
        'uniforms': any,
        'uniform': any,
        'group': any,
        'mesh': any,
        'boxGeometry': any,
        'extrudeGeometry': any,
        'resources': any,
        'shape': any,
        'moveTo': any,
        'lineTo': any,
        'quadraticCurveTo': any,
        'absArc': any,
        'shapeResource': any,
        'arrowHelper': any,
        'meshPhongMaterial': any,
        'scene': any,
        'perspectiveCamera': any,
        'ambientLight': any
    }

}

declare module 'react-three-renderer' {
    const React3: any;
    export default React3;
}