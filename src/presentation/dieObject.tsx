import * as React from 'react';
import {useMemo} from 'react';
import * as THREE from 'three';
import {Face3, Geometry} from 'three-stdlib/deprecated/Geometry'

// A lof of this code comes from https://github.com/byWulf/threejs-dice (which seems to be inactive and using an older
// version of THREE).

export interface DieObjectProps {
    type: string;
    size?: number;
    fontColour?: string;
    dieColour?: string;
    dieRef?: any;
    hidden?: boolean;
    userData?: any;
    highlightFace?: number;
}

type TextTextureFn = (text: string, context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, textureSize: number) => void;

interface DieObjectParameters {
    tab: number;
    af: number;
    chamfer: number;
    vertices: number[][];
    faces: number[][];
    scaleFactor: number;
    values: number;
    faceTexts: string[];
    textMargin: number;
    invertUpside?: boolean;
    customTextFn?: TextTextureFn;
    faceToValue: (face: number) => number;
    dieName?: string;
    geometry?: THREE.BufferGeometry;
}

// Some convenience values for calculating die verticies
const p = (1 + Math.sqrt(5)) / 2;
const q = 1 / p;

function identity(face: number) {
    return face;
}

export const dieTypeToParams: {[type: string]: DieObjectParameters} = {
    'd4': {
        tab: -0.1,
        af: Math.PI * 7 / 6,
        chamfer: 0.96,
        vertices: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]],
        faces: [[1, 0, 2, 1], [0, 1, 3, 2], [0, 3, 2, 3], [1, 2, 3, 4]],
        scaleFactor: 1.2,
        values: 4,
        faceTexts: ['2,4,3', '1,3,4', '2,1,4', '1,2,3'],
        textMargin: 2,
        invertUpside: true,
        customTextFn: (numbers, context, canvas, textureSize) => {
            for (let text of numbers.split(/,/)) {
                context.fillText(text, canvas.width / 2, canvas.height / 2 - textureSize * 0.3);
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(Math.PI * 2 / 3);
                context.translate(-canvas.width / 2, -canvas.height / 2);
            }
        },
        faceToValue: identity
    },
    'd6': {
        tab: 0.1,
        af: Math.PI / 4,
        chamfer: 0.96,
        vertices: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
        faces: [[0, 3, 2, 1, 1], [1, 2, 6, 5, 2], [0, 1, 5, 4, 3], [3, 7, 6, 2, 4], [0, 4, 7, 3, 5], [4, 5, 6, 7, 6]],
        scaleFactor: 0.9,
        values: 6,
        faceTexts: ['1', '2', '3', '4', '5', '6'],
        textMargin: 1.0,
        faceToValue: identity
    },
    'd8': {
        tab: 0,
        af: -Math.PI / 4 / 2,
        chamfer: 0.965,
        vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
        faces: [[0, 2, 4, 1], [0, 4, 3, 2], [0, 3, 5, 3], [0, 5, 2, 4],
            [1, 3, 4, 5], [1, 4, 2, 6], [1, 2, 5, 7], [1, 5, 3, 8]],
        scaleFactor: 1,
        values: 8,
        faceTexts: ['1', '2', '3', '4', '5', '6', '7', '8'],
        textMargin: 1.2,
        faceToValue: identity
    },
    'd10': {
        tab: 0,
        af: Math.PI * 6 / 5,
        chamfer: 0.945,
        vertices: [...Array(10).keys()].map((index) => (
            [
                Math.cos(+index * Math.PI / 5),
                Math.sin(+index * Math.PI / 5),
                0.105 * ((+index & 1) ? 1 : -1)
            ]
        )).concat([[0, 0, -1], [0, 0, 1]]),
        faces: [[9, 1, 11, 1], [4, 2, 10, 2], [5, 7, 11, 3], [0, 8, 10, 4], [1, 3, 11, 5],
            [8, 6, 10, 6], [2, 0, 10, 8], [3, 5, 11, 7], [7, 9, 11, 9], [6, 4, 10, 10],
            [1, 0, 2, 0], [1, 2, 3, 0], [3, 2, 4, 0], [3, 4, 5, 0], [5, 4, 6, 0],
            [5, 6, 7, 0], [7, 6, 8, 0], [7, 8, 9, 0], [9, 8, 0, 0], [9, 0, 1, 0]],
        scaleFactor: 0.9,
        values: 10,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10'],
        textMargin: 1.0,
        faceToValue: identity
    },
    'd12': {
        tab: 0.2,
        af: -Math.PI / 4 / 2,
        chamfer: 0.968,
        vertices: [[0, q, p], [0, q, -p], [0, -q, p], [0, -q, -p], [p, 0, q],
            [p, 0, -q], [-p, 0, q], [-p, 0, -q], [q, p, 0], [q, -p, 0], [-q, p, 0],
            [-q, -p, 0], [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1],
            [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]],
        faces: [[2, 14, 4, 12, 0, 1], [6, 18, 2, 0, 16, 2], [0, 12, 8, 10, 16, 3], [13, 8, 12, 4, 5, 4],
            [5, 4, 14, 9, 15, 5], [18, 11, 9, 14, 2, 6], [1, 17, 10, 8, 13, 7], [16, 10, 17, 7, 6, 8],
            [6, 7, 19, 11, 18, 9], [15, 9, 11, 19, 3, 10], [1, 13, 5, 15, 3, 11], [3, 19, 7, 17, 1, 12]],
        scaleFactor: 0.8,
        values: 12,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10', '11', '12'],
        textMargin: 1.0,
        faceToValue: identity
    },
    'd20': {
        tab: -0.2,
        af: -Math.PI / 4 / 2,
        chamfer: 0.955,
        vertices: [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0],
            [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p],
            [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]],
        faces: [[0, 11, 5, 1], [3, 8, 9, 2], [11, 10, 2, 3], [7, 1, 8, 4], [1, 5, 9, 5],
            [10, 7, 6, 6], [5, 11, 4, 7], [3, 2, 6, 8], [0, 7, 10, 9], [3, 4, 2, 10],
            [0, 1, 7, 11], [3, 9, 4, 12], [0, 5, 1, 13], [8, 6, 7, 14], [4, 9, 5, 15],
            [6, 2, 10, 16], [2, 4, 11, 17], [9, 8, 1, 18], [0, 10, 11, 19], [3, 6, 8, 20]],
        scaleFactor: 0.9,
        values: 20,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '10',
            '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
        textMargin: 1.0,
        faceToValue: identity
    },
    'd%': {
        tab: 0,
        af: Math.PI * 6 / 5,
        chamfer: 0.945,
        vertices: [...Array(10).keys()].map((index) => (
            [
                Math.cos(+index * Math.PI / 5),
                Math.sin(+index * Math.PI / 5),
                0.105 * ((+index & 1) ? 1 : -1)
            ]
        )).concat([[0, 0, -1], [0, 0, 1]]),
        faces: [[9, 1, 11, 1], [4, 2, 10, 2], [5, 7, 11, 3], [0, 8, 10, 4], [1, 3, 11, 5],
            [8, 6, 10, 6], [2, 0, 10, 8], [3, 5, 11, 7], [7, 9, 11, 9], [6, 4, 10, 10],
            [1, 0, 2, 0], [1, 2, 3, 0], [3, 2, 4, 0], [3, 4, 5, 0], [5, 4, 6, 0],
            [5, 6, 7, 0], [7, 6, 8, 0], [7, 8, 9, 0], [9, 8, 0, 0], [9, 0, 1, 0]],
        scaleFactor: 0.9,
        values: 10,
        faceTexts: ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'],
        textMargin: 1.5,
        faceToValue: (face) => (10 * (face - 1))
    },
    'd10.0': {
        tab: 0,
        af: Math.PI * 6 / 5,
        chamfer: 0.945,
        vertices: [...Array(10).keys()].map((index) => (
            [
                Math.cos(+index * Math.PI / 5),
                Math.sin(+index * Math.PI / 5),
                0.105 * ((+index & 1) ? 1 : -1)
            ]
        )).concat([[0, 0, -1], [0, 0, 1]]),
        faces: [[9, 1, 11, 1], [4, 2, 10, 2], [5, 7, 11, 3], [0, 8, 10, 4], [1, 3, 11, 5],
            [8, 6, 10, 6], [2, 0, 10, 8], [3, 5, 11, 7], [7, 9, 11, 9], [6, 4, 10, 10],
            [1, 0, 2, 0], [1, 2, 3, 0], [3, 2, 4, 0], [3, 4, 5, 0], [5, 4, 6, 0],
            [5, 6, 7, 0], [7, 6, 8, 0], [7, 8, 9, 0], [9, 8, 0, 0], [9, 0, 1, 0]],
        scaleFactor: 0.9,
        values: 10,
        faceTexts: ['1', '2', '3', '4', '5', '6.', '7', '8', '9.', '0'],
        textMargin: 1.0,
        faceToValue: (face) => (face % 10),
        dieName: 'd%'
    }
};

function getChamferGeometry(vectors: THREE.Vector3[], faces: number[][], chamfer: number) {
    let chamferVectors = [], chamferFaces = [], cornerFaces = new Array(vectors.length);
    for (let i = 0; i < vectors.length; ++i)
        cornerFaces[i] = [];
    for (let i = 0; i < faces.length; ++i) {
        let ii = faces[i], fl = ii.length - 1;
        let center_point = new THREE.Vector3();
        let face = new Array(fl);
        for (let j = 0; j < fl; ++j) {
            let vv = vectors[ii[j]].clone();
            center_point.add(vv);
            cornerFaces[ii[j]].push(face[j] = chamferVectors.push(vv) - 1);
        }
        center_point.divideScalar(fl);
        for (let j = 0; j < fl; ++j) {
            let vv = chamferVectors[face[j]];
            vv.subVectors(vv, center_point).multiplyScalar(chamfer).addVectors(vv, center_point);
        }
        face.push(ii[fl]);
        chamferFaces.push(face);
    }
    for (let i = 0; i < faces.length - 1; ++i) {
        for (let j = i + 1; j < faces.length; ++j) {
            let pairs = [], lastm = -1;
            for (let m = 0; m < faces[i].length - 1; ++m) {
                let n = faces[j].indexOf(faces[i][m]);
                if (n >= 0 && n < faces[j].length - 1) {
                    if (lastm >= 0 && m !== lastm + 1) pairs.unshift([i, m], [j, n]);
                    else pairs.push([i, m], [j, n]);
                    lastm = m;
                }
            }
            if (pairs.length !== 4) continue;
            chamferFaces.push([chamferFaces[pairs[0][0]][pairs[0][1]],
                chamferFaces[pairs[1][0]][pairs[1][1]],
                chamferFaces[pairs[3][0]][pairs[3][1]],
                chamferFaces[pairs[2][0]][pairs[2][1]], 0]);
        }
    }
    for (let i = 0; i < cornerFaces.length; ++i) {
        let cf = cornerFaces[i], face = [cf[0]], count = cf.length - 1;
        while (count) {
            for (let m = faces.length; m < chamferFaces.length; ++m) {
                let index = chamferFaces[m].indexOf(face[face.length - 1]);
                if (index >= 0 && index < 4) {
                    if (--index === -1) index = 3;
                    let next_vertex = chamferFaces[m][index];
                    if (cf.indexOf(next_vertex) >= 0) {
                        face.push(next_vertex);
                        break;
                    }
                }
            }
            --count;
        }
        face.push(0);
        chamferFaces.push(face);
    }
    return {vectors: chamferVectors, faces: chamferFaces};
}

function makeBufferGeometry(vertices: THREE.Vector3[], faces: number[][], radius: number, tab: number, af: number) {
    let geom = new Geometry();
    geom.vertices = vertices.map((vertex) => (vertex.multiplyScalar(radius)));
    for (let face of faces) {
        let lastFaceIndex = face.length - 1;
        let aa = Math.PI * 2 / lastFaceIndex;
        for (let j = 0; j < lastFaceIndex - 2; ++j) {
            geom.faces.push(new Face3(face[0], face[j + 1], face[j + 2], [geom.vertices[face[0]],
                geom.vertices[face[j + 1]], geom.vertices[face[j + 2]]], undefined, face[lastFaceIndex]));
            geom.faceVertexUvs[0].push([
                new THREE.Vector2((Math.cos(af) + 1 + tab) / 2 / (1 + tab),
                    (Math.sin(af) + 1 + tab) / 2 / (1 + tab)),
                new THREE.Vector2((Math.cos(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab),
                    (Math.sin(aa * (j + 1) + af) + 1 + tab) / 2 / (1 + tab)),
                new THREE.Vector2((Math.cos(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab),
                    (Math.sin(aa * (j + 2) + af) + 1 + tab) / 2 / (1 + tab))]);
        }
    }
    geom.computeFaceNormals();
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
    return geom.toBufferGeometry();
}

function calculateTextureSize(approx: number): number {
    return Math.max(128, Math.pow(2, Math.floor(Math.log(approx) / Math.log(2))));
}

function createTextTexture(text: string, fontColor: string, backgroundColor: string, size: number, textMargin: number,
                           textFn?: TextTextureFn): THREE.Texture {
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    if (!context) {
        throw new Error('Unable to get 2d context');
    }
    let textureSize = calculateTextureSize(size / 2 + size * textMargin) * 2;
    canvas.width = canvas.height = textureSize;
    context.font = textureSize / (1 + 2 * textMargin) + "pt Arial";
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = fontColor;
    if (textFn) {
        textFn(text, context, canvas, textureSize);
    } else {
        context.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    let texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export default function DieObject(props: DieObjectProps): React.ReactElement | null {

    const size = props.size || 1;
    const fontColour = props.fontColour || 'white';
    const dieColour = props.dieColour || 'black';
    const highlightFace = props.highlightFace;

    const params = dieTypeToParams[props.type];
    if (!params) {
        throw new Error('Unknown die type ' + props.type);
    }

    const geometry = useMemo(() => {
        if (!params.geometry) {
            const vectors = params.vertices.map((vertex) => (new THREE.Vector3().fromArray(vertex).normalize()));
            const chamferGeometry = getChamferGeometry(vectors, params.faces, params.chamfer);
            const radius = size * params.scaleFactor;
            params.geometry = makeBufferGeometry(chamferGeometry.vectors, chamferGeometry.faces, radius, params.tab, params.af);
        }
        return params.geometry;
    }, [params, size]);

    const fadeFontColour = useMemo(() => {
        // Ensure fontColour is in hex format, then add alpha.
        const colour = new THREE.Color(fontColour);
        return '#' + colour.getHexString() + '33';
    }, [fontColour]);

    const material = useMemo(() => {
        return [''].concat(params.faceTexts)
            .map((text, index) => (createTextTexture(text,
                (!params.invertUpside && highlightFace && index !== highlightFace) ? fadeFontColour : fontColour,
                dieColour, size, params.textMargin, params.customTextFn)))
            .map((texture) => (new THREE.MeshPhongMaterial({
                specular: 0x172022,
                shininess: 40,
                flatShading: true,
                map: texture
            })));
    }, [params, size, fadeFontColour, fontColour, dieColour, highlightFace]);

    return (
        <mesh geometry={geometry} material={material} ref={props.dieRef} visible={!props.hidden} userData={props.userData} />
    );
};
