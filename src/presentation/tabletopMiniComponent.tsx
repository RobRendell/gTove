import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';

import {buildEuler, buildVector3} from '../util/threeUtils';
import getHighlightShaderMaterial from '../shaders/highlightShader';
import getUprightMiniShaderMaterial from '../shaders/uprightMiniShader';
import getTopDownMiniShaderMaterial from '../shaders/topDownMiniShader';
import {DriveMetadata, MiniAppProperties} from '../util/googleDriveUtils';
import {DistanceMode, DistanceRound, ObjectEuler, ObjectVector3} from '../util/scenarioUtils';
import LabelSprite from './labelSprite';

interface TabletopMiniComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    metadata: DriveMetadata<MiniAppProperties>;
    positionObj: ObjectVector3;
    rotationObj: ObjectEuler;
    scaleFactor: number;
    elevation: number;
    movementPath?: ObjectVector3[];
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    roundToGrid: boolean;
    texture: THREE.Texture | null;
    highlight: THREE.Color | null;
    opacity: number;
    prone: boolean;
    topDown: boolean;
    cameraInverseQuat?: THREE.Quaternion;
}

interface TabletopMiniComponentState {
    labelWidth?: number;
    labelText: string;
    movementPath?: THREE.Vector3[];
    wayPoints?: THREE.Vector3[];
}

type Axis = 'x' | 'y' | 'z';

interface BresenhamAxis {
    axis: Axis;
    step: number;
    sign: number;
    delta: number;
    error: number;
}

export default class TabletopMiniComponent extends React.Component<TabletopMiniComponentProps, TabletopMiniComponentState> {

    static ORIGIN = new THREE.Vector3();
    static NO_ROTATION = new THREE.Euler();
    static UP = new THREE.Vector3(0, 1, 0);
    static DOWN = new THREE.Vector3(0, -1, 0);

    static MINI_THICKNESS = 0.05;
    static MINI_WIDTH = 1;
    static MINI_HEIGHT = 1.2;
    static MINI_CORNER_RADIUS_PERCENT = 10;
    static MINI_ASPECT_RATIO = TabletopMiniComponent.MINI_WIDTH / TabletopMiniComponent.MINI_HEIGHT;
    static MINI_ADJUST = new THREE.Vector3(0, TabletopMiniComponent.MINI_THICKNESS, -TabletopMiniComponent.MINI_THICKNESS / 2);

    static HIGHLIGHT_STANDEE_ADJUST = new THREE.Vector3(0, 0, -TabletopMiniComponent.MINI_THICKNESS/4);

    static ROTATION_XZ = new THREE.Euler(0, Math.PI / 2, 0);
    static PRONE_ROTATION = new THREE.Euler(-Math.PI/2, 0, 0);

    static ARROW_SIZE = 0.1;

    static LABEL_UPRIGHT_POSITION = new THREE.Vector3(0, TabletopMiniComponent.MINI_HEIGHT, 0);
    static LABEL_TOP_DOWN_POSITION = new THREE.Vector3(0, 0.5, -0.5);
    static LABEL_PRONE_POSITION = new THREE.Vector3(0, 0.5, -TabletopMiniComponent.MINI_HEIGHT);

    static REVERSE = new THREE.Vector3(-1, 1, 1);

    static propTypes = {
        miniId: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        labelSize: PropTypes.number.isRequired,
        metadata: PropTypes.object.isRequired,
        positionObj: PropTypes.object.isRequired,
        rotationObj: PropTypes.object.isRequired,
        scaleFactor: PropTypes.number.isRequired,
        elevation: PropTypes.number.isRequired,
        movementPath: PropTypes.arrayOf(PropTypes.object),
        distanceMode: PropTypes.string.isRequired,
        distanceRound: PropTypes.string.isRequired,
        gridScale: PropTypes.number,
        gridUnit: PropTypes.string,
        roundToGrid: PropTypes.bool,
        texture: PropTypes.object,
        highlight: PropTypes.object,
        opacity: PropTypes.number.isRequired,
        prone: PropTypes.bool.isRequired,
        topDown: PropTypes.bool.isRequired,
        cameraInverseQuat: PropTypes.object
    };

    constructor(props: TabletopMiniComponentProps) {
        super(props);
        this.state = {
            labelText: props.label
        };
    }

    componentWillMount() {
        this.updateMovementPath();
    }

    componentWillReceiveProps(props: TabletopMiniComponentProps) {
        this.updateMovementPath(props, this.props.distanceMode !== props.distanceMode);
        if (props.label !== this.props.label) {
            this.setState({labelText: props.label + this.getMovedSuffix(this.state.movementPath, this.state.wayPoints)});
        }
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

    private appendMovementPath(props: TabletopMiniComponentProps, movementPath: THREE.Vector3[], startPos: THREE.Vector3, endPos: THREE.Vector3) {
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
                    axes.forEach((axis, index) => {
                        axis.error -= axis.delta;
                        if (axis.error < 0) {
                            axis.error += dMax;
                            while (index < axes.length) {
                                const forward = axes[index++];
                                current[forward.axis] += axis.step * forward.sign;
                            }
                            const point = current.clone();
                            movementPath.push(lastPoint, point);
                            lastPoint = point;
                        }
                    });
                }
            }
        }
    }

    private updateMovementPath(props = this.props, distanceModeChanged = false) {
        if (props.movementPath && props.movementPath.length > 0) {
            let startPos = buildVector3(props.movementPath[0]).add({x: 0, y: TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3);
            const elevation = props.elevation > TabletopMiniComponent.ARROW_SIZE || props.elevation < -TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.ARROW_SIZE ?
                props.elevation : 0;
            const endPos = buildVector3(props.positionObj).add({x: 0, y: elevation + TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3);
            if (!distanceModeChanged && this.state.movementPath && this.state.wayPoints!.length === props.movementPath.length
                    && this.state.movementPath[0].equals(startPos) && this.state.movementPath[this.state.movementPath.length - 1].equals(endPos)) {
                return;
            }
            let movementPath: THREE.Vector3[] = [], wayPoints: THREE.Vector3[] = [];
            for (let index = 1; index < props.movementPath.length; index++) {
                wayPoints.push(startPos);
                const wayPoint = buildVector3(props.movementPath[index]).add({x: 0, y: TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3);
                this.appendMovementPath(props, movementPath, startPos, wayPoint);
                startPos = wayPoint;
            }
            wayPoints.push(startPos, endPos);
            this.appendMovementPath(props, movementPath, startPos, endPos);
            this.setState({movementPath, wayPoints, labelText: this.props.label + this.getMovedSuffix(movementPath, wayPoints)});
        } else if (!props.movementPath && this.state.movementPath) {
            this.setState({movementPath: undefined, wayPoints: undefined, labelText: this.props.label + this.getMovedSuffix()});
        }
    }

    calculateMoveDistance(vector: THREE.Vector3): number {
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

    roundDistance(distance: number) {
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

    getMovedSuffix(movementPath?: THREE.Vector3[], wayPoints?: THREE.Vector3[]): string {
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

    private renderLabel(miniScale: THREE.Vector3, rotation: THREE.Euler) {
        const position = this.props.prone ? TabletopMiniComponent.LABEL_PRONE_POSITION.clone() :
            this.props.topDown ? TabletopMiniComponent.LABEL_TOP_DOWN_POSITION.clone() : TabletopMiniComponent.LABEL_UPRIGHT_POSITION.clone();
        if (this.props.topDown) {
            position.z -= this.props.labelSize / 2 / miniScale.z;
            if (!this.props.prone && this.props.cameraInverseQuat) {
                // Rotate the label so it's always above the mini.  This involves cancelling out the mini's local rotation,
                // and also rotating by the camera's inverse rotation around the Y axis (supplied as a prop).
                position.multiply(TabletopMiniComponent.REVERSE)
                    .applyEuler(rotation).multiply(TabletopMiniComponent.REVERSE)
                    .applyQuaternion(this.props.cameraInverseQuat);
            }
        } else {
            position.y += this.props.labelSize / 2 / miniScale.y;
        }
        return (
            <LabelSprite label={this.state.labelText} labelSize={this.props.labelSize} position={position} inverseScale={miniScale}/>
        );
    }

    private renderElevationArrow(arrowDir: THREE.Vector3 | null, arrowLength: number) {
        return arrowDir ? (
            <arrowHelper
                origin={TabletopMiniComponent.ORIGIN}
                dir={arrowDir}
                length={arrowLength}
                headLength={TabletopMiniComponent.ARROW_SIZE}
                headWidth={TabletopMiniComponent.ARROW_SIZE}
            />
        ) : null;
    }

    private renderMiniBase(highlightScale: THREE.Vector3 | null) {
        return <group ref={(group: any) => {
            if (group) {
                group.userDataA = {miniId: this.props.miniId}
            }
        }}>
            <mesh key='miniBase'>
                <geometryResource resourceId='miniBase'/>
                <meshPhongMaterial color='black' transparent={this.props.opacity < 1.0} opacity={this.props.opacity}/>
            </mesh>
            {
                (!this.props.highlight) ? null : (
                    <mesh scale={highlightScale}>
                        <geometryResource resourceId='miniBase'/>
                        {getHighlightShaderMaterial(this.props.highlight, 1)}
                    </mesh>
                )
            }
        </group>;
    }

    private renderMovementPath() {
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

    renderTopDownMini() {
        const position = buildVector3(this.props.positionObj);
        const rotation = buildEuler(this.props.rotationObj);
        // Make larger minis (slightly) thinner than smaller ones.
        const scale = new THREE.Vector3(this.props.scaleFactor, 1 + (0.05 / this.props.scaleFactor), this.props.scaleFactor);
        const highlightScale = (!this.props.highlight) ? null : (
            new THREE.Vector3((this.props.scaleFactor + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor,
                (2 + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor,
                (this.props.scaleFactor + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor)
        );
        let offset = TabletopMiniComponent.MINI_ADJUST.clone();
        const arrowDir = this.props.elevation > TabletopMiniComponent.ARROW_SIZE ?
            TabletopMiniComponent.UP :
            (this.props.elevation < -TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.ARROW_SIZE ? TabletopMiniComponent.DOWN : null);
        const arrowLength = (this.props.elevation > 0 ?
            this.props.elevation + TabletopMiniComponent.MINI_THICKNESS :
            (-this.props.elevation - TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.MINI_THICKNESS));
        if (arrowDir) {
            offset.y += this.props.elevation;
        }
        return (
            <group>
                <group position={position} rotation={rotation} scale={scale}>
                    <group position={offset} ref={(group: any) => {
                        if (group) {
                            group.userDataA = {miniId: this.props.miniId}
                        }
                    }}>
                        {this.renderLabel(scale, rotation)}
                        <mesh key='topDown' rotation={TabletopMiniComponent.ROTATION_XZ}>
                            <geometryResource resourceId='miniBase'/>
                            {getTopDownMiniShaderMaterial(this.props.texture, this.props.opacity, this.props.metadata.appProperties)}
                        </mesh>
                        {
                            (!this.props.highlight) ? null : (
                                <mesh scale={highlightScale}>
                                    <geometryResource resourceId='miniBase'/>
                                    {getHighlightShaderMaterial(this.props.highlight, 1)}
                                </mesh>
                            )
                        }
                    </group>
                    {this.renderElevationArrow(arrowDir, arrowLength)}
                    {arrowDir ? this.renderMiniBase(highlightScale) : null}
                </group>
                {this.renderMovementPath()}
            </group>
        );
    }

    renderStandeeMini() {
        const position = buildVector3(this.props.positionObj);
        const rotation = buildEuler(this.props.rotationObj);
        const scale = new THREE.Vector3(this.props.scaleFactor, this.props.scaleFactor, this.props.scaleFactor);
        const baseHighlightScale = (!this.props.highlight) ? null : (
            new THREE.Vector3((this.props.scaleFactor + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor,
                1.2,
                (this.props.scaleFactor + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor)
        );
        const standeeHighlightScale = (!this.props.highlight) ? null : (
            new THREE.Vector3((this.props.scaleFactor + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor,
                (this.props.scaleFactor * TabletopMiniComponent.MINI_HEIGHT + 2 * TabletopMiniComponent.MINI_THICKNESS) / (this.props.scaleFactor * TabletopMiniComponent.MINI_HEIGHT),
                1.1)
        );
        let offset = TabletopMiniComponent.MINI_ADJUST.clone();
        const arrowDir = this.props.elevation > TabletopMiniComponent.ARROW_SIZE ?
            TabletopMiniComponent.UP :
            (this.props.elevation < -TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.ARROW_SIZE ? TabletopMiniComponent.DOWN : null);
        const arrowLength = (this.props.elevation > 0 ?
            this.props.elevation + TabletopMiniComponent.MINI_THICKNESS :
            (-this.props.elevation - TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.MINI_THICKNESS)) / this.props.scaleFactor;
        if (arrowDir) {
            offset.y += this.props.elevation / this.props.scaleFactor;
        }
        const proneRotation = (this.props.prone) ? TabletopMiniComponent.PRONE_ROTATION : TabletopMiniComponent.NO_ROTATION;
        return (
            <group>
                <group position={position} rotation={rotation} scale={scale} key={'group' + this.props.miniId}>
                    <group position={offset} ref={(group: any) => {
                        if (group) {
                            group.userDataA = {miniId: this.props.miniId}
                        }
                    }}>
                        {this.renderLabel(scale, rotation)}
                        <mesh rotation={proneRotation}>
                            <extrudeGeometry
                                settings={{amount: TabletopMiniComponent.MINI_THICKNESS, bevelEnabled: false, extrudeMaterial: 1}}
                            >
                                <shapeResource resourceId='mini'/>
                            </extrudeGeometry>
                            {getUprightMiniShaderMaterial(this.props.texture, this.props.opacity, this.props.metadata.appProperties)}
                        </mesh>
                        {
                            (!this.props.highlight) ? null : (
                                <mesh rotation={proneRotation} position={TabletopMiniComponent.HIGHLIGHT_STANDEE_ADJUST} scale={standeeHighlightScale}>
                                    <extrudeGeometry settings={{amount: TabletopMiniComponent.MINI_THICKNESS, bevelEnabled: false}}>
                                        <shapeResource resourceId='mini'/>
                                    </extrudeGeometry>
                                    {getHighlightShaderMaterial(this.props.highlight, 1)}
                                </mesh>
                            )
                        }
                    </group>
                    {this.renderElevationArrow(arrowDir, arrowLength)}
                    {this.renderMiniBase(baseHighlightScale)}
                </group>
                {this.renderMovementPath()}
            </group>
        );
    }

    render() {
        return (!this.props.metadata || !this.props.metadata.appProperties) ? (
            null
        ) : (this.props.topDown && !this.props.prone) ? (
            this.renderTopDownMini()
        ) : (
            this.renderStandeeMini()
        );
    }
}