import './deviceLayoutComponent.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import GestureControls, {useGestureHandler} from '../container/gestureControls';
import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import {useCameraParameters} from '../context/cameraParametersProvider';
import {
    addDeviceToGroupAction,
    removeDeviceFromGroupAction,
    updateDevicePositionAction,
    updateGroupCameraAction
} from '../redux/deviceLayoutReducer';
import {LoggedInUserReducerType} from '../redux/loggedInUserReducerTypes';
import {
    getConnectedUsersFromStore,
    getDeviceLayoutFromStore,
    getMyPeerIdFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {ObjectVector2} from '../util/scenarioUtils';
import GoogleAvatar from './googleAvatar';
import InputButton from './inputButton';
import StayInsideContainer from './stayInsideContainer';
import Tooltip from './tooltip';

interface DeviceLayoutComponentProps {
    onFinish: () => void;
}

const DeviceLayoutComponent: FunctionComponent<DeviceLayoutComponentProps> = ({onFinish}) => {
    const {cameraPositionRef, cameraLookAtRef} = useCameraParameters();
    const dispatch = useDispatch();
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const deviceLayout = useSelector(getDeviceLayoutFromStore);
    const tabletopState = useSelector(getTabletopStateFromStore);
    
    const anchorRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);

    const [scale, setScale] = useState(0.2);
    const [selected, setSelected] = useState(myPeerId!);
    const [blocked, setBlocked] = useState(false);
    const [touchingTab, setTouchingTab] = useState<string | undefined>();
    const [touchingDisplay, setTouchingDisplay] = useState<string | undefined>();
    const [gestureStart, setGestureStart] = useState<ObjectVector2 | undefined>();
    const [showMenuForDisplay, setShowMenuForDisplay] = useState<string | undefined>();
    const [menuPosition, setMenuPosition] = useState<ObjectVector2 | undefined>();
    const [screenPosition, setScreenPosition] = useState({x: 0, y: 0});
    
    const getPhysicalDimensions = useCallback((peerId: string) => {
        return !connectedUsers.users[peerId] ? undefined : {
            width: connectedUsers.users[peerId].deviceWidth,
            height: connectedUsers.users[peerId].deviceHeight
        }
    }, [connectedUsers.users]);

    const getUserForPeerId = useCallback((peerId: string): LoggedInUserReducerType => {
        return connectedUsers.users[peerId] ? connectedUsers.users[peerId].user : null;
    }, [connectedUsers.users]);
    
    const onTap = useCallback((position: ObjectVector2) => {
        if (touchingTab) {
            setSelected(touchingTab);
        } else if (touchingDisplay && deviceLayout.layout[touchingDisplay]) {
            setShowMenuForDisplay(touchingDisplay);
            setMenuPosition(position);
        }
    }, [deviceLayout.layout, touchingDisplay, touchingTab]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        if (delta.y !== 0) {
            setScale((scale) => (scale * (delta.y < 0 ? 1.1 : 0.9)));
        }
    }, []);
    const onPan = useCallback((delta: ObjectVector2) => {
        const layout = deviceLayout.layout;
        if (touchingTab) {
            if (layout[touchingTab]) {
                setBlocked(true);
            } else if (touchingTab !== selected) {
                let groupId;
                if (layout[selected]) {
                    groupId = layout[selected].deviceGroupId;
                } else {
                    groupId = selected;
                    dispatch(addDeviceToGroupAction(selected, groupId, 0, 0));
                    dispatch(updateGroupCameraAction(myPeerId!, selected, {
                            cameraPosition: cameraPositionRef.current,
                            cameraLookAt: cameraLookAtRef.current}, 0,
                        tabletopState.focusMapId));
                }
                const size = getPhysicalDimensions(touchingTab);
                if (!size) {
                    return;
                }
                const {width, height} = size;
                const adjustX = tabsRef.current!.clientWidth + anchorRef.current!.offsetLeft + width * scale / 2;
                const adjustY = anchorRef.current!.offsetTop + height * scale / 2;
                const x = (gestureStart!.x - adjustX) / scale;
                const y = (gestureStart!.y - adjustY) / scale;
                dispatch(addDeviceToGroupAction(touchingTab, groupId, x, y));
                setTouchingTab(undefined);
                setTouchingDisplay(undefined);
            }
        } else if (touchingDisplay && layout[touchingDisplay]) {
            let newX = layout[touchingDisplay].x + delta.x / scale;
            let newY = layout[touchingDisplay].y + delta.y / scale;
            const size = getPhysicalDimensions(touchingDisplay);
            if (!size) {
                return;
            }
            const {width: touchingDisplayWidth, height: touchingDisplayHeight} = size;
            // Push back outside colliding other displays
            Object.keys(layout).forEach((peerId) => {
                const size = getPhysicalDimensions(peerId)
                if (peerId !== touchingDisplay && size) {
                    const {width, height} = size;
                    const {x, y} = layout[peerId];
                    const overlapRight = newX + touchingDisplayWidth - x;
                    const overlapLeft = x + width - newX;
                    const overlapBottom = newY + touchingDisplayHeight - y;
                    const overlapTop = y + height - newY;
                    if (overlapRight > 0 && overlapLeft > 0 && overlapTop > 0 && overlapBottom > 0) {
                        if (Math.min(overlapTop, overlapBottom) < Math.min(overlapLeft, overlapRight)) {
                            if (overlapTop < overlapBottom) {
                                newY += overlapTop;
                            } else {
                                newY -= overlapBottom;
                            }
                        } else {
                            if (overlapLeft < overlapRight) {
                                newX += overlapLeft;
                            } else {
                                newX -= overlapRight;
                            }
                        }
                    }
                }
            });
            dispatch(updateDevicePositionAction(touchingDisplay, newX, newY));
        } else {
            setScreenPosition({x: screenPosition.x + delta.x, y: screenPosition.y + delta.y})
        }
    }, [cameraLookAtRef, cameraPositionRef, deviceLayout.layout, dispatch, gestureStart, getPhysicalDimensions, myPeerId, scale, screenPosition.x, screenPosition.y, selected, tabletopState.focusMapId, touchingDisplay, touchingTab]);
    const onGestureEnd = useCallback(() => {
        setBlocked(false);
        setTouchingTab(undefined);
        setTouchingDisplay(undefined);
        setGestureStart(undefined);
    }, []);
    const gestureHandler = useMemo(() => ({
        id: 'deviceLayout',
        onGestureStart: setGestureStart,
        onTap,
        onZoom,
        onPan,
        onGestureEnd
    }), [onGestureEnd, onPan, onTap, onZoom]);
    useGestureHandler(gestureHandler);

    const renderDevice = useCallback((peerId: string) => {
        if (!connectedUsers.users[peerId]) {
            return null;
        }
        const {deviceWidth: width, deviceHeight: height, user} = connectedUsers.users[peerId];
        const physicalWidth = width * scale;
        const physicalHeight = height * scale;
        const layout = deviceLayout.layout;
        const left = (layout[peerId] ? layout[peerId].x * scale : -physicalWidth / 2) + screenPosition.x;
        const top = (layout[peerId] ? layout[peerId].y * scale : -physicalHeight / 2) + screenPosition.y;
        return (
            <div className='deviceIcon' key={'device' + peerId} style={{left, top, width: physicalWidth, height: physicalHeight}}
                 onMouseDown={() => {setTouchingDisplay(peerId);}}
                 onTouchStart={() => {setTouchingDisplay(peerId);}}
            >
                <div className='screen'>
                    <GoogleAvatar user={user}/>
                </div>
            </div>
        );
    }, [connectedUsers.users, deviceLayout.layout, scale, screenPosition.x, screenPosition.y]);

    const tabPeerIds = useMemo(() => (
        Object.keys(connectedUsers.users)
            .sort((id1, id2) => {
                const name1 = connectedUsers.users[id1].user.displayName;
                const name2 = connectedUsers.users[id2].user.displayName;
                return name1 < name2 ? -1 : name1 === name2 ? 0 : 1;
            })
            .filter((peerId) => (!deviceLayout.layout[peerId] || deviceLayout.layout[peerId].deviceGroupId === peerId))
    ), [connectedUsers.users, deviceLayout.layout]);

    const displays = useMemo(() => {
        const layout = deviceLayout.layout;
        const currentGroup = layout[selected];
        return !currentGroup ? [selected]
            : Object.keys(layout)
                .filter((peerId) => (layout[peerId] && layout[peerId].deviceGroupId === currentGroup.deviceGroupId))
    }, [deviceLayout.layout, selected])

    const renderMenuForDisplay = useCallback(() => (
        (!showMenuForDisplay || !menuPosition) ? null : (
            <StayInsideContainer className='menu' top={menuPosition.y + 10} left={menuPosition.x + 10}>
                <OnClickOutsideWrapper onClickOutside={() => {
                    setShowMenuForDisplay(undefined);
                    setMenuPosition(undefined);
                }}>
                    <InputButton type='button' onChange={() => {
                        dispatch(removeDeviceFromGroupAction(showMenuForDisplay!));
                        setShowMenuForDisplay(undefined);
                        setMenuPosition(undefined);
                    }}>
                        Detach device
                    </InputButton>
                </OnClickOutsideWrapper>
            </StayInsideContainer>
        )
    ), [dispatch, menuPosition, showMenuForDisplay]);

    return (
        <div className='deviceLayoutComponent'>
            <div className='controlRow'>
                <InputButton type='button' onChange={onFinish}>Finish</InputButton>
                <div>
                    <p>Drag devices from the tabs on the left and arrange them as they are laid out physically to create a multi-device tabletop.</p>
                </div>
            </div>
            <GestureControls className='deviceLayout' defaultHandler={gestureHandler}>
                <div className='tabs' ref={tabsRef}>
                    {
                        tabPeerIds.map((peerId) => (
                            <div key={'tab' + peerId} className={classNames('tab', {
                                selected: peerId === selected || (deviceLayout.layout[selected] && deviceLayout.layout[selected].deviceGroupId === peerId),
                                blocked: touchingTab !== undefined && blocked
                            })}
                                 onMouseDown={() => {setTouchingTab(peerId);}}
                                 onTouchStart={() => {setTouchingTab(peerId);}}
                            >
                                {
                                    deviceLayout.layout[peerId] ? (
                                        Object.keys(deviceLayout.layout)
                                            .filter((otherId) => (deviceLayout.layout[otherId].deviceGroupId === deviceLayout.layout[peerId].deviceGroupId))
                                            .map((peerId, index, all) => {
                                                const user = getUserForPeerId(peerId);
                                                return !user ? null : (
                                                    index < 2 ? (
                                                        <GoogleAvatar key={peerId} user={user}/>
                                                    ) : index === 2 ? (
                                                        <Tooltip key={'overflow' + peerId}
                                                                 tooltip={all.slice(2).map(() => (user.displayName)).join(', ')}
                                                        >
                                                            + {all.length - 2}
                                                        </Tooltip>
                                                    ) : null
                                                )
                                            })
                                    ) : (
                                        <GoogleAvatar user={getUserForPeerId(peerId)!}/>
                                    )
                                }
                            </div>
                        ))
                    }
                </div>
                <div className='layoutDisplay'>
                    <div className='anchor' ref={anchorRef}>
                        {
                            displays.map((peerId) => (renderDevice(peerId)))
                        }
                    </div>
                </div>
                {renderMenuForDisplay()}
            </GestureControls>
        </div>
    );
}

export default DeviceLayoutComponent;
