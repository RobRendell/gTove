import React, {Component} from 'react';
import * as PropTypes from 'prop-types';

import ProgressBar from './ProgressBar';
import * as constants from '../util/constants';

import './FileThumbnail.css';

class FileThumbnail extends Component {

    static propTypes = {
        metadata: PropTypes.object.isRequired,
        progress: PropTypes.number,
        onClick: PropTypes.func
    };

    render() {
        return (
            <div className='fileThumbnail' onClick={() => (this.props.onClick(this.props.metadata))}>
                {
                    (this.props.metadata.mimeType === constants.MIME_TYPE_DRIVE_FOLDER) ? (
                        <span className='material-icons'>folder</span>
                    ) : (
                        this.props.metadata.thumbnailLink ?
                            <img src={this.props.metadata.thumbnailLink} alt=''/> :
                            <ProgressBar progress={this.props.progress}/>
                    )
                }
                <span>{this.props.metadata.name}</span>
            </div>
        );
    }

}

export default FileThumbnail;