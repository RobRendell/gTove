import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as THREE from 'three';
import memoizeOne from 'memoize-one';

import {
    castTemplateAppProperties,
    DriveMetadata,
    GridType,
    TemplateAppProperties,
    TemplateShape
} from '../util/googleDriveUtils';
import {
    DistanceMode,
    DistanceRound, generateMovementPath,
    MapType,
    MovementPathPoint,
    ObjectEuler,
    ObjectVector3
} from '../util/scenarioUtils';
import {buildEuler, buildVector3} from '../util/threeUtils';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import LabelSprite from './labelSprite';
import TabletopPathComponent, {TabletopPathPoint} from './tabletopPathComponent';
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
    movementPath?: MovementPathPoint[];
    distanceMode: DistanceMode;
    distanceRound: DistanceRound;
    gridScale?: number;
    gridUnit?: string;
    roundToGrid: boolean;
    defaultGridType: GridType;
    maps: {[mapId: string]: MapType};
}

interface TabletopTemplateComponentState {
    movedSuffix: string;
}

export default class TabletopTemplateComponent extends React.Component<TabletopTemplateComponentProps, TabletopTemplateComponentState> {

    static NO_ROTATION = new THREE.Euler();
    static ARC_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);

    static LABEL_POSITION_OFFSET = new THREE.Vector3(0, 0.5, 0);

    static MIN_DIMENSION = 0.00001;

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

    private generateMovementPath: (movementPath: MovementPathPoint[], maps: {[mapId: string]: MapType}, defaultGridType: GridType) => TabletopPathPoint[];

    constructor(props: TabletopTemplateComponentProps) {
        super(props);
        this.generateMovementPath = memoizeOne(generateMovementPath);
        this.updateMovedSuffix = this.updateMovedSuffix.bind(this);
        this.state = {
            movedSuffix: ''
        };
    }

    renderTemplateShape({appProperties, miniId}: {appProperties: TemplateAppProperties, miniId: string}) {
        let {width, depth, height, templateShape} = appProperties;
        width = Math.max(TabletopTemplateComponent.MIN_DIMENSION, width);
        depth = Math.max(TabletopTemplateComponent.MIN_DIMENSION, depth);
        height = Math.max(TabletopTemplateComponent.MIN_DIMENSION, height);
        switch (templateShape) {
            case TemplateShape.RECTANGLE:
                return (<boxGeometry attach='geometry' args={[width, height, depth]}/>);
            case TemplateShape.CIRCLE:
                return (<cylinderGeometry attach='geometry' args={[width, width, height, 32*Math.max(width, height)]}/>);
            case TemplateShape.ARC:
                const angle = Math.PI / (appProperties.angle ? (180 / appProperties.angle) : 6);
                const shape = React.useMemo(() => {
                    const memoShape = new THREE.Shape();
                    memoShape.absarc(0, 0, width, -angle / 2, angle / 2, false);
                    memoShape.lineTo(0, 0);
                    return memoShape;
                }, [angle, width]);
                return (
                    <extrudeGeometry attach='geometry' key={miniId + '_' + height}
                                     args={[shape, {depth: height, bevelEnabled: false}]}
                    />
                )
        }
    }

    renderTemplateEdges({appProperties}: {appProperties: TemplateAppProperties}) {
        let {width, depth, height, templateShape} = appProperties;
        width = Math.max(TabletopTemplateComponent.MIN_DIMENSION, width);
        depth = Math.max(TabletopTemplateComponent.MIN_DIMENSION, depth);
        height = Math.max(TabletopTemplateComponent.MIN_DIMENSION, height);
        let geometry: THREE.Geometry | undefined = undefined;
        switch (templateShape) {
            case TemplateShape.RECTANGLE:
                geometry = new THREE.BoxGeometry(width, height, depth);
                break;
            case TemplateShape.CIRCLE:
                geometry = new THREE.CylinderGeometry(width, width, height, 32*Math.max(width, height));
                break;
            case TemplateShape.ARC:
                const angle = Math.PI / (appProperties.angle ? (180 / appProperties.angle) : 6);
                const shape = React.useMemo(() => {
                    const memoShape = new THREE.Shape();
                    memoShape.absarc(0, 0, width, -angle / 2, angle / 2, false);
                    memoShape.lineTo(0, 0);
                    return memoShape;
                }, [angle, width]);
                if (height < 0.01) {
                    geometry = new THREE.ShapeGeometry(shape);
                } else {
                    geometry = new THREE.ExtrudeGeometry(shape, {depth: height, bevelEnabled: false});
                }
                break;
        }
        return geometry ? (<edgesGeometry attach='geometry' args={[geometry]}/>) : null;
    }

    private updateMovedSuffix(movedSuffix: string) {
        this.setState({movedSuffix});
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
            <group>
                <group position={position} rotation={rotation} scale={scale} ref={(group: any) => {
                    if (group) {
                        group.userDataA = {miniId: this.props.miniId}
                    }
                }}>
                    {
                        this.props.wireframe ? (
                            <lineSegments rotation={meshRotation} position={offset}>
                                <this.renderTemplateEdges appProperties={appProperties} />
                                <lineBasicMaterial attach='material' color={appProperties.colour} transparent={appProperties.opacity < 1.0} opacity={appProperties.opacity}/>
                            </lineSegments>
                        ) : (
                            <mesh rotation={meshRotation} position={offset}>
                                <this.renderTemplateShape appProperties={appProperties} miniId={this.props.miniId} />
                                <meshPhongMaterial attach='material' args={[{color: appProperties.colour, transparent: appProperties.opacity < 1.0, opacity: appProperties.opacity}]} />
                            </mesh>
                        )
                    }
                    {
                        !this.props.highlight ? null : (
                            <mesh rotation={meshRotation} position={offset}>
                                <this.renderTemplateShape appProperties={appProperties} miniId={this.props.miniId} />
                                <HighlightShaderMaterial colour={this.props.highlight} intensityFactor={1} />
                            </mesh>
                        )
                    }
                    <LabelSprite label={this.props.label + this.state.movedSuffix} labelSize={this.props.labelSize} position={TabletopTemplateComponent.LABEL_POSITION_OFFSET} inverseScale={scale} maxWidth={800}/>
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

}