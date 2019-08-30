import React, {Component} from 'react';
import {connect, DispatchProp} from 'react-redux';
import sizeMe, {ReactSizeMeProps} from 'react-sizeme';
import classNames from 'classnames';

import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {LoggedInUserReducerType} from '../redux/loggedInUserReducer';
import {
    getConnectedUsersFromStore, getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import GestureControls, {ObjectVector2} from '../container/gestureControls';
import GoogleAvatar from './googleAvatar';
import InputButton from './inputButton';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {
    addDeviceToGroupAction, DeviceLayoutReducerType, removeDeviceFromGroupAction,
    updateDevicePositionAction
} from '../redux/deviceLayoutReducer';
import StayInsideContainer from '../container/stayInsideContainer';
import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';

import './deviceLayoutComponent.css';

interface DeviceLayoutComponentOwnProps {
    onFinish: () => void;
}

interface DeviceLayoutComponentStoreProps {
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    myPeerId: MyPeerIdReducerType;
    deviceLayout: DeviceLayoutReducerType;
}

type DeviceLayoutComponentProps = DeviceLayoutComponentOwnProps & DeviceLayoutComponentStoreProps & Required<DispatchProp<ReduxStoreType>> & ReactSizeMeProps;

interface DeviceLayoutComponentState {
    scale: number;
    selected: string;
    blocked: boolean;
    touchingTab?: string;
    touchingDisplay?: string;
    gestureStart?: ObjectVector2;
    showMenuForDisplay?: string;
    menuPosition?: ObjectVector2;
}

class DeviceLayoutComponent extends Component<DeviceLayoutComponentProps, DeviceLayoutComponentState> {

    private anchorDiv: HTMLDivElement | null;
    private tabsDiv: HTMLDivElement | null;

    constructor(props: DeviceLayoutComponentProps) {
        super(props);
        this.onGestureStart = this.onGestureStart.bind(this);
        this.onGestureEnd = this.onGestureEnd.bind(this);
        this.onTap = this.onTap.bind(this);
        this.onPan = this.onPan.bind(this);
        this.onZoom = this.onZoom.bind(this);
        this.state = {
            scale: 0.2,
            selected: this.props.myPeerId!,
            blocked: false
        };
    }

    onGestureStart(gestureStart: ObjectVector2) {
        this.setState({gestureStart});
    }

    onGestureEnd() {
        this.setState({blocked: false, touchingTab: undefined, touchingDisplay: undefined, gestureStart: undefined});
    }

    onTap(position: ObjectVector2) {
        if (this.state.touchingTab) {
            this.setState({selected: this.state.touchingTab});
        } else if (this.state.touchingDisplay && this.props.deviceLayout.layout[this.state.touchingDisplay]) {
            this.setState({showMenuForDisplay: this.state.touchingDisplay, menuPosition: position})
        }
    }

    getPhysicalDimensions(peerId: string) {
        const isMe = (peerId === this.props.myPeerId);
        return {
            width: isMe ? this.props.size.width : this.props.connectedUsers[peerId].deviceWidth,
            height: isMe ? this.props.size.height : this.props.connectedUsers[peerId].deviceHeight
        }
    }

    onPan(delta: ObjectVector2) {
        const layout = this.props.deviceLayout.layout;
        if (this.state.touchingTab) {
            if (layout[this.state.touchingTab]) {
                this.setState({blocked: true});
            } else if (this.state.touchingTab !== this.state.selected) {
                let groupId;
                if (layout[this.state.selected]) {
                    groupId = layout[this.state.selected].deviceGroupId;
                } else {
                    groupId = this.state.selected;
                    this.props.dispatch(addDeviceToGroupAction(this.state.selected, groupId, 0, 0));
                }
                const {width, height} = this.getPhysicalDimensions(this.state.touchingTab);
                const adjustX = this.tabsDiv!.clientWidth + this.anchorDiv!.offsetLeft + width * this.state.scale / 2;
                const adjustY = this.anchorDiv!.offsetTop + height * this.state.scale / 2;
                const x = (this.state.gestureStart!.x - adjustX) / this.state.scale;
                const y = (this.state.gestureStart!.y - adjustY) / this.state.scale;
                this.props.dispatch(addDeviceToGroupAction(this.state.touchingTab, groupId, x, y));
                this.setState({touchingTab: undefined, touchingDisplay: this.state.touchingTab});
            }
        } else if (this.state.touchingDisplay && layout[this.state.touchingDisplay]) {
            let newX = layout[this.state.touchingDisplay].x + delta.x / this.state.scale;
            let newY = layout[this.state.touchingDisplay].y + delta.y / this.state.scale;
            const {width: touchingDisplayWidth, height: touchingDisplayHeight} = this.getPhysicalDimensions(this.state.touchingDisplay);
            // Push back outside colliding other displays
            Object.keys(layout).forEach((peerId) => {
                if (peerId !== this.state.touchingDisplay) {
                    const {width, height} = this.getPhysicalDimensions(peerId);
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
            this.props.dispatch(updateDevicePositionAction(this.state.touchingDisplay, newX, newY));
        }
    }

    onZoom(delta: ObjectVector2) {
        if (delta.y !== 0) {
            this.setState({scale: this.state.scale * (delta.y < 0 ? 1.1 : 0.9)});
        }
    }

    getUserForPeerId(peerId: string) {
        return (peerId === this.props.myPeerId) ? this.props.loggedInUser : this.props.connectedUsers[peerId].user;
    }

    renderTabs() {
        const peerIds = [this.props.myPeerId!, ...Object.keys(this.props.connectedUsers).sort((id1, id2) => {
            const name1 = this.props.connectedUsers[id1].user.displayName;
            const name2 = this.props.connectedUsers[id2].user.displayName;
            return name1 < name2 ? -1 : name1 === name2 ? 0 : 1;
        })]
            .filter((peerId) => (!this.props.deviceLayout.layout[peerId] || this.props.deviceLayout.layout[peerId].deviceGroupId === peerId));
        const layout = this.props.deviceLayout.layout;
        return (
            <div className='tabs' ref={(tabsDiv) => {this.tabsDiv = tabsDiv}}>
                {
                    peerIds.map((peerId) => (
                        <div key={'tab' + peerId} className={classNames('tab', {
                            selected: peerId === this.state.selected || (layout[this.state.selected] && layout[this.state.selected].deviceGroupId === peerId),
                            blocked: this.state.touchingTab !== undefined && this.state.blocked
                        })}
                             onMouseDown={() => {this.setState({touchingTab: peerId})}}
                             onTouchStart={() => {this.setState({touchingTab: peerId})}}
                        >
                            {
                                layout[peerId] ? (
                                    Object.keys(layout)
                                        .filter((otherId) => (layout[otherId].deviceGroupId === layout[peerId].deviceGroupId))
                                        .map((peerId, index, all) => (
                                            index < 2 ? (
                                                <GoogleAvatar key={peerId} user={this.getUserForPeerId(peerId)!}/>
                                            ) : index === 2 ? (
                                                <span key={'overflow' + peerId}
                                                    title={all.slice(2).map((peerId) => (this.getUserForPeerId(peerId)!.displayName)).join(', ')}
                                                >
                                                    + {all.length - 2}
                                                </span>
                                            ) : null
                                        ))
                                ) : (
                                    <GoogleAvatar user={this.getUserForPeerId(peerId)!}/>
                                )
                            }
                        </div>
                    ))
                }
            </div>
        );
    }

    renderDevice(peerId: string) {
        const loggedInUser = peerId === this.props.myPeerId;
        const connected = this.props.connectedUsers[peerId];
        const width = loggedInUser ? this.props.size.width : connected.deviceWidth;
        const height = loggedInUser ? this.props.size.height : connected.deviceHeight;
        const user = loggedInUser ? this.props.loggedInUser! : connected.user;
        const physicalWidth = width * this.state.scale;
        const physicalHeight = height * this.state.scale;
        const layout = this.props.deviceLayout.layout;
        const left = (layout[peerId] ? layout[peerId].x * this.state.scale : -physicalWidth / 2);
        const top = (layout[peerId] ? layout[peerId].y * this.state.scale : -physicalHeight / 2);
        return (
            <div className='deviceIcon' key={'device' + peerId} style={{left, top, width: physicalWidth, height: physicalHeight}}
                 onMouseDown={() => {this.setState({touchingDisplay: peerId})}}
                 onTouchStart={() => {this.setState({touchingDisplay: peerId})}}
            >
                <div className='screen'>
                    <GoogleAvatar user={user}/>
                </div>
            </div>
        );
    }

    renderLayoutDisplay() {
        const layout = this.props.deviceLayout.layout;
        const currentGroup = layout[this.state.selected];
        const displays = !currentGroup ? [this.state.selected]
            : Object.keys(layout)
                .filter((peerId) => (layout[peerId] && layout[peerId].deviceGroupId === currentGroup.deviceGroupId));
        return (
            <div className='layoutDisplay'>
                <div className='anchor' ref={(anchorDiv) => {this.anchorDiv = anchorDiv}}>
                    {
                        displays.map((peerId) => (this.renderDevice(peerId)))
                    }
                </div>
            </div>
        );
    }

    renderMenuForDisplay() {
        if (!this.state.showMenuForDisplay || !this.state.menuPosition) {
            return null;
        }
        return (
            <StayInsideContainer className='menu' containedWidth={this.props.size.width} containedHeight={this.props.size.height}
                                 top={this.state.menuPosition.y + 10} left={this.state.menuPosition.x + 10}>
                <OnClickOutsideWrapper onClickOutside={() => {this.setState({showMenuForDisplay: undefined, menuPosition: undefined})}}>
                    <InputButton onChange={() => {
                        this.props.dispatch(removeDeviceFromGroupAction(this.state.showMenuForDisplay!));
                        this.setState({showMenuForDisplay: undefined, menuPosition: undefined});
                    }} type='button'>
                        Detach device
                    </InputButton>
                </OnClickOutsideWrapper>
            </StayInsideContainer>
        );
    }

    render() {
        return (
            <div className='deviceLayoutComponent'>
                <div className='controlRow'>
                    <InputButton type='button' onChange={this.props.onFinish}>Finish</InputButton>
                    <div>
                        <p>Drag devices from the tabs on the left and arrange them as they are laid out physically to create a multi-device tabletop.</p>
                    </div>
                </div>
                <GestureControls className='deviceLayout' onGestureStart={this.onGestureStart} onGestureEnd={this.onGestureEnd}
                                 onTap={this.onTap} onZoom={this.onZoom} onPan={this.onPan}>
                    {this.renderTabs()}
                    {this.renderLayoutDisplay()}
                    {this.renderMenuForDisplay()}
                </GestureControls>
            </div>
        );
    }

}

function mapStoreToProps(store: ReduxStoreType): DeviceLayoutComponentStoreProps {
    return {
        connectedUsers: getConnectedUsersFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store),
        myPeerId: getMyPeerIdFromStore(store),
        deviceLayout: getDeviceLayoutFromStore(store)
    }
}

export default sizeMe({monitorHeight: true})(connect<DeviceLayoutComponentStoreProps, DispatchProp<ReduxStoreType>>(mapStoreToProps)(DeviceLayoutComponent));