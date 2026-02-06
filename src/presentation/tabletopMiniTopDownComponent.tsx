import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';

import {FileMetadata, MiniProperties} from '../util/storage/storageContract'; 
import {
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterValues
} from '../util/scenarioUtils';
import {buildEuler, buildVector3} from '../util/threeUtils';
import TopDownMiniShaderMaterial from '../shaders/topDownMiniShaderMaterial';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import {MINI_THICKNESS, RENDER_ORDER_ADJUST} from './tabletopMiniComponent';
import TabletopMiniBaseComponent from './tabletopMiniBaseComponent';
import TabletopMiniLabelComponent from './tabletopMiniLabelComponent';
import TabletopMiniElevationArrow from './tabletopMiniElevationArrow';

interface TabletopMiniTopDownComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    metadata: FileMetadata<void, MiniProperties>;
    positionObj: ObjectVector3;
    rotationObj: ObjectEuler;
    scaleFactor: number;
    elevation: number;
    highlight: THREE.Color | null;
    opacity: number;
    prone: boolean;
    topDown: boolean;
    hideBase: boolean;
    baseColour?: number;
    cameraInverseQuat?: THREE.Quaternion;
    piecesRosterColumns: PiecesRosterColumn[];
    piecesRosterValues: PiecesRosterValues;
    colour: THREE.Color;
    texture: THREE.Texture | null;
}

const ROTATION_XZ = new THREE.Euler(0, Math.PI / 2, 0);

const TabletopMiniTopDownComponent: FunctionComponent<TabletopMiniTopDownComponentProps> = (
    {
        miniId,
        label,
        labelSize,
        metadata,
        positionObj,
        rotationObj,
        scaleFactor,
        elevation,
        highlight,
        opacity,
        prone,
        topDown,
        hideBase,
        baseColour,
        cameraInverseQuat,
        piecesRosterColumns,
        piecesRosterValues,
        colour,
        texture
    }
) => {
    const position = useMemo(() => (buildVector3(positionObj)), [positionObj]);
    const rotation = useMemo(() => (buildEuler(rotationObj)), [rotationObj]);
    // Make larger minis (slightly) thinner than smaller ones.
    const scale = useMemo(() => (new THREE.Vector3(scaleFactor, 1 + (0.05 / scaleFactor), scaleFactor)), [scaleFactor]);
    const highlightScale = useMemo(() => (
        (!highlight) ? undefined : new THREE.Vector3(1 + 0.1/scaleFactor, 1 + 0.1/scaleFactor, 1 + 0.1/scaleFactor)
    ), [highlight, scaleFactor]);
    const offset = useMemo(() => (
        new THREE.Vector3(0, MINI_THICKNESS / 2 + (elevation ?? 0), 0)
    ), [elevation]);
    return (
        <group>
            <group position={position} rotation={rotation}>
                <group position={offset} scale={scale} userData={{miniId: miniId}}>
                    <TabletopMiniLabelComponent prone={prone}
                                                topDown={topDown}
                                                labelSize={labelSize}
                                                cameraInverseQuat={cameraInverseQuat}
                                                piecesRosterColumns={piecesRosterColumns}
                                                piecesRosterValues={piecesRosterValues}
                                                label={label}
                                                miniScale={scale}
                                                rotation={rotation}
                                                renderOrder={position.y}
                    />
                    <mesh rotation={ROTATION_XZ}
                          renderOrder={position.y + offset.y + RENDER_ORDER_ADJUST}
                    >
                        <cylinderGeometry attach='geometry' args={[0.5, 0.5, MINI_THICKNESS, 32]}/>
                        <TopDownMiniShaderMaterial texture={texture} opacity={opacity} colour={colour}
                                                   properties={metadata.properties as MiniProperties}/>
                    </mesh>
                    {
                        (!highlight) ? null : (
                            <mesh scale={highlightScale} renderOrder={position.y + offset.y + RENDER_ORDER_ADJUST}>
                                <cylinderGeometry attach='geometry' args={[0.5, 0.5, MINI_THICKNESS, 32]}/>
                                <HighlightShaderMaterial colour={highlight} intensityFactor={1}/>
                            </mesh>
                        )
                    }
                </group>
                <TabletopMiniElevationArrow length={elevation} cameraInverseQuat={cameraInverseQuat} />
                {
                    (!elevation) ? null : (
                        <TabletopMiniBaseComponent miniId={miniId} baseColour={baseColour} hideBase={hideBase}
                                                   renderOrder={position.y} opacity={opacity}
                                                   highlight={highlight} scaleFactor={scaleFactor}
                        />
                    )
                }
            </group>
        </group>
    );
};

export default TabletopMiniTopDownComponent;