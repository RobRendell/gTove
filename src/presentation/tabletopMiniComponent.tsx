import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';

import {buildEuler, buildVector3} from '../util/threeUtils';
import getHighlightShaderMaterial from '../shaders/highlightShader';
import getUprightMiniShaderMaterial from '../shaders/uprightMiniShader';
import getTopDownMiniShaderMaterial from '../shaders/topDownMiniShader';
import {DriveMetadata, MiniAppProperties} from '../util/googleDriveUtils';
import {ObjectEuler, ObjectVector3} from '../@types/scenario';

interface TabletopMiniComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    checkMetadata: (metadata: DriveMetadata, mapId?: string, miniId?: string) => void;
    metadata: DriveMetadata<MiniAppProperties>;
    positionObj: ObjectVector3;
    rotationObj: ObjectEuler;
    scaleFactor: number;
    elevation: number;
    arrowPositionObj?: ObjectVector3;
    texture: THREE.Texture | null;
    highlight: THREE.Color | null;
    opacity: number;
    prone: boolean;
    topDown: boolean;
    cameraInverseQuat?: THREE.Quaternion;
}

interface TabletopMiniComponentState {
    labelWidth?: number;
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

    static LABEL_PX_HEIGHT = 48;
    static LABEL_UPRIGHT_POSITION = new THREE.Vector3(0, TabletopMiniComponent.MINI_HEIGHT, 0);
    static LABEL_TOP_DOWN_POSITION = new THREE.Vector3(0, 0.5, -0.5);
    static LABEL_PRONE_POSITION = new THREE.Vector3(0, 0.5, -TabletopMiniComponent.MINI_HEIGHT);

    static REVERSE = new THREE.Vector3(-1, 1, 1);

    static propTypes = {
        miniId: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        labelSize: PropTypes.number.isRequired,
        checkMetadata: PropTypes.func.isRequired,
        metadata: PropTypes.object.isRequired,
        positionObj: PropTypes.object.isRequired,
        rotationObj: PropTypes.object.isRequired,
        scaleFactor: PropTypes.number.isRequired,
        elevation: PropTypes.number.isRequired,
        arrowPositionObj: PropTypes.object,
        texture: PropTypes.object,
        highlight: PropTypes.object,
        opacity: PropTypes.number.isRequired,
        prone: PropTypes.bool.isRequired,
        topDown: PropTypes.bool.isRequired,
        cameraRotation: PropTypes.object
    };

    private labelSpriteMaterial: any;
    private label: string;

    constructor(props: TabletopMiniComponentProps) {
        super(props);
        this.state = {};
    }

    componentWillMount() {
        this.props.checkMetadata(this.props.metadata, undefined, this.props.miniId);
    }

    componentWillReceiveProps(props: TabletopMiniComponentProps) {
        props.checkMetadata(props.metadata, undefined, props.miniId);
        const movementArrow = this.getMovementArrow(props.arrowPositionObj, props.positionObj, props.elevation);
        this.updateLabel(props.label, movementArrow);
    }

    private setLabelContext(context: CanvasRenderingContext2D) {
        context.font = `bold ${TabletopMiniComponent.LABEL_PX_HEIGHT}px arial, sans-serif`;
        context.fillStyle = 'rgba(255,255,255,1)';
        context.shadowBlur = 4;
        context.shadowColor = 'rgba(0,0,0,1)';
        context.lineWidth = 2;
        context.textBaseline = 'bottom';
    }

    updateLabel(label: string, movementArrow: THREE.Vector3[]) {
        if (movementArrow.length === 2) {
            const length = Math.round(movementArrow[1].length());
            if (length > 0) {
                label += ` (moved ${length})`;
            }
        }
        if (this.labelSpriteMaterial && label !== this.label) {
            this.label = label;
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
                this.setLabelContext(context);
                const textMetrics = context.measureText(this.label);
                const width = Math.max(10, textMetrics.width);
                canvas.width = width;
                canvas.height = TabletopMiniComponent.LABEL_PX_HEIGHT;
                // Unfortunately, setting the canvas width appears to clear the context.
                this.setLabelContext(context);
                context.textAlign = 'center';
                context.fillText(this.label, width / 2, TabletopMiniComponent.LABEL_PX_HEIGHT);
                const texture = new THREE.Texture(canvas);
                texture.needsUpdate = true;
                this.labelSpriteMaterial.map = texture;
                this.labelSpriteMaterial.useScreenCoordinates = false;
                this.setState({labelWidth: width});
            }
        }
    }

    private renderLabel(miniScale: THREE.Vector3, rotation: THREE.Euler) {
        const position = this.props.prone ? TabletopMiniComponent.LABEL_PRONE_POSITION.clone() :
            this.props.topDown ? TabletopMiniComponent.LABEL_TOP_DOWN_POSITION.clone() : TabletopMiniComponent.LABEL_UPRIGHT_POSITION.clone();
        const pxToWorld = this.props.labelSize / TabletopMiniComponent.LABEL_PX_HEIGHT;
        const scale = this.state.labelWidth ? new THREE.Vector3(this.state.labelWidth * pxToWorld / miniScale.x, this.props.labelSize / miniScale.y, 1) : undefined;
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
            <sprite position={position} scale={scale}>
                <spriteMaterial key={this.props.label} ref={(material: THREE.SpriteMaterial) => {this.labelSpriteMaterial = material || this.labelSpriteMaterial}}/>
            </sprite>
        );
    }

    private renderArrow(arrowDir: THREE.Vector3 | null, arrowLength: number) {
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

    private getMovementArrow(arrowPositionObj: ObjectVector3 | undefined, position: THREE.Vector3 | ObjectVector3, elevation: number) {
        if (arrowPositionObj) {
            const origin = buildVector3(arrowPositionObj).add({x: 0, y: TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3);
            return [origin, buildVector3(position).add({x: 0, y: elevation + TabletopMiniComponent.ARROW_SIZE, z: 0} as THREE.Vector3).sub(origin)];
        } else {
            return [];
        }
    }

    private renderMovementArrow(movementArrow: THREE.Vector3[]) {
        if (movementArrow.length > 0) {
            const [origin, arrowDir] = movementArrow;
            const length = arrowDir.length();
            arrowDir.multiplyScalar(1 / length);
            return (
                <arrowHelper
                    origin={origin}
                    dir={arrowDir}
                    length={length}
                    headLength={TabletopMiniComponent.ARROW_SIZE}
                    headWidth={TabletopMiniComponent.ARROW_SIZE}
                    color={0xaaaaff}
                />
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
            (-this.props.elevation - TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.MINI_THICKNESS)) / this.props.scaleFactor;
        if (arrowDir) {
            offset.y += this.props.elevation / this.props.scaleFactor;
        }
        const movementArrow = this.getMovementArrow(this.props.arrowPositionObj, position, this.props.elevation);
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
                    {this.renderArrow(arrowDir, arrowLength)}
                    {arrowDir ? this.renderMiniBase(highlightScale) : null}
                </group>
                {this.renderMovementArrow(movementArrow)}
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
        const movementArrow = this.getMovementArrow(this.props.arrowPositionObj, position, this.props.elevation);
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
                    {this.renderArrow(arrowDir, arrowLength)}
                    {this.renderMiniBase(baseHighlightScale)}
                </group>
                {this.renderMovementArrow(movementArrow)}
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