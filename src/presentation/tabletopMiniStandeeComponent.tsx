import {FunctionComponent, useMemo} from 'react';
import * as THREE from 'three';

import {buildEuler, buildVector3} from '../util/threeUtils';
import {MINI_HEIGHT} from '../util/constants';
import {
    ObjectEuler,
    ObjectVector3,
    PiecesRosterColumn,
    PiecesRosterValues
} from '../util/scenarioUtils';
import UprightMiniShaderMaterial from '../shaders/uprightMiniShaderMaterial';
import HighlightShaderMaterial from '../shaders/highlightShaderMaterial';
import {DriveMetadata, MiniProperties} from '../util/googleDriveUtils';
import {HIGHLIGHT_STANDEE_ADJUST, MINI_THICKNESS, RENDER_ORDER_ADJUST} from './tabletopMiniComponent';
import TabletopMiniExtrusion from './tabletopMiniExtrusion';
import TabletopMiniBaseComponent from './tabletopMiniBaseComponent';
import TabletopMiniLabelComponent from './tabletopMiniLabelComponent';
import TabletopMiniElevationArrow from './tabletopMiniElevationArrow';

interface TabletopStandeeMiniComponentProps {
    miniId: string;
    label: string;
    labelSize: number;
    metadata: DriveMetadata<void, MiniProperties>;
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
        (!highlight) ? undefined :
            new THREE.Vector3((scaleFactor + 2 * MINI_THICKNESS) / scaleFactor,
                (scaleFactor * MINI_HEIGHT + 2 * MINI_THICKNESS) / (scaleFactor * MINI_HEIGHT),
                1.1)
    ), [highlight, scaleFactor]);
    const offset = useMemo(() => (
        new THREE.Vector3(0, MINI_THICKNESS + (elevation ? elevation / scaleFactor : 0), -MINI_THICKNESS / 2)
    ), [elevation, scaleFactor]);
    const proneRotation = useMemo(() => (
        (prone) ? new THREE.Euler(-Math.PI/2, 0, 0) : undefined
    ), [prone]);
    return (
        <group>
            <group position={position} rotation={rotation} scale={scale} key={'group' + miniId}>
                <group position={offset} userData={{miniId: miniId}}>
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
                    <mesh rotation={proneRotation} renderOrder={position.y + offset.y + RENDER_ORDER_ADJUST}>
                        <TabletopMiniExtrusion/>
                        <UprightMiniShaderMaterial texture={texture} opacity={opacity} colour={colour} properties={metadata.properties}/>
                    </mesh>
                    {
                        (!highlight) ? null : (
                            <mesh rotation={proneRotation} position={HIGHLIGHT_STANDEE_ADJUST}
                                  scale={highlightScale} renderOrder={position.y + offset.y + RENDER_ORDER_ADJUST}
                            >
                                <TabletopMiniExtrusion/>
                                <HighlightShaderMaterial colour={highlight} intensityFactor={1} />
                            </mesh>
                        )
                    }
                </group>
                <TabletopMiniElevationArrow length={elevation / scale.y} />
                <TabletopMiniBaseComponent miniId={miniId} baseColour={baseColour} hideBase={hideBase}
                                           renderOrder={position.y} opacity={opacity}
                                           highlight={highlight} scaleFactor={scaleFactor}
                />
            </group>
        </group>
    );
};

export default TabletopMiniStandeeComponent;