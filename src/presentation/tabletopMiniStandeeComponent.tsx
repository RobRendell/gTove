import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';

import {buildEuler, buildVector3} from '../util/threeUtils';
import {
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterValues
} from '../util/scenarioUtils';
import UprightMiniShaderMaterial from '../shaders/uprightMiniShaderMaterial';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import {FileMetadata, MiniProperties} from '../util/storage/storageContract';
import { defaultMiniProperties } from '../util/storage/storageContract';
import {
    MINI_THICKNESS,
    RENDER_ORDER_ADJUST,
    STANDEE_ADJUST_PRONE,
    STANDEE_ADJUST_UPRIGHT
} from './tabletopMiniComponent';
import TabletopMiniExtrusion from './tabletopMiniExtrusion';
import TabletopMiniBaseComponent from './tabletopMiniBaseComponent';
import TabletopMiniLabelComponent from './tabletopMiniLabelComponent';
import TabletopMiniElevationArrow from './tabletopMiniElevationArrow';

interface TabletopStandeeMiniComponentProps {
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

const NO_ROTATION = new THREE.Euler();
const PRONE_ROTATION = new THREE.Euler(-Math.PI/2, 0, 0);

const TabletopMiniStandeeComponent: FunctionComponent<TabletopStandeeMiniComponentProps> = (
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
    const scale = useMemo(() => (new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor)), [scaleFactor]);
    const highlightScale = useMemo(() => (
        // Scale highlight in Y direction half as much, because the highlight doesn't scale below the standee, just above.
        new THREE.Vector3(1 + 0.1/scaleFactor, 1 + 0.05/scaleFactor, 1 + 0.1/scaleFactor)
    ), [scaleFactor]);
    const offset = useMemo(() => (
        new THREE.Vector3(0, (elevation > MINI_THICKNESS / 2) ? elevation : MINI_THICKNESS / 2, 0)
    ), [elevation]);
    const proneRotation = (prone) ? PRONE_ROTATION : NO_ROTATION;
    const standeePosition = (prone) ? STANDEE_ADJUST_PRONE : STANDEE_ADJUST_UPRIGHT;
    return (
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
                <mesh position={standeePosition} rotation={proneRotation} renderOrder={position.y + offset.y + RENDER_ORDER_ADJUST}>
                    <TabletopMiniExtrusion/>
                    <UprightMiniShaderMaterial texture={texture} opacity={opacity} colour={colour} properties={metadata.properties || defaultMiniProperties}/>
                </mesh>
                {
                    (!highlight) ? null : (
                        <group scale={highlightScale} position={standeePosition} rotation={proneRotation}>
                            <mesh renderOrder={position.y + offset.y + RENDER_ORDER_ADJUST}>
                                <TabletopMiniExtrusion/>
                                <HighlightShaderMaterial colour={highlight} intensityFactor={1} />
                            </mesh>
                        </group>
                    )
                }
            </group>
            <TabletopMiniElevationArrow length={elevation} cameraInverseQuat={cameraInverseQuat} />
            <TabletopMiniBaseComponent miniId={miniId} baseColour={baseColour} hideBase={hideBase}
                                       renderOrder={position.y} opacity={opacity}
                                       highlight={highlight} scaleFactor={scaleFactor}
            />
        </group>
    );
};

export default TabletopMiniStandeeComponent;