import * as React from 'react';
import * as THREE from 'three';
import {useFrame} from 'react-three-fiber';
import {HTML} from 'drei';
import {Group} from 'react-three-fiber/components';

import {GtoveDispatchProp} from '../redux/mainReducer';
import {clearPingAction, PingReducerType} from '../redux/pingReducer';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {buildVector3} from '../util/threeUtils';
import GoogleAvatar from './googleAvatar';

import './pingsComponent.scss';

interface PingsComponentProps extends GtoveDispatchProp {
    pings: PingReducerType;
    connectedUsers: ConnectedUserReducerType;
    camera: THREE.Camera;
    onClick: (pingId: string) => void;
    bumpLeft?: boolean;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const ARROW_POSITION = new THREE.Vector3(0, 0.5, 0);
const PING_DURATION_MS = 10000;
const EDGE_LIMIT = [1, 1, 0, 3, 0, 0]; // right, left, bottom, top, near, far
const LEFT_BUMP = 1.5;
const BOUNCE_CROSS_VECTOR = new THREE.Vector3(-1, 0, 0);

export default function PingsComponent(props: PingsComponentProps) {
    const [now, setNow] = React.useState(Date.now());

    useFrame(() => {
        setNow(Date.now());
        Object.keys(props.pings.active).forEach((peerId) => {
            if (!props.pings.active[peerId] || now > props.pings.active[peerId].timestamp + PING_DURATION_MS) {
                props.dispatch(clearPingAction(peerId));
            }
        })
    });

    props.camera.updateMatrix();
    props.camera.updateMatrixWorld();
    props.camera.projectionMatrixInverse.getInverse(props.camera.projectionMatrix);
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(props.camera.projectionMatrix,  props.camera.matrixWorldInverse));

    return (
        <>
            {
                Object.keys(props.pings.active)
                    .map((peerId) => {
                        const ping = props.pings.active[peerId];
                        const connectedUser = props.connectedUsers.users[peerId];
                        if (!ping || !connectedUser) {
                            return null;
                        }
                        const position = buildVector3(ping.position);
                        let moved = false;
                        const distanceFactor = props.camera.position.clone().sub(position).length() / 20;
                        for (let index = 0; index < frustum.planes.length; ++index) {
                            const plane = frustum.planes[index];
                            // The Dom element doesn't scale down by distance, so we need to scale up the edge limits
                            // the further away the point is.
                            const leftBump = (props.bumpLeft && index === 1) ? LEFT_BUMP : 0;
                            const edgeLimit = (EDGE_LIMIT[index] + leftBump) * distanceFactor;
                            const distanceToPoint = plane.distanceToPoint(position);
                            if (distanceToPoint < edgeLimit) {
                                // Move point into the frustum
                                position.addScaledVector(plane.normal, edgeLimit - distanceToPoint);
                                moved = true;
                            }
                        }
                        const bounceMagnitude = distanceFactor * Math.abs(Math.sin((now - ping.timestamp) / 400));
                        const bounce = props.camera.getWorldDirection(new THREE.Vector3()).cross(BOUNCE_CROSS_VECTOR).multiplyScalar(bounceMagnitude);
                        const arrowPosition = ARROW_POSITION.clone().addScaledVector(DOWN, -bounceMagnitude);
                        return (
                            <Group key={peerId} position={position} userData={{ping: peerId}}>
                                <HTML position={bounce}>
                                    <div className='pingAvatar'>
                                        <GoogleAvatar user={connectedUser.user} onClick={(evt) => {
                                            // This is a hack, but stopping propagation doesn't work between this DOM
                                            // event and the gesture control on the 3D Canvas - it doesn't even remain
                                            // true between this event handler and the one in gestureControls.
                                            evt.preventDefault();
                                            props.onClick(peerId);
                                        }}/>
                                    </div>
                                </HTML>
                                {
                                    moved ? null : (
                                        <arrowHelper attach='geometry' args={[DOWN, arrowPosition, 0.5, 0x0000ff, 0.5, 0.2]}/>
                                    )
                                }
                            </Group>
                        );
                    })
            }
        </>
    )
}