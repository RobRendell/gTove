import {Component, default as React} from 'react';
import * as THREE from 'three';

import {DistanceMode, DistanceRound, MovementPathPoint, ObjectVector3} from '../util/scenarioUtils';
import {buildVector3} from '../util/threeUtils';
import TabletopMiniComponent from './tabletopMiniComponent';

interface TabletopPathComponentProps {
    miniId: string;
    positionObj: ObjectVector3;
    elevation: number;
    movementPath?: MovementPathPoint[];
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    roundToGrid: boolean;
    updateMovedSuffix: (movedSuffix: string) => void;
}

interface TabletopPathComponentState {
    movementPath?: THREE.Vector3[];
    wayPoints?: THREE.Vector3[];
    movedSuffix: string;
}

type Axis = 'x' | 'y' | 'z';

interface BresenhamAxis {
    axis: Axis;
    step: number;
    sign: number;
    delta: number;
    error: number;
}

export default class TabletopPathComponent extends Component<TabletopPathComponentProps, TabletopPathComponentState> {

    constructor(props: TabletopPathComponentProps) {
        super(props);
        this.state = {
            movedSuffix: ''
        };
    }

    componentWillMount() {
        this.updateMovementPath();
    }

    componentWillReceiveProps(props: TabletopPathComponentProps) {
        this.updateMovementPath(props, this.props.distanceMode !== props.distanceMode);
    }

    private addBresenhamAxis(start: number, end: number, axis: Axis, axes: BresenhamAxis[]) {
        const step = Math.abs(end - start);
        if (step !== 0) {
            axes.push({
                axis,
                sign: (end > start) ? 1 : -1,
                delta: step,
                step,
                error: 0
            });
        }
    }

    private adjustPointFromAxes(point: THREE.Vector3, axes: BresenhamAxis[], from: BresenhamAxis) {
        let started = false;
        for (let axis of axes) {
            started = started || (axis.axis === from.axis);
            if (started) {
                point[axis.axis] += from.step * axis.sign;
            }
        }
    }

    private appendMovementPath(props: TabletopPathComponentProps, movementPath: THREE.Vector3[], startPos: THREE.Vector3, endPos: THREE.Vector3) {
        if (props.distanceMode === DistanceMode.STRAIGHT) {
            movementPath.push(startPos, endPos);
        } else {
            // Bresenham-inspired algorithm
            let axes: BresenhamAxis[] = [];
            this.addBresenhamAxis(startPos.x, endPos.x, 'x', axes);
            this.addBresenhamAxis(startPos.y, endPos.y, 'y', axes);
            this.addBresenhamAxis(startPos.z, endPos.z, 'z', axes);
            if (axes.length > 0) {
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
                            this.adjustPointFromAxes(current, axes, axis);
                            const point = current.clone();
                            movementPath.push(lastPoint, point);
                            lastPoint = point;
                        }
                    }
                }
            }
        }
    }

    private calculateMoveDistance(vector: THREE.Vector3): number {
        switch (this.props.distanceMode) {
            case DistanceMode.STRAIGHT:
                return vector.length();
            case DistanceMode.GRID_DIAGONAL_ONE_ONE:
                return Math.max(Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z));
            case DistanceMode.GRID_DIAGONAL_THREE_EVERY_TWO:
                // Need the two longest deltas (where the second longest = number of diagonal steps)
                const deltas = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)].sort((a, b) => (a === b ? 0 : (a < b) ? 1 : -1));
                return deltas[0] + deltas[1] * 0.5;
        }
    }

    private roundDistance(distance: number) {
        switch (this.props.distanceRound) {
            case DistanceRound.ONE_DECIMAL:
                return Math.round(distance * 10) / 10;
            case DistanceRound.ROUND_OFF:
                return Math.round(distance);
            case DistanceRound.ROUND_DOWN:
                return Math.floor(distance);
            case DistanceRound.ROUND_UP:
                return Math.ceil(distance);
        }
    }

    private getMovedSuffix(movementPath?: THREE.Vector3[], wayPoints?: THREE.Vector3[]): string {
        if (movementPath && wayPoints) {
            const scale = this.props.gridScale || 1;
            let distance = 0;
            for (let index = 1; index < wayPoints.length; ++index) {
                const vector = wayPoints[index].clone().sub(wayPoints[index - 1]);
                const gridDistance = this.calculateMoveDistance(vector);
                distance += (this.props.roundToGrid) ? (this.roundDistance(gridDistance) * scale) : this.roundDistance(gridDistance * scale);
            }
            if (distance > 0) {
                if (this.props.gridUnit) {
                    const plural = this.props.gridUnit.split('/');
                    const index = (plural.length === 2 && distance !== 1) ? 1 : 0;
                    return ` (moved ${distance}${plural[index].match(/^[a-zA-Z]/) ? ' ' : ''}${plural[index]})`;
                } else {
                    return ` (moved ${distance})`;
                }
            }
        }
        return '';
    }

    private updateMovementPath(props = this.props, distanceModeChanged = false) {
        let movementPath: THREE.Vector3[] | undefined = undefined, wayPoints: THREE.Vector3[] | undefined = undefined;
        if (props.movementPath && props.movementPath.length > 0) {
            let startPos = buildVector3(props.movementPath[0]).add({x: 0, y: (props.movementPath[0].elevation || 0) + TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3);
            const elevation = props.elevation > TabletopMiniComponent.ARROW_SIZE || props.elevation < -TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.ARROW_SIZE ?
                props.elevation : 0;
            const endPos = buildVector3(props.positionObj).add({x: 0, y: elevation + TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3);
            if (!distanceModeChanged && this.state.movementPath && this.state.wayPoints!.length === props.movementPath.length
                && this.state.movementPath[0].equals(startPos) && this.state.movementPath[this.state.movementPath.length - 1].equals(endPos)) {
                return;
            }
            movementPath = [];
            wayPoints = [];
            for (let index = 1; index < props.movementPath.length; index++) {
                wayPoints.push(startPos);
                const wayPoint = buildVector3(props.movementPath[index]).add({x: 0, y: (props.movementPath[index].elevation || 0) + TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3);
                this.appendMovementPath(props, movementPath, startPos, wayPoint);
                startPos = wayPoint;
            }
            wayPoints.push(startPos, endPos);
            this.appendMovementPath(props, movementPath, startPos, endPos);
        } else if (!this.state.movementPath) {
            // No change required
            return;
        }
        this.setState({movementPath, wayPoints});
        const movedSuffix = this.getMovedSuffix(movementPath, wayPoints);
        if (movedSuffix !== this.state.movedSuffix) {
            this.setState({movedSuffix});
            this.props.updateMovedSuffix(movedSuffix);
        }
    }

    render() {
        if (this.state.movementPath) {
            return (
                <lineSegments key={'movementPath' + this.props.miniId + this.state.movementPath.length}>
                    <lineBasicMaterial color={0xff00ff} linewidth={5}/>
                    <geometry vertices={this.state.movementPath}/>
                </lineSegments>
            )
        } else {
            return null;
        }
    }
}