import React, {Component} from 'react';
import * as PropTypes from 'prop-types';

import ProgressBar from './ProgressBar';

import './FileThumbnail.css';

class FileThumbnail extends Component {

    static propTypes = {
        fileId: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        isFolder: PropTypes.bool.isRequired,
        isJson: PropTypes.bool.isRequired,
        isValid: PropTypes.bool.isRequired,
        progress: PropTypes.number,
        thumbnailLink: PropTypes.string,
        onClick: PropTypes.func,
        highlight: PropTypes.bool
    };

    render() {
        return (
            <div className='fileThumbnail' onClick={() => (this.props.onClick(this.props.fileId))}>
                {
                    (this.props.isFolder) ? (
                        <div className='material-icons'>folder</div>
                    ) : this.props.isJson ? (
                        <div className='material-icons'>cloud</div>
                    ) : (
                        this.props.thumbnailLink ?
                            <img referrerPolicy='no-referrer' src={this.props.thumbnailLink} alt=''/> :
                            <ProgressBar progress={this.props.progress}/>
                    )
                }
                <div>{this.props.name}</div>
                {
                    this.props.isValid ? null : (
                        <div className='invalid'>&times;</div>
                    )
                }
                {
                    !this.props.highlight ? null : (
                        <div className='highlight'/>
                    )
                }
            </div>
        );
    }

}

export default FileThumbnail;