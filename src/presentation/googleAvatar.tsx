import './googleAvatar.scss';

import classNames from 'classnames';
import React, {Component} from 'react';
import * as THREE from 'three';
import stringHash from 'string-hash';

import {getColourHexString} from '../util/scenarioUtils';
import {DriveUser} from '../util/storage/providers/google/googleDriveUtils';
import {isColourDark} from '../util/threeUtils';
import Tooltip from './tooltip';

interface GoogleAvatarProps {
    user: DriveUser;
    annotation?: string | number;
    annotationClassNames?: string;
    annotationTooltip?: string;
    onClick?: (evt: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
}

export default class GoogleAvatar extends Component<GoogleAvatarProps> {
    renderAvatar() {
        if (this.props.user.icon) {
            return (
                <span className='material-icons'>{this.props.user.icon}</span>
            );
        } else if (this.props.user.photoLink) {
            return (
                <img src={this.props.user.photoLink} alt={this.props.user.displayName}/>
            );
        } else {
            const backgroundColor = getColourHexString(Math.floor(stringHash(this.props.user.permissionId) / 2));
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
            <Tooltip tooltip={this.props.annotationTooltip} className={classNames('annotation', this.props.annotationClassNames)}>
                {this.props.annotation}
            </Tooltip>
        );
    }

    render() {
        return (
            <div className='googleAvatar' onMouseDown={this.props.onClick} onTouchStart={this.props.onClick}>
                <Tooltip tooltip={this.props.user.displayName} verticalSpace={10}>
                    {this.renderAvatar()}
                </Tooltip>
                {this.renderAnnotation()}
            </div>
        )
    }
}