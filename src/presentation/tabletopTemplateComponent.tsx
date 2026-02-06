import * as React from 'react';
import * as THREE from 'three';
import memoizeOne from 'memoize-one';

import {
    FileMetadata,
    GridType,
    IconShapeEnum,
    TemplateProperties,
    TemplateShape
} from '../util/storage/storageContract';
import {
    DistanceMode,
    DistanceRound,
    generateMovementPath,
    getColourHexString,
    MapType,
    MovementPathPoint,
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterValues
} from '../util/scenarioUtils';
import {buildEuler, buildVector3} from '../util/threeUtils';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import RosterColumnValuesLabel from './rosterColumnValuesLabel';
import TabletopPathComponent, {TabletopPathPoint} from './tabletopPathComponent';
import LabelSprite from './labelSprite';
import { castTemplateProperties } from '../util/storage/storageUtils';

interface TabletopTemplateComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    metadata: FileMetadata<void, TemplateProperties>;
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
    piecesRosterColumns: PiecesRosterColumn[];
    piecesRosterValues: PiecesRosterValues;
}

interface TabletopTemplateComponentState {
    movedSuffix: string;
}

export default class TabletopTemplateComponent extends React.Component<TabletopTemplateComponentProps, TabletopTemplateComponentState> {

    static X_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);
    static NO_ROTATION = new THREE.Euler();

    static MIN_DIMENSION = 0.00001;
    static RENDER_ORDER_ADJUST = 0.05;

    private readonly generateMovementPath: (movementPath: MovementPathPoint[], maps: {[mapId: string]: MapType}, defaultGridType: GridType) => TabletopPathPoint[];

    constructor(props: TabletopTemplateComponentProps) {
        super(props);
        this.generateMovementPath = memoizeOne(generateMovementPath);
        this.updateMovedSuffix = this.updateMovedSuffix.bind(this);
        this.state = {
            movedSuffix: ''
        };
    }

    private updateMovedSuffix(movedSuffix: string) {
        this.setState({movedSuffix: movedSuffix ? ` (moved ${movedSuffix})` : ''});
    }

    render() {
        if (!this.props.metadata.properties) {
            return null;
        }
        const properties = castTemplateProperties(this.props.metadata.properties);
        const position = buildVector3(this.props.positionObj).add({x: 0, y: this.props.elevation, z: 0} as THREE.Vector3);
        const isArc = (properties.templateShape === TemplateShape.ARC);
        const heightAdjust = isArc ? properties.height / 2 : 0;
        const offset = buildVector3({x: properties.offsetX, y: properties.offsetY + heightAdjust, z: properties.offsetZ});
        const rotation = buildEuler(this.props.rotationObj);
        const scale = new THREE.Vector3(this.props.scaleFactor, this.props.scaleFactor, this.props.scaleFactor);
        if (properties.templateShape === TemplateShape.ICON) {
            position.add(offset);
            return (
                <group position={position} rotation={rotation} scale={scale} userData={{miniId: this.props.miniId}}
                       key={this.props.miniId + '.' + properties.colour}
                >
                    <LabelSprite font='50px "Material Icons"' fillColour={getColourHexString(properties.colour)}
                                 label={properties.iconShape || IconShapeEnum.comment} labelSize={1} renderOrder={position.y + TabletopTemplateComponent.RENDER_ORDER_ADJUST}/>
                    <RenderLabel label={this.props.label + this.state.movedSuffix} size={this.props.labelSize}
                                 height={2} renderOrder={position.y + TabletopTemplateComponent.RENDER_ORDER_ADJUST}
                                 scale={scale} rotation={rotation}
                                 piecesRosterColumns={this.props.piecesRosterColumns}
                                 piecesRosterValues={{}}
                    />
                </group>
            );
        }
        const meshRotation = isArc ? TabletopTemplateComponent.X_ROTATION : TabletopTemplateComponent.NO_ROTATION;
        return (
            <group>
                <group position={position} rotation={rotation} scale={scale} userData={{miniId: this.props.miniId}}>
                    {
                        this.props.wireframe ? (
                            <lineSegments rotation={meshRotation} position={offset}>
                                <RenderTemplateEdges properties={properties} />
                                <lineBasicMaterial attach='material' color={properties.colour} transparent={properties.opacity < 1.0} opacity={properties.opacity}/>
                            </lineSegments>
                        ) : (
                            <mesh rotation={meshRotation} position={offset} renderOrder={position.y + offset.y + TabletopTemplateComponent.RENDER_ORDER_ADJUST}>
                                <RenderTemplateShape properties={properties} miniId={this.props.miniId} highlight={false} />
                                <meshPhongMaterial attach='material' args={[{color: properties.colour, transparent: properties.opacity < 1.0, opacity: properties.opacity}]} />
                            </mesh>
                        )
                    }
                    {
                        !this.props.highlight ? null : (
                            <mesh rotation={meshRotation} position={offset} renderOrder={position.y + offset.y + TabletopTemplateComponent.RENDER_ORDER_ADJUST}>
                                <RenderTemplateShape properties={properties} miniId={this.props.miniId} highlight={true} />
                                <HighlightShaderMaterial colour={this.props.highlight} intensityFactor={1} />
                            </mesh>
                        )
                    }
                    <RenderLabel label={this.props.label + this.state.movedSuffix} size={this.props.labelSize}
                                 height={properties.height} renderOrder={position.y} scale={scale} rotation={rotation}
                                 piecesRosterColumns={this.props.piecesRosterColumns}
                                 piecesRosterValues={this.props.piecesRosterValues}
                    />
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

function RenderTemplateShape({properties, miniId, highlight}: {properties: TemplateProperties, miniId: string, highlight: boolean}) {
    let {width, depth, height, templateShape} = properties;
    const highlightGrow = highlight ? 0.05 : 0;
    width = Math.max(TabletopTemplateComponent.MIN_DIMENSION, width) + highlightGrow;
    depth = Math.max(TabletopTemplateComponent.MIN_DIMENSION, depth) + highlightGrow;
    height = Math.max(TabletopTemplateComponent.MIN_DIMENSION, height) + highlightGrow;
    switch (templateShape) {
        case TemplateShape.RECTANGLE:
            return (<boxGeometry attach='geometry' args={[width, height, depth]}/>);
        case TemplateShape.CIRCLE:
            return (<cylinderGeometry attach='geometry' args={[width, width, height, 32*Math.max(width, height)]}/>);
        case TemplateShape.ARC:
            const angle = Math.PI / (properties.angle ? (180 / properties.angle) : 6);
            // eslint-disable-next-line react-hooks/rules-of-hooks
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
            );
        case TemplateShape.ICON:
            return null;
    }
}

function RenderTemplateEdges({properties}: {properties: TemplateProperties}) {
    let {width, depth, height, templateShape} = properties;
    width = Math.max(TabletopTemplateComponent.MIN_DIMENSION, width);
    depth = Math.max(TabletopTemplateComponent.MIN_DIMENSION, depth);
    height = Math.max(TabletopTemplateComponent.MIN_DIMENSION, height);
    let geometry: THREE.BufferGeometry | undefined = undefined;
    switch (templateShape) {
        case TemplateShape.RECTANGLE:
            geometry = new THREE.BoxGeometry(width, height, depth);
            break;
        case TemplateShape.CIRCLE:
            if (height === TabletopTemplateComponent.MIN_DIMENSION) {
                geometry = new THREE.CircleGeometry(width, 32*width);
                geometry.rotateX(Math.PI/2);
            } else {
                geometry = new THREE.CylinderGeometry(width, width, height, 32*width);
            }
            break;
        case TemplateShape.ARC:
            const angle = Math.PI / (properties.angle ? (180 / properties.angle) : 6);
            // eslint-disable-next-line react-hooks/rules-of-hooks
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

function RenderLabel({label, size, height, renderOrder, scale, rotation, piecesRosterColumns, piecesRosterValues}:
                         {
                             label: string, size: number, height: number, renderOrder: number,
                             scale: THREE.Vector3, rotation: THREE.Euler | undefined,
                             piecesRosterColumns: PiecesRosterColumn[], piecesRosterValues: PiecesRosterValues
                         })
{
    const position = React.useMemo(() => (
        new THREE.Vector3(0, height/2 + 0.5, 0)
    ), [height]);
    return (
        <RosterColumnValuesLabel label={label} maxWidth={800} labelSize={size} position={position}
                                 inverseScale={scale} rotation={rotation} renderOrder={renderOrder + position.y + TabletopTemplateComponent.RENDER_ORDER_ADJUST}
                                 piecesRosterColumns={piecesRosterColumns} piecesRosterValues={piecesRosterValues}
        />
    );
}
