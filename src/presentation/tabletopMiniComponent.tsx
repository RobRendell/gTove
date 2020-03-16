import React from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import memoizeOne from 'memoize-one';

import {buildEuler, buildVector3} from '../util/threeUtils';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import UprightMiniShaderMaterial from '../shaders/uprightMiniShaderMaterial';
import TopDownMiniShaderMaterial from '../shaders/topDownMiniShaderMaterial';
import {DriveMetadata, GridType, MiniAppProperties} from '../util/googleDriveUtils';
import {
    DistanceMode,
    DistanceRound,
    generateMovementPath,
    MapType,
    MovementPathPoint,
    ObjectEuler,
    ObjectVector3
} from '../util/scenarioUtils';
import LabelSprite from './labelSprite';
import TabletopPathComponent, {TabletopPathPoint} from './tabletopPathComponent';

interface TabletopMiniComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    metadata: DriveMetadata<MiniAppProperties>;
    positionObj: ObjectVector3;
    rotationObj: ObjectEuler;
    scaleFactor: number;
    elevation: number;
    movementPath?: MovementPathPoint[];
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
    hideBase: boolean;
    baseColour?: number;
    cameraInverseQuat?: THREE.Quaternion;
    defaultGridType: GridType;
    maps: {[mapId: string]: MapType};
}

interface TabletopMiniComponentState {
    labelWidth?: number;
    movedSuffix: string;
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

    private generateMovementPath: (movementPath: MovementPathPoint[], maps: {[mapId: string]: MapType}, defaultGridType: GridType) => TabletopPathPoint[];

    constructor(props: TabletopMiniComponentProps) {
        super(props);
        this.generateMovementPath = memoizeOne(generateMovementPath);
        this.updateMovedSuffix = this.updateMovedSuffix.bind(this);
        this.state = {
            movedSuffix: ''
        };
    }

    UNSAFE_componentWillReceiveProps(nextProps: Readonly<TabletopMiniComponentProps>): void {
        if (this.state.movedSuffix && !nextProps.movementPath) {
            this.updateMovedSuffix('');
        }
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
            <LabelSprite label={this.props.label + this.state.movedSuffix} labelSize={this.props.labelSize} position={position} inverseScale={miniScale} maxWidth={800}/>
        );
    }

    private renderElevationArrow(arrowDir: THREE.Vector3 | null, arrowLength: number) {
        return arrowDir ? (
            <arrowHelper args={[arrowDir, TabletopMiniComponent.ORIGIN, arrowLength, undefined,
                TabletopMiniComponent.ARROW_SIZE, TabletopMiniComponent.ARROW_SIZE]}/>
        ) : null;
    }

    private renderMiniBaseCylinderGeometry() {
        return (
            <cylinderGeometry attach='geometry' args={[0.5, 0.5, TabletopMiniComponent.MINI_THICKNESS, 32]}/>
        );
    }

    private renderMiniBase(highlightScale?: THREE.Vector3) {
        const baseColour = '#' + ('000000' + (this.props.baseColour || 0).toString(16)).slice(-6);
        return this.props.hideBase ? null : (<group ref={(group: any) => {
            if (group) {
                group.userDataA = {miniId: this.props.miniId}
            }
        }}>
            <mesh key='miniBase'>
                {this.renderMiniBaseCylinderGeometry()}
                <meshPhongMaterial attach='material' args={[{color: baseColour, transparent: this.props.opacity < 1.0, opacity: this.props.opacity}]} />
            </mesh>
            {
                (!this.props.highlight) ? null : (
                    <mesh scale={highlightScale}>
                        {this.renderMiniBaseCylinderGeometry()}
                        <HighlightShaderMaterial colour={this.props.highlight} intensityFactor={1} />
                    </mesh>
                )
            }
        </group>);
    }

    private updateMovedSuffix(movedSuffix: string) {
        this.setState({movedSuffix});
    }

    private miniExtrusion() {
        const shape = React.useMemo(() => {
            const width = TabletopMiniComponent.MINI_WIDTH;
            const height = TabletopMiniComponent.MINI_HEIGHT;
            const cornerRadius = width * TabletopMiniComponent.MINI_CORNER_RADIUS_PERCENT / 100;
            const shape = new THREE.Shape();
            shape.moveTo(-width/2, 0);
            shape.lineTo(-width/2, height - cornerRadius);
            shape.quadraticCurveTo(-width/2, height, cornerRadius - width/2, height);
            shape.lineTo(width/2 - cornerRadius, height);
            shape.quadraticCurveTo(width/2, height, width/2, height - cornerRadius);
            shape.lineTo(width/2, 0);
            shape.lineTo(-width/2, 0);
            return shape;
        }, []);
        return (
            <extrudeGeometry attach='geometry' args={[shape, {depth: TabletopMiniComponent.MINI_THICKNESS, bevelEnabled: false}]}/>
        );
    }

    renderTopDownMini() {
        const position = buildVector3(this.props.positionObj);
        const rotation = buildEuler(this.props.rotationObj);
        // Make larger minis (slightly) thinner than smaller ones.
        const scale = new THREE.Vector3(this.props.scaleFactor, 1 + (0.05 / this.props.scaleFactor), this.props.scaleFactor);
        const highlightScale = (!this.props.highlight) ? undefined : (
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
                            {this.renderMiniBaseCylinderGeometry()}
                            <TopDownMiniShaderMaterial texture={this.props.texture} opacity={this.props.opacity} appProperties={this.props.metadata.appProperties} />
                        </mesh>
                        {
                            (!this.props.highlight) ? null : (
                                <mesh scale={highlightScale}>
                                    {this.renderMiniBaseCylinderGeometry()}
                                    <HighlightShaderMaterial colour={this.props.highlight} intensityFactor={1} />
                                </mesh>
                            )
                        }
                    </group>
                    {this.renderElevationArrow(arrowDir, arrowLength)}
                    {arrowDir ? this.renderMiniBase(highlightScale) : null}
                </group>
                {
                    !this.props.movementPath ? null : (
                        <TabletopPathComponent
                            miniId={this.props.miniId}
                            positionObj={{...this.props.positionObj, y: this.props.positionObj.y + this.props.elevation}}
                            movementPath={this.generateMovementPath(this.props.movementPath, this.props.maps, this.props.defaultGridType)}
                            distanceMode={this.props.distanceMode}
                            distanceRound={this.props.distanceRound}
                            gridScale={this.props.gridScale}
                            gridUnit={this.props.gridUnit}
                            roundToGrid={this.props.roundToGrid}
                            updateMovedSuffix={this.updateMovedSuffix}
                        />
                    )
                }
            </group>
        );
    }

    renderStandeeMini() {
        const position = buildVector3(this.props.positionObj);
        const rotation = buildEuler(this.props.rotationObj);
        const scale = new THREE.Vector3(this.props.scaleFactor, this.props.scaleFactor, this.props.scaleFactor);
        const baseHighlightScale = (!this.props.highlight) ? undefined : (
            new THREE.Vector3((this.props.scaleFactor + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor,
                1.2,
                (this.props.scaleFactor + 2 * TabletopMiniComponent.MINI_THICKNESS) / this.props.scaleFactor)
        );
        const standeeHighlightScale = (!this.props.highlight) ? undefined : (
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
                            <this.miniExtrusion/>
                            <UprightMiniShaderMaterial texture={this.props.texture} opacity={this.props.opacity} appProperties={this.props.metadata.appProperties}/>
                        </mesh>
                        {
                            (!this.props.highlight) ? null : (
                                <mesh rotation={proneRotation} position={TabletopMiniComponent.HIGHLIGHT_STANDEE_ADJUST} scale={standeeHighlightScale}>
                                    <this.miniExtrusion/>
                                    <HighlightShaderMaterial colour={this.props.highlight} intensityFactor={1} />
                                </mesh>
                            )
                        }
                    </group>
                    {this.renderElevationArrow(arrowDir, arrowLength)}
                    {this.renderMiniBase(baseHighlightScale)}
                </group>
                {
                    !this.props.movementPath ? null : (
                        <TabletopPathComponent
                            miniId={this.props.miniId}
                            positionObj={{...this.props.positionObj, y: this.props.positionObj.y + this.props.elevation}}
                            movementPath={this.generateMovementPath(this.props.movementPath, this.props.maps, this.props.defaultGridType)}
                            distanceMode={this.props.distanceMode}
                            distanceRound={this.props.distanceRound}
                            gridScale={this.props.gridScale}
                            gridUnit={this.props.gridUnit}
                            roundToGrid={this.props.roundToGrid}
                            updateMovedSuffix={this.updateMovedSuffix}
                        />
                    )
                }
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