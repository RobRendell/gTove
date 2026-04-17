import './deviceLayoutComponent.scss';

import classNames from 'classnames';
import {FunctionComponent, useCallback, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';

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

const snapThreshold = 10;

const DeviceLayoutComponent: FunctionComponent = () => {
    const {cameraPositionRef, cameraLookAtRef} = useCameraParameters();
    const dispatch = useDispatch();
    const store = useStore();
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const deviceLayout = useSelector(getDeviceLayoutFromStore);
    const tabletopState = useSelector(getTabletopStateFromStore);

    const anchorRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);
    const touchingTabRef = useRef<string | undefined>();
    const touchingDisplayRef = useRef<string | undefined>();
    const gestureOffsetRef = useRef<undefined | ObjectVector2>();

    const [scale, setScale] = useState(0.2);
    const [selectedTab, setSelectedTab] = useState(myPeerId!);
    const [blocked, setBlocked] = useState(false);
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
    
    const onGestureStart = useCallback((startPos: ObjectVector2) => {
        const layout = !touchingDisplayRef.current ? undefined
            : getDeviceLayoutFromStore(store.getState()).layout[touchingDisplayRef.current];
        if (layout) {
            gestureOffsetRef.current = {x: layout.x - startPos.x, y: layout.y - startPos.y};
        }
    }, [store]);
    const onZoom = useCallback((delta: ObjectVector2) => {
        if (delta.y !== 0) {
            setScale((scale) => (scale * (delta.y < 0 ? 1.1 : 0.9)));
        }
    }, []);
    const onPan = useCallback((delta: ObjectVector2, position: ObjectVector2, gestureStart: ObjectVector2) => {
        const {layout} = getDeviceLayoutFromStore(store.getState());
        if (touchingTabRef.current) {
            if (layout[touchingTabRef.current]) {
                setBlocked(true);
            } else if (touchingTabRef.current !== selectedTab) {
                let groupId;
                if (layout[selectedTab]) {
                    groupId = layout[selectedTab].deviceGroupId;
                } else {
                    groupId = selectedTab;
                    dispatch(addDeviceToGroupAction(selectedTab, groupId, 0, 0));
                    dispatch(updateGroupCameraAction(myPeerId!, selectedTab, {
                            cameraPosition: cameraPositionRef.current,
                            cameraLookAt: cameraLookAtRef.current}, 0,
                        tabletopState.focusMapId));
                }
                const size = getPhysicalDimensions(touchingTabRef.current);
                if (!size) {
                    return;
                }
                const {width, height} = size;
                const adjustX = tabsRef.current!.clientWidth + anchorRef.current!.offsetLeft + width * scale / 2;
                const adjustY = anchorRef.current!.offsetTop + height * scale / 2;
                const x = (gestureStart.x - adjustX) / scale;
                const y = (gestureStart.y - adjustY) / scale;
                dispatch(addDeviceToGroupAction(touchingTabRef.current, groupId, x, y));
                touchingDisplayRef.current = touchingTabRef.current;
                touchingTabRef.current = undefined;
                gestureOffsetRef.current = {x: x - gestureStart.x, y: y - gestureStart.y};
            }
        } else if (touchingDisplayRef.current && layout[touchingDisplayRef.current] && gestureOffsetRef.current) {
            const size = getPhysicalDimensions(touchingDisplayRef.current);
            if (!size) {
                return;
            }
            // Create a set of snap points in X and Y dimensions, and the rects for the other displays
            const {snapX, snapY, rects} = Object.values(layout).reduce((accum, device) => {
                const size = getPhysicalDimensions(device.peerId)
                if (size && device.peerId !== touchingDisplayRef.current) {
                    const left = device.x, right = left + size.width;
                    const top = device.y, bottom = top + size.height;
                    accum.snapX.push(left, right);
                    accum.snapY.push(top, bottom);
                    accum.rects.push({left, right, top, bottom});
                }
                return accum;
            }, {snapX: [] as number[], snapY: [] as number[], rects: [] as {left: number, right: number, top: number, bottom: number}[]});

            // Get the display's coordinates matching the current mouse position, then adjust them.
            let newX = gestureStart.x + (position.x - gestureStart.x) / scale + gestureOffsetRef.current.x;
            let newY = gestureStart.y + (position.y - gestureStart.y) / scale + gestureOffsetRef.current.y;
            // Snap to the nearest snapX and snapY values.
            newX += getSnapAdjustment([newX, newX + size.width], snapX, snapThreshold / scale);
            newY += getSnapAdjustment([newY, newY + size.height], snapY, snapThreshold / scale);
            // Push back outside the rects of other displays
            for (const rect of rects) {
                const overlapRight = newX + size.width - rect.left;
                const overlapLeft = rect.right - newX;
                const overlapBottom = newY + size.height - rect.top;
                const overlapTop = rect.bottom - newY;
                if (overlapRight > 0 && overlapLeft > 0 && overlapTop > 0 && overlapBottom > 0) {
                    if (Math.min(overlapTop, overlapBottom) < Math.min(overlapLeft, overlapRight)) {
                        newY += (overlapTop < overlapBottom) ? overlapTop : -overlapBottom;
                    } else {
                        newX += (overlapLeft < overlapRight) ? overlapLeft : -overlapRight;
                    }
                }
            }
            dispatch(updateDevicePositionAction(touchingDisplayRef.current, newX, newY));
        } else {
            setScreenPosition(({x, y}) => ({x: x + delta.x, y: y + delta.y}))
        }
    }, [cameraLookAtRef, cameraPositionRef, dispatch, getPhysicalDimensions, myPeerId, scale, store, selectedTab, tabletopState.focusMapId]);
    const onTap = useCallback((position: ObjectVector2) => {
        if (touchingTabRef.current) {
            setSelectedTab(touchingTabRef.current);
        } else if (touchingDisplayRef.current) {
            setShowMenuForDisplay(touchingDisplayRef.current);
            setMenuPosition(position);
        }
    }, []);
    const onGestureEnd = useCallback(() => {
        setBlocked(false);
        touchingTabRef.current = undefined;
        touchingDisplayRef.current = undefined;
        gestureOffsetRef.current = undefined;
    }, []);
    const gestureHandler = useMemo(() => ({
        id: 'deviceLayout',
        onGestureStart,
        onTap,
        onZoom,
        onPan,
        onGestureEnd
    }), [onGestureEnd, onGestureStart, onPan, onTap, onZoom]);
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
                 onMouseDown={() => {touchingDisplayRef.current = peerId;}}
                 onTouchStart={() => {touchingDisplayRef.current = peerId;}}
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
        const currentGroup = layout[selectedTab];
        return !currentGroup ? [selectedTab]
            : Object.keys(layout)
                .filter((peerId) => (layout[peerId] && layout[peerId].deviceGroupId === currentGroup.deviceGroupId))
    }, [deviceLayout.layout, selectedTab]);

    const displayMenuDisabled = (!showMenuForDisplay || !deviceLayout.layout[showMenuForDisplay]);
    const tapMenu = useMemo(() => {
        function bump(dX: number, dY: number) {
            if (showMenuForDisplay) {
                const {layout} = getDeviceLayoutFromStore(store.getState());
                const display = layout[showMenuForDisplay];
                dispatch(updateDevicePositionAction(showMenuForDisplay, display.x + dX, display.y + dY));
            }
        }
        return !showMenuForDisplay ? null : (
            <div className='tapMenu'>
                <InputButton type='button' disabled={displayMenuDisabled} onChange={() => {
                    dispatch(removeDeviceFromGroupAction(showMenuForDisplay!));
                    setShowMenuForDisplay(undefined);
                    setMenuPosition(undefined);
                }}>
                    Detach device
                </InputButton>
                <InputButton type='button' disabled={displayMenuDisabled} onChange={() => {
                    bump(0, -1);
                }}>Up 1 pixel</InputButton>
                <InputButton type='button' disabled={displayMenuDisabled} onChange={() => {
                    bump(0, 1);
                }}>Down 1 pixel</InputButton>
                <InputButton type='button' disabled={displayMenuDisabled} onChange={() => {
                    bump(-1, 0);
                }}>Left 1 pixel</InputButton>
                <InputButton type='button' disabled={displayMenuDisabled} onChange={() => {
                    bump(1, 0);
                }}>Right 1 pixel</InputButton>
            </div>
        );
    }, [dispatch, displayMenuDisabled, showMenuForDisplay, store]);

    const onClickOutside = useCallback(() => {
        setShowMenuForDisplay(undefined);
        setMenuPosition(undefined);
    }, []);

    const renderMenuForDisplay = useCallback(() => (
        (!showMenuForDisplay || !menuPosition) ? null : (
            <StayInsideContainer className='menu' top={menuPosition.y + 10} left={menuPosition.x + 10}>
                <OnClickOutsideWrapper onClickOutside={onClickOutside}>{tapMenu}</OnClickOutsideWrapper>
            </StayInsideContainer>
        )
    ), [menuPosition, onClickOutside, showMenuForDisplay, tapMenu]);

    return (
        <div className='deviceLayoutComponent'>
            <div className='controlRow'>
                <div>
                    <p>Drag devices from the tabs on the left, drag and zoom to arrange them as they are laid out
                        physically to create a multi-device tabletop. Tap individual displays for more options.</p>
                </div>
            </div>
            <GestureControls className='deviceLayout' defaultHandler={gestureHandler}>
                <div className='tabs' ref={tabsRef}>
                    {
                        tabPeerIds.map((peerId) => (
                            <div key={'tab' + peerId} className={classNames('tab', {
                                selected: peerId === selectedTab || (deviceLayout.layout[selectedTab] && deviceLayout.layout[selectedTab].deviceGroupId === peerId),
                                blocked: touchingTabRef.current !== undefined && blocked
                            })}
                                 onMouseDown={() => {touchingTabRef.current = peerId;}}
                                 onTouchStart={() => {touchingTabRef.current = peerId;}}
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

function getSnapAdjustment(values: number[], targets: number[], snapThreshold: number) {
    let min: number | undefined = undefined;
    for (const target of targets) {
        for (const value of values) {
            const delta = target - value;
            if (Math.abs(delta) < snapThreshold && (min === undefined || Math.abs(delta) < Math.abs(min))) {
                min = delta;
                if (min === 0) {
                    return min;
                }
            }
        }
    }
    return min ?? 0;
}