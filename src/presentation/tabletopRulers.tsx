import {FunctionComponent, useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Vector3} from 'three';

import {GestureHandler, useGestureHandler} from '../container/gestureControls';
import {useMapPathData} from '../hooks/useMapPathData';
import {updateUserRulerAction, updateUserRulerDistanceAction} from '../redux/connectedUserReducer';
import {ConnectedUserRuler} from '../redux/connectedUserReducerTypes';
import {
    getConnectedUsersFromStore,
    getMyPeerIdFromStore,
    getTabletopFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {MapPathData, ObjectVector2, snapMini} from '../util/scenarioUtils';
import {buildVector3, vector3ToObject} from '../util/threeUtils';
import LabelSprite from './labelSprite';
import TabletopPathComponent from './tabletopPathComponent';
import {TabletopViewGestureContext} from './tabletopViewComponent';

interface TabletopRulersProps {
    snapToGrid: boolean;
    labelSize: number;
    raycastToMapOrPlane: (position: ObjectVector2) => {mapId?: string; position: Vector3};
}

const TabletopRulers: FunctionComponent<TabletopRulersProps> = ({snapToGrid, labelSize, raycastToMapOrPlane}) => {
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const {defaultGrid, labelColour} = useSelector(getTabletopFromStore);
    const {dragMode} = useSelector(getTabletopStateFromStore);

    const rulerPeerIds = useMemo(() => (
        Object.keys(connectedUsers.users).filter((peerId) => (
            connectedUsers.users[peerId].ruler
        ))
    ), [connectedUsers.users]);
    const mapPathData = useMapPathData();

    const dispatch = useDispatch();

    // Gesture handling.
    const match = useCallback((context: TabletopViewGestureContext) => (
        !context.dragHandle && dragMode === 'measureDistanceMode'
    ), [dragMode]);
    const onPan = useCallback((_delta: ObjectVector2, startPos: ObjectVector2) => {
        if (myPeerId && connectedUsers) {
            let ruler = connectedUsers.users[myPeerId]?.ruler;
            const {mapId, position} = raycastToMapOrPlane(startPos);
            const gridType = (!mapId ? undefined : mapPathData[mapId]?.gridType) ?? defaultGrid;
            const snappedEnd = snapMini(snapToGrid, gridType, 1, vector3ToObject(position), 0);
            if (ruler) {
                ruler = {
                    ...ruler,
                    end: {...snappedEnd.positionObj}
                }
            } else {
                raycastToMapOrPlane(startPos);
                const snappedStart = snapMini(snapToGrid, gridType, 1, vector3ToObject(position), 0);
                ruler = {
                    start: {...snappedStart.positionObj, onMapId: mapId},
                    end: snappedEnd.positionObj,
                    distance: '',
                    mapId
                }
            }
            dispatch(updateUserRulerAction(myPeerId, ruler));
        }
    }, [connectedUsers, defaultGrid, dispatch, mapPathData, myPeerId, raycastToMapOrPlane, snapToGrid]);
    const onGestureEnd = useCallback(() => {
        if (myPeerId) {
            dispatch(updateUserRulerAction(myPeerId))
        }
    }, [dispatch, myPeerId]);
    const gestureHandler = useMemo<GestureHandler<TabletopViewGestureContext>>(() => ({
        id: 'tabletopRulers',
        priority: 10,
        match,
        onPan,
        onGestureEnd
    }), [match, onGestureEnd, onPan]);
    useGestureHandler(gestureHandler);

    return rulerPeerIds.length === 0 ? null : rulerPeerIds.map((peerId) => (
        <SingleRuler key={'ruler_' + peerId}
                     peerId={peerId}
                     ruler={connectedUsers.users[peerId].ruler!}
                     snapToGrid={snapToGrid}
                     labelSize={labelSize}
                     labelColour={labelColour}
                     myPeerId={myPeerId}
                     mapPathData={mapPathData}
        />
    ));

};

export default TabletopRulers;

interface SingleRulerProps {
    peerId: string;
    ruler: ConnectedUserRuler;
    snapToGrid: boolean;
    labelSize: number;
    labelColour?: string;
    myPeerId: string | null;
    mapPathData: MapPathData;
}

const SingleRuler: FunctionComponent<SingleRulerProps> = ({
                                                              peerId,
                                                              ruler,
                                                              snapToGrid,
                                                              labelSize,
                                                              labelColour,
                                                              myPeerId,
                                                              mapPathData
                                                          }) => {
    const dispatch = useDispatch();

    const {length, labelPosition} = useMemo(() => {
        const vectorStart = buildVector3(ruler.start);
        const vectorEnd = buildVector3(ruler.end);
        const length = vectorStart.distanceTo(vectorEnd);
        const labelPosition = vectorEnd.add(vectorStart).multiplyScalar(0.5);
        labelPosition.y = Math.max(ruler.end.y, ruler.start.y) + 0.5;
        return {length, labelPosition}
    }, [ruler.end, ruler.start]);
    const onUpdateMovedSuffix = useCallback((distance: string) => {
        if (myPeerId === peerId) {
            dispatch(updateUserRulerDistanceAction(myPeerId, distance));
        }
    }, [dispatch, myPeerId, peerId]);

    return (
        <>
            <TabletopPathComponent
                miniId={peerId}
                positionObj={ruler.end}
                movementPath={[ruler.start]}
                roundToGrid={snapToGrid}
                updateMovedSuffix={onUpdateMovedSuffix}
                mapPathData={mapPathData}
            />
            <LabelSprite position={labelPosition} renderOrder={labelPosition.y} label={ruler.distance}
                         labelSize={labelSize * Math.max(2, length / 2)} fillColour={labelColour}
            />
        </>
    )
}

