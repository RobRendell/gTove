import {FunctionComponent, useEffect, useMemo} from 'react';
import * as THREE from 'three';

import {PaintState, PaintToolEnum} from './paintTools';
import {reverseEuler} from '../util/threeUtils';
import {GtoveDispatchProp} from '../redux/mainReducer';
import {MapPaintLayer, ObjectVector2} from '../util/scenarioUtils';
import {clearMapPaintLayerAction, updateMapPaintLayerAction} from '../redux/scenarioReducer';

const drawBrush = {
    [PaintToolEnum.PAINT_BRUSH]: true,
    [PaintToolEnum.LINE_TOOL]: true,
    [PaintToolEnum.ERASER]: true
};

interface PaintSurfaceProps extends GtoveDispatchProp {
    mapId: string;
    paintState: PaintState;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    width: number;
    height: number;
    active: boolean;
    paintTexture?: THREE.Texture;
    setPaintTexture: (texture?: THREE.Texture) => void;
    paintLayers: MapPaintLayer[];
}

function map3DPointToCanvasPosition(toolPosition: THREE.Vector3 | undefined, position: THREE.Vector3, rotation: THREE.Euler,
                            width: number, height: number): ObjectVector2 | undefined {
    if (!toolPosition) {
        return undefined;
    }
    const vector3 = toolPosition.clone().sub(position)
        .applyEuler(reverseEuler(rotation))
        .add(new THREE.Vector3(width / 2, 0, height / 2));
    return {x: vector3.x, y: vector3.z};
}

const PaintSurface: FunctionComponent<PaintSurfaceProps> = ({dispatch, mapId, paintState,
                                                                position, rotation, width, height,
                                                                active, paintTexture, setPaintTexture,
                                                                paintLayers}) => {
    // Width and height should never be less than 1...
    width = Math.max(width, 1);
    height = Math.max(height, 1);
    // Only create a paint texture if there's some painting to render.
    const anyPainting = paintLayers.reduce((anyPainting, layer) => (
        anyPainting || layer.operations.length > 0
    ), false);
    const {context, texture} = useMemo(() => {
        if (!anyPainting) {
            return {canvas: undefined, context: undefined, texture: undefined};
        }
        // Higher canvasScale makes painted lines less pixelated, but makes a larger texture
        const maxDimension = Math.max(width, height);
        const canvasScale = Math.max(5, Math.min(32, 2048 / maxDimension));
        const canvas = document.createElement('canvas');
        // Canvas needs to have dimensions which are powers of 2
        canvas.width = THREE.MathUtils.ceilPowerOfTwo(width * canvasScale);
        canvas.height = THREE.MathUtils.ceilPowerOfTwo(height * canvasScale);
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2d canvas context');
        }
        context.scale(canvas.width / width, canvas.height / height);
        const texture = new THREE.CanvasTexture(canvas);
        return {canvas, context, texture};
    }, [anyPainting, width, height]);
    const {toolPosition, toolPositionStart, brushSize} = paintState;
    const canvasPositionStart = useMemo(() => (
        map3DPointToCanvasPosition(toolPositionStart, position, rotation, width, height)
    ), [toolPositionStart, position, rotation, width, height]);
    const canvasPosition = useMemo(() => (
        map3DPointToCanvasPosition(toolPosition, position, rotation, width, height)
    ), [toolPosition, position, rotation, width, height]);
    useEffect(() => {
        if (texture !== paintTexture) {
            setPaintTexture(texture);
        }
    }, [texture, paintTexture, setPaintTexture]);
    useEffect(() => {
        if (active && paintState.open && canvasPosition && canvasPositionStart) {
            if (paintState.selected !== PaintToolEnum.CLEAR) {
                const layerIndex = 0;
                const currentLayer = paintLayers[layerIndex] || {operations: []};
                const opLength = currentLayer.operations.length;
                const opIndex = opLength === 0 ? 0
                    : paintState.operationId === currentLayer.operations[opLength - 1].operationId
                        ? opLength - 1 : opLength;
                let points = currentLayer.operations[opIndex] ? currentLayer.operations[opIndex].points : [canvasPositionStart];
                const lastPoint = points[points.length - 1];
                const distance2 = (lastPoint.x - canvasPosition.x) * (lastPoint.x - canvasPosition.x) + (lastPoint.y - canvasPosition.y) * (lastPoint.y - canvasPosition.y);
                if (!currentLayer.operations[opIndex] || distance2 >= 0.01) {
                    switch (paintState.selected) {
                        case PaintToolEnum.LINE_TOOL:
                            points = [canvasPositionStart, canvasPosition];
                            break;
                        default:
                            points = [...points, canvasPosition];
                            break;
                    }
                    const operation = {
                        operationId: paintState.operationId!,
                        selected: paintState.selected,
                        points,
                        brushSize: paintState.brushSize,
                        brushColour: paintState.brushColour
                    };
                    dispatch(updateMapPaintLayerAction(mapId, layerIndex, opIndex, operation));
                }
            } else if (paintLayers.length > 0) {
                dispatch(clearMapPaintLayerAction(mapId));
            }
        }
    }, [dispatch, mapId, paintState, active, paintLayers, canvasPosition, canvasPositionStart]);
    useEffect(() => {
        if (context && texture) {
            context.clearRect(0, 0, width, height);
            for (let layer of paintLayers) {
                for (let operation of layer.operations) {
                    const {selected, brushSize, brushColour, points} = operation;
                    if (points.length > 0) {
                        context.beginPath();
                        context.globalCompositeOperation = selected === PaintToolEnum.ERASER ? 'destination-out' : 'source-over';
                        context.lineCap = 'round';
                        context.lineJoin = 'round';
                        context.strokeStyle = brushColour;
                        context.lineWidth = brushSize;
                        for (let pointIndex = 0; pointIndex < points.length; ++pointIndex) {
                            if (pointIndex === 0) {
                                context.moveTo(points[pointIndex].x, points[pointIndex].y)
                            } else {
                                context.lineTo(points[pointIndex].x, points[pointIndex].y)
                            }
                        }
                        context.stroke();
                    }
                }
            }
            texture.needsUpdate = true;
        }
    }, [width, height, paintLayers, context, texture]);
    // Actually render something, too!
    const geometry = useMemo(() => {
        const geometry = new THREE.CircleGeometry(brushSize / 2, Math.max(16, Math.ceil(32 * brushSize)));
        geometry.rotateX(Math.PI/2);
        return geometry;
    }, [brushSize]);
    const brushPosition = useMemo(() => (
        !toolPosition ? undefined : toolPosition.clone().sub(position)
    ), [position, toolPosition]);
    if (drawBrush[paintState.selected as keyof typeof drawBrush] && brushPosition) {
        return (
            <lineSegments position={brushPosition}>
                <edgesGeometry attach='geometry' args={[geometry]}/>
                <lineBasicMaterial attach='material' color='#000000'/>
            </lineSegments>
        )
    }
    return null;
};

export default PaintSurface;