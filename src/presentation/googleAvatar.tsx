import React, {Component} from 'react';
import classNames from 'classnames';
import * as THREE from 'three';

import {DriveUser} from '../util/googleDriveUtils';
import {isColourDark} from '../util/threeUtils';

import './googleAvatar.scss';

interface GoogleAvatarProps {
    user: DriveUser;
    annotation?: string | number;
    annotationClassNames?: string;
    annotationTitle?: string;
    onClick?: (evt: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
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
            const backgroundColor = '#' + (hexString + '000000').substr(0, 6);
            const color = isColourDark(new THREE.Color(backgroundColor)) ? 'white' : 'black';
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
            <div className='googleAvatar' onMouseDown={this.props.onClick} onTouchStart={this.props.onClick}>
                {this.renderAvatar()}
                {this.renderAnnotation()}
            </div>
        )
    }
}