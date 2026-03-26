import './pingComponent.scss';

import {Html} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {
    FunctionComponent,
    MouseEvent,
    MutableRefObject,
    TouchEvent,
    useCallback,
    useMemo,
    useRef,
    useState
} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Frustum, Vector3} from 'three';

import {getTabletopStateFromStore} from '../redux/mainReducer';
import {clearPingAction} from '../redux/pingReducer';
import {PingReducerType} from '../redux/pingReducerTypes';
import {DriveUser} from '../util/storage/providers/google/googleDriveUtils';
import {buildVector3} from '../util/threeUtils';
import GoogleAvatar from './googleAvatar';

const DOWN = new Vector3(0, -1, 0);
const ARROW_POSITION = new Vector3(0, 0.5, 0);
const PING_DURATION_MS = 10000;
const EDGE_LIMIT = [0.5, 0.5, 0, 3, 0, 0]; // right, left, bottom, top, near, far
const LEFT_BUMP = 1.5;
const BOUNCE_CROSS_VECTOR = new Vector3(-1, 0, 0);

interface FunctionComponentProps {
    peerId: string;
    user: DriveUser;
    ping: PingReducerType['active'][string];
    onSelectPeerId: (peerId: string) => void;
    frustumRef: MutableRefObject<Frustum>;
}

const PingComponent: FunctionComponent<FunctionComponentProps> = ({peerId, user, ping, onSelectPeerId, frustumRef}) => {
    const dispatch = useDispatch();
    const pingPosition = useMemo(() => (
        buildVector3(ping.position)
    ), [ping.position]);
    const {sideMenuOpen} = useSelector(getTabletopStateFromStore);
    
    const onClick = useCallback((evt: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
        // This is a hack, but stopping propagation doesn't work between this DOM
        // event and the gesture control on the 3D Canvas - it doesn't even remain
        // true between this event handler and the one in gestureControls.
        evt.preventDefault();
        onSelectPeerId(peerId);
    }, [onSelectPeerId, peerId]);

    const [position, setPosition] = useState(pingPosition);
    const [avatarPosition, setAvatarPosition] = useState(pingPosition);
    const [arrowPosition, setArrowPosition] = useState<undefined | Vector3>();

    const positionRef = useRef(pingPosition.clone());
    const bounceRef = useRef(new Vector3());
    const expiredRef = useRef(false);
    useFrame(({camera, invalidate}) => {
        invalidate();
        const distanceFactor = camera.position.distanceTo(pingPosition) / 20;
        positionRef.current.copy(pingPosition);
        let moved = false;
        for (let index = 0; index < frustumRef.current.planes.length; ++index) {
            const plane = frustumRef.current.planes[index];
            // The Dom element doesn't scale down by distance, so we need to scale up the edge limits
            // the further away the point is.
            const leftBump = (sideMenuOpen && index === 1) ? LEFT_BUMP : 0;
            const edgeLimit = (EDGE_LIMIT[index] + leftBump) * distanceFactor;
            const distanceToPoint = plane.distanceToPoint(positionRef.current);
            if (distanceToPoint < edgeLimit) {
                // Move point into the frustum
                positionRef.current.addScaledVector(plane.normal, edgeLimit - distanceToPoint);
                moved = true;
            }
        }
        setPosition((prev) => (
            (prev.x === positionRef.current.x && prev.y === positionRef.current.y && prev.z === positionRef.current.z)
                ? prev : positionRef.current.clone()
        ));
        const pingAge = Date.now() - ping.timestamp;
        const bounceMagnitude = distanceFactor * Math.abs(Math.sin(pingAge / 400));
        camera.getWorldDirection(bounceRef.current).cross(BOUNCE_CROSS_VECTOR).multiplyScalar(bounceMagnitude);
        setAvatarPosition(bounceRef.current.clone());
        setArrowPosition(moved ? undefined : ARROW_POSITION.clone().addScaledVector(DOWN, -bounceMagnitude));
        if (pingAge > PING_DURATION_MS && !expiredRef.current) {
            expiredRef.current = true;
            dispatch(clearPingAction(peerId))
        }
    });

    const userData = useMemo(() => ({ping: peerId}), [peerId]);

    return (
        <group position={position} userData={userData}>
            <Html position={avatarPosition}>
                <div className='pingAvatar'>
                    <GoogleAvatar user={user} onClick={onClick}/>
                </div>
            </Html>
            {
                !arrowPosition ? null : (
                    <arrowHelper args={[DOWN, arrowPosition, 0.5, 0x0000ff, 0.5, 0.2]}/>
                )
            }
        </group>
    );
};

export default PingComponent;