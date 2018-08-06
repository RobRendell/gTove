import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';

import {castTemplateAppProperties, DriveMetadata, TemplateAppProperties, TemplateShape} from '../util/googleDriveUtils';
import {ObjectEuler, ObjectVector3} from '../util/scenarioUtils';
import {buildEuler, buildVector3} from '../util/threeUtils';
import getHighlightShaderMaterial from '../shaders/highlightShader';
import LabelSprite from './labelSprite';

interface TabletopTemplateComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    metadata: DriveMetadata<TemplateAppProperties>;
    positionObj: ObjectVector3;
    rotationObj: ObjectEuler;
    scaleFactor: number;
    elevation: number;
    highlight: THREE.Color | null;
    wireframe: boolean;
}

export default class TabletopTemplateComponent extends React.Component<TabletopTemplateComponentProps> {

    static NO_ROTATION = new THREE.Euler();
    static ARC_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);

    static LABEL_POSITION_OFFSET = new THREE.Vector3(0, 0.5, 0);

    static propTypes = {
        miniId: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        labelSize: PropTypes.number.isRequired,
        metadata: PropTypes.object.isRequired,
        positionObj: PropTypes.object.isRequired,
        rotationObj: PropTypes.object.isRequired,
        scaleFactor: PropTypes.number.isRequired,
        elevation: PropTypes.number.isRequired,
        highlight: PropTypes.object,
        wireframe: PropTypes.bool
    };

    renderTemplateShape(appProperties: TemplateAppProperties) {
        const {width, depth, height} = appProperties;
        switch (this.props.metadata.appProperties.templateShape) {
            case TemplateShape.RECTANGLE:
                return (<boxGeometry width={width} depth={depth} height={height}/>);
            case TemplateShape.CIRCLE:
                return (<cylinderGeometry height={height} radiusTop={width} radiusBottom={width} radialSegments={32*Math.max(width, height)}/>);
            case TemplateShape.ARC:
                const angle = Math.PI / (appProperties.angle ? (180 / appProperties.angle) : 6);
                return (
                    <extrudeGeometry settings={{amount: height, bevelEnabled: false, extrudeMaterial: 1}} key={this.props.miniId + '_' + height}>
                        <shape>
                            <absArc x={0} y={0} radius={width} startAngle={-angle / 2} endAngle={angle / 2} clockwise={false}/>
                            <lineTo x={0} y={0}/>
                        </shape>
                    </extrudeGeometry>
                )
        }
    }

    renderTemplateEdges(appProperties: TemplateAppProperties) {
        const {width, depth, height} = appProperties;
        let geometry: THREE.Geometry | undefined = undefined;
        switch (this.props.metadata.appProperties.templateShape) {
            case TemplateShape.RECTANGLE:
                geometry = new THREE.BoxGeometry(width, height, depth);
                break;
            case TemplateShape.CIRCLE:
                geometry = new THREE.CylinderGeometry(width, width, Math.max(0.01, height), 32*Math.max(width, height));
                break;
            case TemplateShape.ARC:
                const angle = Math.PI / (appProperties.angle ? (180 / appProperties.angle) : 6);
                const shape = new THREE.Shape();
                shape.absarc(0, 0, width, -angle / 2, angle / 2, false);
                shape.lineTo(0, 0);
                if (height < 0.01) {
                    geometry = new THREE.ShapeGeometry(shape);
                } else {
                    geometry = new THREE.ExtrudeGeometry(shape, {amount: height, bevelEnabled: false, extrudeMaterial: 1});
                }
                break;
        }
        return geometry ? (<edgesGeometry geometry={geometry}/>) : null;
    }

    render() {
        if (!this.props.metadata.appProperties) {
            return null;
        }
        const appProperties = castTemplateAppProperties(this.props.metadata.appProperties);
        const position = buildVector3(this.props.positionObj).add({x: 0, y: this.props.elevation, z: 0} as THREE.Vector3);
        const offset = buildVector3({x: appProperties.offsetX, y: appProperties.offsetY, z: appProperties.offsetZ});
        const rotation = buildEuler(this.props.rotationObj);
        const scale = new THREE.Vector3(this.props.scaleFactor, this.props.scaleFactor, this.props.scaleFactor);
        const meshRotation = (appProperties.templateShape === TemplateShape.ARC) ? TabletopTemplateComponent.ARC_ROTATION : TabletopTemplateComponent.NO_ROTATION;
        return (
            <group position={position} rotation={rotation} scale={scale} ref={(group: any) => {
                if (group) {
                    group.userDataA = {miniId: this.props.miniId}
                }
            }}>
                {
                    this.props.wireframe ? (
                        <lineSegments rotation={meshRotation} position={offset}>
                            {this.renderTemplateEdges(appProperties)}
                            <lineBasicMaterial color={appProperties.colour} transparent={appProperties.opacity < 1.0} opacity={appProperties.opacity}/>
                        </lineSegments>
                    ) : (
                        <mesh rotation={meshRotation} position={offset}>
                            {this.renderTemplateShape(appProperties)}
                            <meshPhongMaterial color={appProperties.colour} transparent={appProperties.opacity < 1.0} opacity={appProperties.opacity}/>
                        </mesh>
                    )
                }
                {
                    !this.props.highlight ? null : (
                        <mesh rotation={meshRotation} position={offset}>
                            {this.renderTemplateShape(appProperties)}
                            {getHighlightShaderMaterial(this.props.highlight, 1)}
                        </mesh>
                    )
                }
                <LabelSprite label={this.props.label} labelSize={this.props.labelSize} position={TabletopTemplateComponent.LABEL_POSITION_OFFSET} inverseScale={scale}/>
            </group>
        );
    }

}