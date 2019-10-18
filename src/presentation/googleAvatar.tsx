import React, {Component} from 'react';

import {DriveUser} from '../util/googleDriveUtils';

import './googleAvatar.css';

interface GoogleAvatarProps {
    user: DriveUser;
}

export default class GoogleAvatar extends Component<GoogleAvatarProps> {
    render() {
        if (this.props.user.icon) {
            return (
                <span className='googleAvatar material-icons' title={this.props.user.displayName}>{this.props.user.icon}</span>
            );
        } else if (this.props.user.photoLink) {
            return (
                <img className='googleAvatar' src={this.props.user.photoLink} alt={this.props.user.displayName} title={this.props.user.displayName}/>);
        } else {
            const hexString = Number(this.props.user.permissionId).toString(16);
            const backgroundColor = '#' + hexString.substr(0, 6);
            const r = parseInt(hexString.substr(0, 2), 16);
            const g = parseInt(hexString.substr(2, 2), 16);
            const b = parseInt(hexString.substr(4, 2), 16);
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            const color = (yiq >= 128) ? 'black' : 'white';
            return (
                <div className='googleAvatar plain' style={{backgroundColor, color}}>
                    {this.props.user.displayName.substr(0, 1)}
                </div>
            );
        }
    }
}