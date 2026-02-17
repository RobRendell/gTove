import {FunctionComponent, memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';
import {BufferGeometry, LineSegments, Vector3} from 'three';

import {getTabletopFromStore} from '../redux/mainReducer';
import {ReduxStoreType} from '../redux/mainReducerTypes';
import {snapNumberToCloseInteger} from '../util/mathsUtils';
import {
    DistanceMode,
    DistanceRound,
    generateMovementPath,
    getGridStride,
    MapPathData,
    MovementPathPoint,
    ObjectVector3,
    TabletopPathPoint
} from '../util/scenarioUtils';
import {GridType} from '../util/storage/storageContract';
import {buildVector3} from '../util/threeUtils';

type Axis = 'x' | 'y' | 'z';

interface BresenhamAxis {
    axis: Vector3;
    step: number;
    sign: number;
    delta: number;
    error: number;
    noStraight?: Axis;
}

function selectTabletopDefaultGridFromStore(state: ReduxStoreType) {
    return getTabletopFromStore(state).defaultGrid;
}

interface TabletopPathComponentProps {
    miniId: string;
    positionObj: ObjectVector3;
    movementPath: MovementPathPoint[];
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    roundToGrid: boolean;
    updateMovedSuffix: (movedSuffix: string) => void;
    mapPathData?: MapPathData;
}

const TabletopPathComponent: FunctionComponent<TabletopPathComponentProps> = memo(({
                                                                                  miniId,
                                                                                  positionObj,
                                                                                  movementPath,
                                                                                  distanceMode,
                                                                                  distanceRound,
                                                                                  gridScale,
                                                                                  gridUnit,
                                                                                  roundToGrid,
                                                                                  updateMovedSuffix,
                                                                                  mapPathData
                                                                              }) => {
    
    const [lineSegments, setLineSegments] = useState<Vector3[]>([]);
    const [movedSuffix, setMovedSuffix] = useState('');

    const defaultGridType = useSelector(selectTabletopDefaultGridFromStore);

    const mapPath = useMemo(() => (
        generateMovementPath(movementPath, mapPathData ?? {}, defaultGridType)
    ), [defaultGridType, mapPathData, movementPath]);

    const computeLineDistances = useCallback((line: LineSegments) => {
        line.computeLineDistances();
    }, []);
    const setGeometryFromPoints = useCallback((geometry: BufferGeometry) => {
        geometry.setFromPoints(lineSegments)
    }, [lineSegments]);

    useEffect(() => {
        setLineSegments((prev) => {
            let lineSegments: Vector3[] = [];
            if (mapPath.length > 0) {
                const miniPosition = buildVector3(positionObj);
                if (lineSegments.length > 0 && lineSegments[lineSegments.length - 1].equals(miniPosition)) {
                    return prev;
                }
                let startPoint: Vector3 | undefined = undefined;
                for (let point of mapPath) {
                    const endPoint = buildVector3(point);
                    if (startPoint) {
                        appendMovementPath(lineSegments, startPoint, endPoint, distanceMode, point.gridType);
                    }
                    startPoint = endPoint;
                }
                appendMovementPath(lineSegments, startPoint!, miniPosition, distanceMode, mapPath[mapPath.length - 1].gridType);
            } else if (lineSegments.length === 0) {
                // No change required
                return prev;
            }
            return lineSegments;
        });
    }, [distanceMode, mapPath, positionObj]);
    useEffect(() => {
        setMovedSuffix((prev) => {
            const movedSuffix = getMovedSuffix(mapPath, positionObj, distanceMode, distanceRound, roundToGrid, gridScale, gridUnit);
            if (movedSuffix !== prev) {
                updateMovedSuffix(movedSuffix);
            }
            return movedSuffix;
        });
    }, [lineSegments, distanceMode, distanceRound, gridScale, gridUnit, lineSegments, mapPath, positionObj, roundToGrid, updateMovedSuffix]);

    return !lineSegments ? null : (
        <lineSegments key={`movementPath_${miniId}_${movedSuffix}_${JSON.stringify(positionObj)}`} onUpdate={computeLineDistances}>
            <lineBasicMaterial attach='material' color={0xff00ff} linewidth={5}/>
            <bufferGeometry attach='geometry' onUpdate={setGeometryFromPoints} />
        </lineSegments>
    );
});

export default TabletopPathComponent;

function addBresenhamAxis(start: number, end: number, axis: Vector3, axes: BresenhamAxis[], noStraight?: Axis) {
    const step = Math.abs(end - start);
    if (step !== 0) {
        axes.push({
            axis,
            sign: (end > start) ? 1 : -1,
            delta: step,
            step,
            error: 0,
            noStraight
        });
    }
}

function adjustPointFromAxes(point: Vector3, axes: BresenhamAxis[], from: BresenhamAxis, movementPath: Vector3[]) {
    let lastNoStraight: number | undefined = undefined;
    for (let axis of axes) {
        if (lastNoStraight !== undefined || axis.axis === from.axis) {
            const scale = from.step * axis.sign;
            if (lastNoStraight !== undefined && axis.noStraight && Math.abs(lastNoStraight + axis.axis[axis.noStraight] * scale) < 0.001) {
                const intermediatePoint = point.clone();
                movementPath.push(intermediatePoint, intermediatePoint);
            }
            point.addScaledVector(axis.axis, scale);
            lastNoStraight = axis.noStraight ? axis.axis[axis.noStraight] * scale : (lastNoStraight || 0);
        }
    }
}

function appendMovementPath(movementPath: Vector3[], startPos: Vector3, endPos: Vector3,
    distanceMode: DistanceMode, gridType: GridType) {
    if (distanceMode === DistanceMode.STRAIGHT) {
        movementPath.push(startPos, endPos);
    } else {
        // Bresenham-inspired algorithm
        let axes: BresenhamAxis[] = [];
        addBresenhamAxis(startPos.y, endPos.y, new Vector3(0, 1, 0), axes);
        if (gridType === GridType.HEX_HORZ || gridType === GridType.HEX_VERT) {
            const {strideX, strideY} = getGridStride(gridType);
            const dx = (endPos.x - startPos.x) / strideX;
            const dz = (endPos.z - startPos.z) / strideY;
            // Hex grids have three non-orthogonal "axes", but you can get anywhere on the plane using only two of them.
            const dNorthEast = snapNumberToCloseInteger((dx - dz) / 2);
            const dSouthEast = snapNumberToCloseInteger((dx + dz) / 2);
            const noStraight = (gridType === GridType.HEX_VERT) ? 'z' : 'x';
            addBresenhamAxis(0, dSouthEast, new Vector3(strideX, 0, strideY), axes, noStraight);
            addBresenhamAxis(0, dNorthEast, new Vector3(strideX, 0, -strideY), axes, noStraight);
        } else {
            addBresenhamAxis(startPos.x, endPos.x, new Vector3(1, 0, 0), axes);
            addBresenhamAxis(startPos.z, endPos.z, new Vector3(0, 0, 1), axes);
        }
        if (axes.length === 0) {
            return;
        }
        let current = startPos.clone();
        axes.sort((a1, a2) => (a1.delta < a2.delta ? -1 : 1));
        let dMax = 0, distance = 0;
        axes.forEach((axis) => {
            const intDelta = Math.ceil(axis.delta - distance);
            dMax += intDelta;
            if (intDelta > 0) {
                axis.step = (axis.delta - distance) / intDelta;
            }
            distance = axis.delta;
            axis.delta = intDelta;
        });
        axes.forEach((axis) => {axis.error = dMax / 2});
        let lastPoint = startPos;
        for (let lineCount = 0; lineCount < dMax; ++lineCount) {
            for (let axis of axes) {
                axis.error -= axis.delta;
                if (axis.error < 0) {
                    axis.error += dMax;
                    movementPath.push(lastPoint);
                    adjustPointFromAxes(current, axes, axis, movementPath);
                    const point = current.clone();
                    movementPath.push(point);
                    lastPoint = point;
                }
            }
        }
    }
}


function calculateMoveDistance(from: TabletopPathPoint, to: TabletopPathPoint, distanceMode: DistanceMode): number {
    let dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    if (distanceMode === DistanceMode.STRAIGHT) {
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    } else if (from.gridType === GridType.HEX_VERT || from.gridType === GridType.HEX_HORZ) {
        const {strideX, strideY} = getGridStride(from.gridType);
        dx /= strideX;
        dz /= strideY;
        const dNorthEast = snapNumberToCloseInteger((dx - dz) / 2);
        const dSouthEast = snapNumberToCloseInteger((dx + dz) / 2);
        const combineAxes = (from.gridType === GridType.HEX_VERT) === ((dNorthEast > 0) === (dSouthEast > 0));
        // Fall through to the square case, treating the XZ plane path as a 1D line in the X direction
        dx = combineAxes ? Math.abs(dNorthEast) + Math.abs(dSouthEast) : Math.max(Math.abs(dNorthEast), Math.abs(dSouthEast));
        dz = 0;
    }
    if (distanceMode === DistanceMode.GRID_DIAGONAL_ONE_ONE) {
        return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    } else {
        // Need the two longest deltas (where the second longest = number of diagonal steps)
        const deltas = [Math.abs(dx), Math.abs(dy), Math.abs(dz)].sort((a, b) => (a === b ? 0 : (a < b) ? 1 : -1));
        return deltas[0] + deltas[1] * 0.5;
    }
}

function roundDistance(distance: number, distanceRound: DistanceRound) {
    switch (distanceRound) {
        case DistanceRound.ONE_DECIMAL:
            return Number(distance.toFixed(1));
        case DistanceRound.ROUND_OFF:
            return Math.round(distance);
        case DistanceRound.ROUND_DOWN:
            return Math.floor(distance);
        case DistanceRound.ROUND_UP:
            return Math.ceil(distance);
    }
}

function getMovedSuffix(
    movementPath: TabletopPathPoint[],
    positionObj: ObjectVector3,
    distanceMode: DistanceMode,
    distanceRound: DistanceRound,
    roundToGrid: boolean,
    gridScale?: number,
    gridUnit?: string
): string {
    if (movementPath.length > 0) {
        const scale = gridScale || 1;
        let distance = 0;
        let lastPoint: TabletopPathPoint | undefined = undefined;
        for (let point of movementPath) {
            if (lastPoint) {
                const gridDistance = calculateMoveDistance(lastPoint, point, distanceMode);
                distance += (roundToGrid) ? (roundDistance(gridDistance, distanceRound) * scale) : roundDistance(gridDistance * scale, distanceRound);
            }
            lastPoint = point;
        }
        const gridDistance = calculateMoveDistance(lastPoint!, {...positionObj, gridType: GridType.NONE}, distanceMode);
        distance += (roundToGrid) ? (roundDistance(gridDistance, distanceRound) * scale) : roundDistance(gridDistance * scale, distanceRound);
        if (distance > 0) {
            const distanceString = (distanceRound === DistanceRound.ONE_DECIMAL) ? distance.toFixed(1) : String(distance);
            if (gridUnit) {
                const plural = gridUnit.split('/');
                const index = (plural.length === 2 && distance !== 1) ? 1 : 0;
                return `${distanceString}${plural[index].match(/^[a-zA-Z]/) ? ' ' : ''}${plural[index]}`;
            } else {
                return distanceString;
            }
        }
    }
    return '';
}