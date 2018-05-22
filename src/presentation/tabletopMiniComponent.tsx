import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import {Dispatch} from 'redux';

import {buildEuler, buildVector3} from '../util/threeUtils';
import getHighlightShaderMaterial from '../shaders/highlightShader';
import getUprightMiniShaderMaterial from '../shaders/uprightMiniShader';
import getTopDownMiniShaderMaterial from '../shaders/topDownMiniShader';
import {DriveMetadata, MiniAppProperties} from '../@types/googleDrive';
import {ObjectEuler, ObjectVector3} from '../@types/scenario';
import {ReduxStoreType} from '../redux/mainReducer';
import {FileAPI} from '../util/fileUtils';
import {updateMiniMetadataLocalAction} from '../redux/scenarioReducer';
import {addFilesAction, removeFileAction, setFetchingFileAction} from '../redux/fileIndexReducer';

interface TabletopMiniComponentProps {
    miniId: string;
    label: string;
    fullDriveMetadata: {[key: string]: DriveMetadata};
    dispatch: Dispatch<ReduxStoreType>;
    fileAPI: FileAPI;
    metadata: DriveMetadata<MiniAppProperties>;
    snapMini: (miniId: string) => {positionObj: ObjectVector3, rotationObj: ObjectEuler, scaleFactor: number, elevation: number};
    texture: THREE.Texture | null;
    selected: boolean;
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
    static MINI_ASPECT_RATIO = TabletopMiniComponent.MINI_WIDTH / TabletopMiniComponent.MINI_HEIGHT;
    static MINI_ADJUST = new THREE.Vector3(0, TabletopMiniComponent.MINI_THICKNESS, -TabletopMiniComponent.MINI_THICKNESS / 2);
    static HIGHLIGHT_SCALE_VECTOR = new THREE.Vector3(1.1, 1.1, 1.1);
    static HIGHLIGHT_MINI_ADJUST = new THREE.Vector3(0, 0, -TabletopMiniComponent.MINI_THICKNESS / 4);
    static ROTATION_XZ = new THREE.Euler(0, Math.PI / 2, 0);
    static ARROW_SIZE = 0.1;
    static PRONE_ROTATION = new THREE.Euler(-Math.PI/2, 0, 0);
    static LABEL_UPRIGHT_POSITION = new THREE.Vector3(0, TabletopMiniComponent.MINI_HEIGHT, 0);
    static LABEL_TOP_DOWN_POSITION = new THREE.Vector3(0, TabletopMiniComponent.MINI_THICKNESS, -0.5);
    static LABEL_PRONE_POSITION = new THREE.Vector3(0, TabletopMiniComponent.MINI_THICKNESS, -TabletopMiniComponent.MINI_HEIGHT);
    static LABEL_HEIGHT = 48;
    static REVERSE = new THREE.Vector3(-1, 1, 1);

    static propTypes = {
        miniId: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        fullDriveMetadata: PropTypes.object.isRequired,
        dispatch: PropTypes.func.isRequired,
        fileAPI: PropTypes.object.isRequired,
        metadata: PropTypes.object.isRequired,
        snapMini: PropTypes.func.isRequired,
        texture: PropTypes.object,
        selected: PropTypes.bool.isRequired,
        opacity: PropTypes.number.isRequired,
        prone: PropTypes.bool.isRequired,
        topDown: PropTypes.bool.isRequired,
        cameraRotation: PropTypes.object
    };

    private labelSpriteMaterial: any;

    constructor(props: TabletopMiniComponentProps) {
        super(props);
        this.state = {};
    }

    componentWillMount() {
        this.checkMetadata();
    }

    componentWillReceiveProps(props: TabletopMiniComponentProps) {
        this.checkMetadata(props);
        if (props.label !== this.props.label) {
            this.updateLabelSpriteMaterial(this.labelSpriteMaterial, props);
        }
    }

    private setLabelContext(context: CanvasRenderingContext2D) {
        context.font = `bold ${TabletopMiniComponent.LABEL_HEIGHT}px "arial black"`;
        context.fillStyle = 'rgba(255,255,255,1)';
        context.shadowBlur = 2;
        context.shadowColor = 'rgba(0,0,0,1)';
        context.lineWidth = 4;
    }

    updateLabelSpriteMaterial(labelSpriteMaterial: THREE.SpriteMaterial, props: TabletopMiniComponentProps = this.props) {
        if (labelSpriteMaterial && labelSpriteMaterial !== this.labelSpriteMaterial) {
            this.labelSpriteMaterial = labelSpriteMaterial;
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
                this.setLabelContext(context);
                const textMetrics = context.measureText(props.label);
                canvas.width = textMetrics.width;
                // Unfortunately, setting the canvas width appears to clear the context.
                this.setLabelContext(context);
                context.textAlign = 'center';
                context.fillText(props.label, textMetrics.width / 2, TabletopMiniComponent.LABEL_HEIGHT);
                const texture = new THREE.Texture(canvas);
                texture.needsUpdate = true;
                this.labelSpriteMaterial.map = texture;
                this.labelSpriteMaterial.useScreenCoordinates = false;
                this.setState({labelWidth: textMetrics.width});
            }
        }
    }

    private checkMetadata(props: TabletopMiniComponentProps = this.props) {
        if (props.metadata && !props.metadata.appProperties) {
            const driveMetadata = props.fullDriveMetadata[props.metadata.id];
            if (driveMetadata && driveMetadata.appProperties) {
                props.dispatch(updateMiniMetadataLocalAction(props.miniId, driveMetadata));
            } else if (!driveMetadata) {
                // Avoid requesting the same metadata multiple times
                props.dispatch(setFetchingFileAction(props.metadata.id));
                props.fileAPI.getFullMetadata(props.metadata.id)
                    .then((fullMetadata) => {
                        if (fullMetadata.trashed) {
                            throw new Error(`File ${fullMetadata.name} has been trashed.`);
                        }
                        props.dispatch(addFilesAction([fullMetadata]));
                    })
                    .catch((err) => {
                        console.error('Mini has missing metadata and will be discarded from the tabletop.', err);
                        // Error loading the file means we need to remove the mini.
                        props.dispatch(removeFileAction(props.metadata));
                    });
            }
        }
    }

    private renderLabel(scaleFactor: number, rotation: THREE.Euler) {
        const position = this.props.prone ? TabletopMiniComponent.LABEL_PRONE_POSITION :
            this.props.topDown ? TabletopMiniComponent.LABEL_TOP_DOWN_POSITION.clone() : TabletopMiniComponent.LABEL_UPRIGHT_POSITION;
        const scale = this.state.labelWidth ? new THREE.Vector3(this.state.labelWidth / 200 / scaleFactor, 1 / scaleFactor, 1) : undefined;
        if (this.props.topDown && this.props.cameraInverseQuat) {
            // Rotate the label so it's always above the mini.  This involves cancelling out the mini's local rotation,
            // and also rotating by the camera's inverse rotation around the Y axis (supplied as a prop).
            position.multiply(TabletopMiniComponent.REVERSE)
                .applyEuler(rotation).multiply(TabletopMiniComponent.REVERSE)
                .applyQuaternion(this.props.cameraInverseQuat);
        }
        return (
            <sprite position={position} scale={scale}>
                <spriteMaterial key={this.props.label} ref={(material: THREE.SpriteMaterial) => {this.updateLabelSpriteMaterial(material);}}/>
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

    private renderMiniBase() {
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
                (!this.props.selected) ? null : (
                    <mesh scale={TabletopMiniComponent.HIGHLIGHT_SCALE_VECTOR}>
                        <geometryResource resourceId='miniBase'/>
                        {getHighlightShaderMaterial()}
                    </mesh>
                )
            }
        </group>;
    }

    renderTopDownMini() {
        const {positionObj, rotationObj, scaleFactor, elevation} = this.props.snapMini(this.props.miniId);
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const scale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);
        let offset = TabletopMiniComponent.MINI_ADJUST.clone();
        const arrowDir = elevation > TabletopMiniComponent.ARROW_SIZE ?
            TabletopMiniComponent.UP :
            (elevation < -TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.ARROW_SIZE ? TabletopMiniComponent.DOWN : null);
        const arrowLength = (elevation > 0 ?
            elevation + TabletopMiniComponent.MINI_THICKNESS :
            (-elevation - TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.MINI_THICKNESS)) / scaleFactor;
        if (arrowDir) {
            offset.y += elevation / scaleFactor;
        }
        return (
            <group position={position} rotation={rotation} scale={scale}>
                <group position={offset} ref={(group: any) => {
                    if (group) {
                        group.userDataA = {miniId: this.props.miniId}
                    }
                }}>
                    {this.renderLabel(scaleFactor, rotation)}
                    <mesh key='topDown' rotation={TabletopMiniComponent.ROTATION_XZ}>
                        <geometryResource resourceId='miniBase'/>
                        {getTopDownMiniShaderMaterial(this.props.texture, this.props.opacity, this.props.metadata.appProperties)}
                    </mesh>
                    {
                        (!this.props.selected) ? null : (
                            <mesh scale={TabletopMiniComponent.HIGHLIGHT_SCALE_VECTOR}>
                                <geometryResource resourceId='miniBase'/>
                                {getHighlightShaderMaterial()}
                            </mesh>
                        )
                    }
                </group>
                {this.renderArrow(arrowDir, arrowLength)}
                {arrowDir ? this.renderMiniBase() : null}
            </group>
        );
    }

    renderUprightMini() {
        const {positionObj, rotationObj, scaleFactor, elevation} = this.props.snapMini(this.props.miniId);
        const position = buildVector3(positionObj);
        const rotation = buildEuler(rotationObj);
        const scale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);
        let offset = TabletopMiniComponent.MINI_ADJUST.clone();
        const arrowDir = elevation > TabletopMiniComponent.ARROW_SIZE ?
            TabletopMiniComponent.UP :
            (elevation < -TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.ARROW_SIZE ? TabletopMiniComponent.DOWN : null);
        const arrowLength = (elevation > 0 ?
            elevation + TabletopMiniComponent.MINI_THICKNESS :
            (-elevation - TabletopMiniComponent.MINI_HEIGHT - TabletopMiniComponent.MINI_THICKNESS)) / scaleFactor;
        if (arrowDir) {
            offset.y += elevation / scaleFactor;
        }
        const proneRotation = (this.props.prone) ? TabletopMiniComponent.PRONE_ROTATION : TabletopMiniComponent.NO_ROTATION;
        return (
            <group position={position} rotation={rotation} scale={scale}>
                <group position={offset} ref={(group: any) => {
                    if (group) {
                        group.userDataA = {miniId: this.props.miniId}
                    }
                }}>
                    {this.renderLabel(scaleFactor, rotation)}
                    <mesh rotation={proneRotation}>
                        <extrudeGeometry
                            settings={{amount: TabletopMiniComponent.MINI_THICKNESS, bevelEnabled: false, extrudeMaterial: 1}}
                        >
                            <shapeResource resourceId='mini'/>
                        </extrudeGeometry>
                        {getUprightMiniShaderMaterial(this.props.texture, this.props.opacity, this.props.metadata.appProperties)}
                    </mesh>
                    {
                        (!this.props.selected) ? null : (
                            <mesh rotation={proneRotation} position={TabletopMiniComponent.HIGHLIGHT_MINI_ADJUST} scale={TabletopMiniComponent.HIGHLIGHT_SCALE_VECTOR}>
                                <extrudeGeometry settings={{amount: TabletopMiniComponent.MINI_THICKNESS, bevelEnabled: false}}>
                                    <shapeResource resourceId='mini'/>
                                </extrudeGeometry>
                                {getHighlightShaderMaterial()}
                            </mesh>
                        )
                    }
                </group>
                {this.renderArrow(arrowDir, arrowLength)}
                {this.renderMiniBase()}
            </group>
        );
    }

    render() {
        return (!this.props.metadata || !this.props.metadata.appProperties) ? (
            null
        ) : (this.props.topDown && !this.props.prone) ? (
            this.renderTopDownMini()
        ) : (
            this.renderUprightMini()
        );
    }
}