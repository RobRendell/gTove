import {useFrame} from '@react-three/fiber';
import {FunctionComponent, useCallback, useMemo, useRef} from 'react';
import {useSelector, useStore} from 'react-redux';
import {Frustum, Matrix4} from 'three';

import {useCameraParameters} from '../context/cameraParametersContextBridge';
import {getConnectedUsersFromStore, getPingsFromStore, getScenarioFromStore} from '../redux/mainReducer';
import {getBaseCameraParameters} from '../util/scenarioUtils';
import {buildVector3} from '../util/threeUtils';
import PingComponent from './pingComponent';

interface TabletopPingsComponentProps {
    sideMenuOpen?: boolean;
}

const TabletopPingsComponent: FunctionComponent<TabletopPingsComponentProps> = ({sideMenuOpen}) => {
    const pings = useSelector(getPingsFromStore);
    const {setCameraParameters} = useCameraParameters();
    
    const frustumRef = useRef(new Frustum());
    const activePingIds = useMemo(() => (
        Object.keys(pings.active)
    ), [pings.active]);
    const store = useStore();
    const connectedUsers = useSelector(getConnectedUsersFromStore);

    const matrix4Ref = useRef(new Matrix4());
    useFrame(({camera}) => {
        if (activePingIds.length) {
            camera.updateMatrix();
            camera.updateMatrixWorld();
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            matrix4Ref.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
            frustumRef.current.setFromProjectionMatrix(matrix4Ref.current);
        }
    });

    const onSelectPeerId = useCallback((pingId: string) => {
        // Zoom camera to ping
        const cameraLookAt = buildVector3(pings.active[pingId].position);
        const focusMapId = pings.active[pingId].focusMapId;
        const map = focusMapId ? getScenarioFromStore(store.getState()).maps[focusMapId] : undefined;
        const cameraPosition = getBaseCameraParameters(map, 0.5, cameraLookAt).cameraPosition;
        setCameraParameters({cameraPosition, cameraLookAt}, 1000, focusMapId);
    }, [pings.active, setCameraParameters, store]);

    return (
        <>
            {
                activePingIds.map((peerId) => (
                    <PingComponent key={peerId}
                                   peerId={peerId}
                                   user={connectedUsers.users[peerId].user}
                                   ping={pings.active[peerId]}
                                   onSelectPeerId={onSelectPeerId}
                                   frustumRef={frustumRef}
                                   bumpLeft={sideMenuOpen}
                    />
                ))
            }
        </>
    )
}

export default TabletopPingsComponent;