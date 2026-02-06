import {Component} from 'react';
import * as THREE from 'three';

import {DistanceMode, DistanceRound, getGridStride, ObjectVector3} from '../util/scenarioUtils';
import {buildVector3} from '../util/threeUtils';
import {GridType} from '../util/storage/storageContract';
import {snapNumberToCloseInteger} from '../util/mathsUtils';

export interface TabletopPathPoint {
    x: number;
    y: number;
    z: number;
    gridType: GridType;
}

interface TabletopPathComponentProps {
    miniId: string;
    positionObj: ObjectVector3;
    movementPath: TabletopPathPoint[];
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    roundToGrid: boolean;
    updateMovedSuffix: (movedSuffix: string) => void;
}

interface TabletopPathComponentState {
    lineSegments: THREE.Vector3[];
    movedSuffix: string;
}

type Axis = 'x' | 'y' | 'z';

interface BresenhamAxis {
    axis: THREE.Vector3;
    step: number;
    sign: number;
    delta: number;
    error: number;
    noStraight?: Axis;
}

export default class TabletopPathComponent extends Component<TabletopPathComponentProps, TabletopPathComponentState> {

    constructor(props: TabletopPathComponentProps) {
        super(props);
        this.computeLineDistances = this.computeLineDistances.bind(this);
        this.setGeometryFromPoints = this.setGeometryFromPoints.bind(this);
        this.state = {
            lineSegments: [],
            movedSuffix: ''
        };
    }

    componentDidMount() {
        this.updateMovementPath();
    }

    UNSAFE_componentWillReceiveProps(props: TabletopPathComponentProps) {
        this.updateMovementPath(props, this.props.distanceMode !== props.distanceMode || this.props.movementPath !== props.movementPath);
    }

    private addBresenhamAxis(start: number, end: number, axis: THREE.Vector3, axes: BresenhamAxis[], noStraight?: Axis) {
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

    private adjustPointFromAxes(point: THREE.Vector3, axes: BresenhamAxis[], from: BresenhamAxis, movementPath: THREE.Vector3[]) {
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

    private appendMovementPath(movementPath: THREE.Vector3[], startPos: THREE.Vector3, endPos: THREE.Vector3,
                               distanceMode: DistanceMode, gridType: GridType) {
        if (distanceMode === DistanceMode.STRAIGHT) {
            movementPath.push(startPos, endPos);
        } else {
            // Bresenham-inspired algorithm
            let axes: BresenhamAxis[] = [];
            this.addBresenhamAxis(startPos.y, endPos.y, new THREE.Vector3(0, 1, 0), axes);
            if (gridType === GridType.HEX_HORZ || gridType === GridType.HEX_VERT) {
                const {strideX, strideY} = getGridStride(gridType);
                const dx = (endPos.x - startPos.x) / strideX;
                const dz = (endPos.z - startPos.z) / strideY;
                // Hex grids have three non-orthogonal "axes", but you can get anywhere on the plane using only two of them.
                const dNorthEast = snapNumberToCloseInteger((dx - dz) / 2);
                const dSouthEast = snapNumberToCloseInteger((dx + dz) / 2);
                const noStraight = (gridType === GridType.HEX_VERT) ? 'z' : 'x';
                this.addBresenhamAxis(0, dSouthEast, new THREE.Vector3(strideX, 0, strideY), axes, noStraight);
                this.addBresenhamAxis(0, dNorthEast, new THREE.Vector3(strideX, 0, -strideY), axes, noStraight);
            } else {
                this.addBresenhamAxis(startPos.x, endPos.x, new THREE.Vector3(1, 0, 0), axes);
                this.addBresenhamAxis(startPos.z, endPos.z, new THREE.Vector3(0, 0, 1), axes);
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
                        this.adjustPointFromAxes(current, axes, axis, movementPath);
                        const point = current.clone();
                        movementPath.push(point);
                        lastPoint = point;
                    }
                }
            }
        }
    }

    private calculateMoveDistance(from: TabletopPathPoint, to: TabletopPathPoint): number {
        let dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
        if (this.props.distanceMode === DistanceMode.STRAIGHT) {
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
        if (this.props.distanceMode === DistanceMode.GRID_DIAGONAL_ONE_ONE) {
            return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
        } else {
            // Need the two longest deltas (where the second longest = number of diagonal steps)
            const deltas = [Math.abs(dx), Math.abs(dy), Math.abs(dz)].sort((a, b) => (a === b ? 0 : (a < b) ? 1 : -1));
            return deltas[0] + deltas[1] * 0.5;
        }
    }

    private roundDistance(distance: number) {
        switch (this.props.distanceRound) {
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

    private getMovedSuffix(props: TabletopPathComponentProps): string {
        if (props.movementPath.length > 0) {
            const scale = props.gridScale || 1;
            let distance = 0;
            let lastPoint: TabletopPathPoint | undefined = undefined;
            for (let point of props.movementPath) {
                if (lastPoint) {
                    const gridDistance = this.calculateMoveDistance(lastPoint, point);
                    distance += (props.roundToGrid) ? (this.roundDistance(gridDistance) * scale) : this.roundDistance(gridDistance * scale);
                }
                lastPoint = point;
            }
            const gridDistance = this.calculateMoveDistance(lastPoint!, {...props.positionObj, gridType: GridType.NONE});
            distance += (props.roundToGrid) ? (this.roundDistance(gridDistance) * scale) : this.roundDistance(gridDistance * scale);
            if (distance > 0) {
                const distanceString = (props.distanceRound === DistanceRound.ONE_DECIMAL) ? distance.toFixed(1) : String(distance);
                if (props.gridUnit) {
                    const plural = props.gridUnit.split('/');
                    const index = (plural.length === 2 && distance !== 1) ? 1 : 0;
                    return `${distanceString}${plural[index].match(/^[a-zA-Z]/) ? ' ' : ''}${plural[index]}`;
                } else {
                    return distanceString;
                }
            }
        }
        return '';
    }

    private updateMovementPath(props = this.props, forceRecalculation = false) {
        let lineSegments: THREE.Vector3[] = [];
        if (props.movementPath.length > 0) {
            const miniPosition = buildVector3(props.positionObj);
            if (!forceRecalculation && this.state.lineSegments.length > 0 && this.state.lineSegments[this.state.lineSegments.length - 1].equals(miniPosition)) {
                return;
            }
            let startPoint: THREE.Vector3 | undefined = undefined;
            for (let point of props.movementPath) {
                const endPoint = buildVector3(point);
                if (startPoint) {
                    this.appendMovementPath(lineSegments, startPoint, endPoint, props.distanceMode, point.gridType);
                }
                startPoint = endPoint;
            }
            this.appendMovementPath(lineSegments, startPoint!, miniPosition, props.distanceMode, props.movementPath[props.movementPath.length - 1].gridType);
        } else if (this.state.lineSegments.length === 0) {
            // No change required
            return;
        }
        this.setState({lineSegments});
        const movedSuffix = this.getMovedSuffix(props);
        if (movedSuffix !== this.state.movedSuffix) {
            this.setState({movedSuffix});
            props.updateMovedSuffix(movedSuffix);
        }
    }

    private computeLineDistances(line: THREE.LineSegments) {
        line.computeLineDistances();
    }

    private setGeometryFromPoints(geometry: THREE.BufferGeometry) {
        const lineSegments = this.state.lineSegments;
        geometry.setFromPoints(lineSegments);
    }

    render() {
        const lineSegments = this.state.lineSegments;
        if (lineSegments) {
            return (
                <lineSegments key={`movementPath_${this.props.miniId}_${this.state.movedSuffix}_${JSON.stringify(this.props.positionObj)}`} onUpdate={this.computeLineDistances}>
                    <lineBasicMaterial attach='material' color={0xff00ff} linewidth={5}/>
                    <bufferGeometry attach='geometry' onUpdate={this.setGeometryFromPoints} />
                </lineSegments>
            )
        } else {
            return null;
        }
    }
}