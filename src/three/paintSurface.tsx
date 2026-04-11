import {useGranularEffect} from 'granular-hooks';
import {produce} from 'immer';
import {FunctionComponent, useEffect, useMemo, useRef} from 'react';
import {useSelector} from 'react-redux';
import {Box2, CanvasTexture, CircleGeometry, Euler, MathUtils, Texture, Vector2, Vector3} from 'three';

import {PaintToolEnum} from '../presentation/paintTools';
import {getTabletopStateFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp} from '../redux/mainReducerTypes';
import {setMapPaintLayersAction, undoGroupThunk, updateMapPaintLayerAction} from '../redux/scenarioReducer';
import {isValueInRange} from '../util/mathsUtils';
import {MapPaintLayer, MapPaintOperation, ObjectVector2} from '../util/scenarioUtils';
import {reverseEuler} from '../util/threeUtils';

const brushCompositeOperation: {[brush in PaintToolEnum]: GlobalCompositeOperation} = {
    [PaintToolEnum.NONE]: 'color',
    [PaintToolEnum.PAINT_BRUSH]: 'source-over',
    [PaintToolEnum.LINE_TOOL]: 'source-over',
    [PaintToolEnum.ERASER]: 'destination-out',
    [PaintToolEnum.CLEAR]: 'difference'
}

interface PaintSurfaceProps extends GtoveDispatchProp {
    mapId: string;
    position: Vector3;
    rotation: Euler;
    width: number;
    height: number;
    paintTexture?: Texture;
    setPaintTexture: (texture?: Texture) => void;
    paintLayers: MapPaintLayer[];
}

function map3DPointToCanvasPosition(toolPosition: Vector3 | undefined, position: Vector3, rotation: Euler,
                            width: number, height: number): Vector2 | undefined {
    if (!toolPosition) {
        return undefined;
    }
    const vector3 = toolPosition.clone().sub(position)
        .applyEuler(reverseEuler(rotation))
        .add(new Vector3(width / 2, 0, height / 2));
    return new Vector2(vector3.x, vector3.z);
}

const PaintSurface: FunctionComponent<PaintSurfaceProps> = ({dispatch, mapId, position, rotation, width, height, paintTexture, setPaintTexture, paintLayers}) => {
    const {paintState} = useSelector(getTabletopStateFromStore);
    const {toolPosition, toolPositionStart, brushSize} = paintState;

    // Width and height should never be less than 1...
    width = Math.max(width, 1);
    height = Math.max(height, 1);

    // Only create a paint texture if there's some painting to render.
    const anyPainting = paintLayers.some((layer) => (layer.operations.length > 0));
    const {context, texture} = useMemo(() => {
        if (!anyPainting) {
            return {canvas: undefined, context: undefined, texture: undefined};
        }
        // Higher canvasScale makes painted lines less pixelated, but makes a larger texture
        const maxDimension = Math.max(width, height);
        const canvasScale = Math.max(5, Math.min(32, 2048 / maxDimension));
        const canvas = document.createElement('canvas');
        // Canvas needs to have dimensions which are powers of 2
        canvas.width = MathUtils.ceilPowerOfTwo(width * canvasScale);
        canvas.height = MathUtils.ceilPowerOfTwo(height * canvasScale);
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2d canvas context');
        }
        context.scale(canvas.width / width, canvas.height / height);
        const texture = new CanvasTexture(canvas);
        return {canvas, context, texture};
    }, [anyPainting, width, height]);
    useEffect(() => {
        if (texture !== paintTexture) {
            setPaintTexture(texture);
        }
    }, [texture, paintTexture, setPaintTexture]);

    const canvasPositionStart = useMemo(() => (
        map3DPointToCanvasPosition(toolPositionStart, position, rotation, width, height)
    ), [toolPositionStart, position, rotation, width, height]);
    const canvasPosition = useMemo(() => (
        map3DPointToCanvasPosition(toolPosition, position, rotation, width, height)
    ), [toolPosition, position, rotation, width, height]);

    // Track bounding boxes for paint operations, to assist with selecting them.
    const layerOperationBoxRef = useRef<{[layer: number]: {points: ObjectVector2[]; box: Box2}[]}>({});
    useEffect(() => {
        for (let layerIndex = 0; layerIndex < paintLayers.length; layerIndex++) {
            if (!layerOperationBoxRef.current[layerIndex]) {
                layerOperationBoxRef.current[layerIndex] = [];
            }
            for (let operationIndex = 0; paintLayers[layerIndex]?.operations && operationIndex < paintLayers[layerIndex].operations.length; operationIndex++) {
                let current = layerOperationBoxRef.current[layerIndex][operationIndex];
                if (!current || current.points !== paintLayers[layerIndex].operations[operationIndex].points) {
                    current = {
                        points: paintLayers[layerIndex].operations[operationIndex].points,
                        box: new Box2()
                    };
                    layerOperationBoxRef.current[layerIndex][operationIndex] = current;
                }
                current.box.setFromPoints(paintLayers[layerIndex].operations[operationIndex].points as Vector2[]);
                current.box.expandByScalar(paintLayers[layerIndex].operations[operationIndex].brushSize / 2);
            }
            if (layerOperationBoxRef.current[layerIndex].length > paintLayers[layerIndex].operations.length) {
                layerOperationBoxRef.current[layerIndex].length = paintLayers[layerIndex].operations.length;
            }
        }
    }, [paintLayers]);

    // Hefty logic to handle selecting paint operations by intersecting them with the line being currently painted.
    const selectBoxRef = useRef(new Box2());
    const selectedOperationsRef = useRef<undefined | {[layer: number]: {[operation: number]: boolean}}>();
    useGranularEffect(() => {
        if (paintState.selected !== PaintToolEnum.CLEAR) {
            selectBoxRef.current.makeEmpty();
            selectedOperationsRef.current = undefined;
        } else if (canvasPositionStart && canvasPosition) {
            // Use AABB intersection tests to quickly eliminate painting that clearly doesn't intersect.
            selectBoxRef.current.set(canvasPositionStart, canvasPositionStart);
            selectBoxRef.current.expandByPoint(canvasPosition);
            selectBoxRef.current.expandByScalar(paintState.brushSize / 2);
            // Compute factors needed to do actual segment intersection tests, and exit early if the start and current points are equal.
            const deltaX = canvasPosition.x - canvasPositionStart.x;
            const deltaY = canvasPosition.y - canvasPositionStart.y;
            const lengthSq = deltaX * deltaX + deltaY * deltaY;
            const length = Math.sqrt(lengthSq);
            if (lengthSq === 0) {
                return;
            }
            // For operations whose box intersects, we'll need to do segment-by-segment tests. Precompute the parameters
            // of the infinite line passing through canvasPositionStart and canvasPosition, such that
            // lineXFactor * x + lineYFactor * y + lineConstant = 0.
            const lineXFactor = canvasPositionStart.y - canvasPosition.y;
            const lineYFactor = canvasPosition.x - canvasPositionStart.x;
            const lineConstant = canvasPositionStart.x * canvasPosition.y - canvasPositionStart.y * canvasPosition.x;
            // Also precompute the denominator needed to compute the (signed) distance to this infinite line from an
            // arbitrary point, such that distance = (lineXFactor * x + lineYFactor * y + lineConstant) / lineDivisor
            const lineDivisor = Math.sqrt(lineXFactor * lineXFactor + lineYFactor * lineYFactor);

            // Perform intersection tests for all paint operations.
            const nextSelectedOperations: {[layer: number]: {[operation: number]: boolean}} = {};
            paintLayers.forEach((layer, layerIndex) => {
                if (!layer?.operations) {
                    return;
                }
                nextSelectedOperations[layerIndex] = nextSelectedOperations[layerIndex] ?? {};
                layer.operations.forEach((operation, operationIndex) => {
                    const currentBox = layerOperationBoxRef.current[layerIndex]?.[operationIndex]?.box;
                    if (operation.selected === PaintToolEnum.CLEAR) {
                        // Don't bother computing intersections on the clear line itself, just mark it as selected.
                        nextSelectedOperations[layerIndex][operationIndex] = true;
                    } else if (currentBox && selectBoxRef.current?.intersectsBox(currentBox)) {
                        // Boxes intersect, need to do a more detailed intersection test.
                        const combinedBrushSize = (paintState.brushSize + operation.brushSize) / 2;
                        // Because the painted line and the "selection" line have thickness, a `t` parameter which
                        // ranges from 0 to 1 along the line from canvasPositionStart to canvasPosition can be slightly
                        // outside the range [0, 1] and still be considered intersecting.
                        const padding = combinedBrushSize / length;
                        const minT = -padding;
                        const maxT = 1 + padding;
                        for (let index = 0; index < operation.points.length - 1; index++) {
                            const p1 = operation.points[index];
                            const p2 = operation.points[index + 1];
                            const dist1 = (p1.x * lineXFactor + p1.y * lineYFactor + lineConstant) / lineDivisor;
                            const dist2 = (p2.x * lineXFactor + p2.y * lineYFactor + lineConstant) / lineDivisor;
                            // Test if the segment crosses to the region +/- combinedBrushSize from the infinite line.
                            const segmentCrossesTopEdge = (Math.sign(dist1 - combinedBrushSize) !== Math.sign(dist2 - combinedBrushSize));
                            const segmentCrossesBottomEdge = (Math.sign(dist1 + combinedBrushSize) !== Math.sign(dist2 + combinedBrushSize));
                            // Test if p1 lies within the combined brush distance of the infinite line.
                            const p1IsClose = (Math.abs(dist1) <= combinedBrushSize);
                            // Same for p2.
                            const p2IsClose = (Math.abs(dist2) <= combinedBrushSize);
                            if (!segmentCrossesTopEdge && !segmentCrossesBottomEdge && !p1IsClose && !p2IsClose) {
                                // No intersection
                                continue;
                            }
                            // Project the p1 and p2 points onto the infinite line.
                            const t1 = ((p1.x - canvasPositionStart.x) * deltaX + (p1.y - canvasPositionStart.y) * deltaY) / lengthSq;
                            const t2 = ((p2.x - canvasPositionStart.x) * deltaX + (p2.y - canvasPositionStart.y) * deltaY) / lengthSq;
                            // Easy case - the segment's start or end point are near enough to the selection, or they
                            // both do and enclose the selection.
                            let intersects = (
                                (p1IsClose && isValueInRange(t1, minT, maxT))
                                || (p2IsClose && isValueInRange(t2, minT, maxT))
                                || (p1IsClose && p2IsClose && Math.sign(t1) !== Math.sign(t2))
                            );
                            // Otherwise, we're going to need to interpolate to find where the segment approaches within
                            // combinedBrushSize range of the infinite line. We can also eliminate any segment which is
                            // parallel to the selection - the previous test completely determines the intersection of
                            // such a segment - which is fortunate, because it would cause a division by zero here.
                            if (!intersects && dist1 !== dist2) {
                                const distanceSum = Math.abs(dist2) + Math.abs(dist1);
                                const nearT = t1 + (t2 - t1) * (Math.abs(dist1) - combinedBrushSize) / distanceSum;
                                const farT = t1 + (t2 - t1) * (Math.abs(dist1) + combinedBrushSize) / distanceSum;
                                intersects = isValueInRange(nearT, minT, maxT) || isValueInRange(farT, minT, maxT)
                                    || Math.sign(nearT) !== Math.sign(farT);
                            }
                            if (intersects) {
                                nextSelectedOperations[layerIndex][operationIndex] = true;
                                // If this segment intersects, there's no need to test any others.
                                break;
                            }
                        }
                    }
                });
            });
            selectedOperationsRef.current = nextSelectedOperations;
        } else if (selectBoxRef.current && selectedOperationsRef.current) {
            // They've released the gesture. Remove intersecting operations.
            const toClear = selectedOperationsRef.current;
            let operationId: string;
            const nextPaintLayers = produce(paintLayers, (paintLayers) => {
                for (const layerIndex in toClear) {
                    let alreadyDeleted = 0;
                    for (const index in toClear[layerIndex]) {
                        const operationIndex = Number(index);
                        const isClearOperation = (paintLayers[layerIndex].operations[operationIndex - alreadyDeleted].selected === PaintToolEnum.CLEAR);
                        if (isClearOperation) {
                            operationId = paintLayers[layerIndex].operations[operationIndex - alreadyDeleted].operationId;
                        }
                        if (toClear[layerIndex][operationIndex] || isClearOperation) {
                            paintLayers[layerIndex].operations.splice(operationIndex - alreadyDeleted, 1)
                            alreadyDeleted++;
                        }
                    }
                }
            });
            const undoGroupId = operationId! + 'paint'
            dispatch(undoGroupThunk(setMapPaintLayersAction(mapId, nextPaintLayers), undoGroupId));
            selectBoxRef.current.makeEmpty();
            selectedOperationsRef.current = undefined;
            // Recompute all bounding boxes, as the indexes have changed.
            layerOperationBoxRef.current = {};
        }
    }, [canvasPosition, canvasPositionStart, dispatch, mapId, paintState.brushSize, paintState.selected], [paintLayers]);

    // Update paintState when toolPosition changes
    useEffect(() => {
        if (paintState.toolMapId === mapId && paintState.open && canvasPosition && canvasPositionStart) {
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
                    case PaintToolEnum.CLEAR:
                        points = [canvasPositionStart, canvasPosition];
                        break;
                    default:
                        points = [...points, canvasPosition];
                        break;
                }
                const operation: MapPaintOperation = {
                    operationId: paintState.operationId!,
                    selected: paintState.selected,
                    points,
                    brushSize: paintState.brushSize,
                    brushColour: paintState.brushColour
                };
                dispatch(updateMapPaintLayerAction(mapId, layerIndex, opIndex, operation));
            }
        }
    }, [dispatch, mapId, paintState, paintLayers, canvasPosition, canvasPositionStart]);

    // Render changes to the canvas texture.
    useEffect(() => {
        if (context && texture) {
            context.clearRect(0, 0, width, height);
            paintLayers.forEach((layer, layerIndex) => {
                layer.operations.forEach((operation, operationIndex) => {
                    const {selected, brushSize, brushColour, points} = operation;
                    if (points.length > 0) {
                        const selectedForClear = selectedOperationsRef.current?.[layerIndex]?.[operationIndex];
                        context.beginPath();
                        context.globalCompositeOperation = selectedForClear ? 'color' : brushCompositeOperation[selected];
                        context.lineCap = 'round';
                        context.lineJoin = 'round';
                        context.strokeStyle = selected === PaintToolEnum.CLEAR ? '#ff0000bb'
                            : selectedForClear ? brushColour.substring(0, 7) + '77'
                                : brushColour;
                        context.lineWidth = brushSize;
                        context.setLineDash(selected === PaintToolEnum.CLEAR ? [0.25, 0.45] : []);
                        for (let pointIndex = 0; pointIndex < points.length; ++pointIndex) {
                            if (pointIndex === 0) {
                                context.moveTo(points[pointIndex].x, points[pointIndex].y)
                            } else {
                                context.lineTo(points[pointIndex].x, points[pointIndex].y)
                            }
                        }
                        context.stroke();
                    }
                });
            });
            texture.needsUpdate = true;
        }
    }, [width, height, paintLayers, context, texture]);

    // Render a circle at the active paint tool's current point.
    const geometry = useMemo(() => {
        const geometry = new CircleGeometry(brushSize / 2, Math.max(16, Math.ceil(32 * brushSize)));
        geometry.rotateX(Math.PI/2);
        return geometry;
    }, [brushSize]);
    const brushPosition = useMemo(() => (
        !toolPosition ? undefined : toolPosition.clone().sub(position)
    ), [position, toolPosition]);

    return (paintState.selected === PaintToolEnum.NONE || !brushPosition) ? null : (
        <lineSegments position={brushPosition}>
            <edgesGeometry attach='geometry' args={[geometry]}/>
            <lineBasicMaterial attach='material' color='#000000'/>
        </lineSegments>
    );
};

export default PaintSurface;