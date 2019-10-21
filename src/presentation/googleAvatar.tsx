import React, {Component} from 'react';
import classNames from 'classnames';

import {DriveUser} from '../util/googleDriveUtils';

import './googleAvatar.css';

interface GoogleAvatarProps {
    user: DriveUser;
    annotation?: string | number;
    annotationClassNames?: string;
    annotationTitle?: string;
}

export default class GoogleAvatar extends Component<GoogleAvatarProps> {
    renderAvatar() {
        if (this.props.user.icon) {
            return (
                <span className='material-icons' title={this.props.user.displayName}>{this.props.user.icon}</span>
            );
        } else if (this.props.user.photoLink) {
            return (
                <img src={this.props.user.photoLink} alt={this.props.user.displayName} title={this.props.user.displayName}/>
            );
        } else {
            const hexString = Number(this.props.user.permissionId).toString(16);
            const backgroundColor = '#' + hexString.substr(0, 6);
            const r = parseInt(hexString.substr(0, 2), 16);
            const g = parseInt(hexString.substr(2, 2), 16);
            const b = parseInt(hexString.substr(4, 2), 16);
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            const color = (yiq >= 128) ? 'black' : 'white';
            return (
                <div className='plain' style={{backgroundColor, color}}>
                    {this.props.user.displayName.substr(0, 1)}
                </div>
            );
        }
    }

    renderAnnotation() {
        return !this.props.annotation ? null : (
            <div className={classNames('annotation', this.props.annotationClassNames)} title={this.props.annotationTitle}>
                {this.props.annotation}
            </div>
        )
    }

    render() {
        return (
            <div className='googleAvatar'>
                {this.renderAvatar()}
                {this.renderAnnotation()}
            </div>
        )
    }
}