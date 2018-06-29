import * as React from 'react';
import * as PropTypes from 'prop-types';

import ProgressBar from './progressBar';
import {default as DropDownMenu, DropDownMenuOption} from './dropDownMenu';

import './fileThumbnail.css';

interface FileThumbnailProps {
    fileId: string;
    name: string;
    isFolder: boolean;
    isJson: boolean;
    isNew: boolean;
    onClick: (fileId: string) => void;
    progress?: number;
    thumbnailLink?: string;
    highlight?: boolean;
    menuOptions?: DropDownMenuOption[];
}

class FileThumbnail extends React.Component<FileThumbnailProps> {

    static propTypes = {
        fileId: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        isFolder: PropTypes.bool.isRequired,
        isJson: PropTypes.bool.isRequired,
        isNew: PropTypes.bool.isRequired,
        onClick: PropTypes.func.isRequired,
        progress: PropTypes.number,
        thumbnailLink: PropTypes.string,
        highlight: PropTypes.bool,
        menuOptions: PropTypes.arrayOf(PropTypes.object)
    };

    renderNewIndicator() {
        return (!this.props.thumbnailLink || !this.props.isNew) ? null : (
            <div className='newThumbnail material-icons'>fiber_new</div>
        );
    }

    renderHighlight() {
        return !this.props.highlight ? null : (
            <div className='highlight'/>
        );
    }

    renderMenu() {
        return !this.props.menuOptions ? null : (
            <DropDownMenu
                className='dropDownMenu'
                menu={<span className='material-icons'>more_horiz</span>}
                options={this.props.menuOptions}
            />
        );
    }

    render() {
        return (
            <div className='fileThumbnail' onClick={() => (this.props.onClick(this.props.fileId))}>
                <div className='imageDiv'>
                    {
                        (this.props.isFolder) ? (
                            <div className='material-icons'>folder</div>
                        ) : this.props.isJson ? (
                            <div className='material-icons'>cloud</div>
                        ) : (
                            this.props.thumbnailLink ? (
                                <img src={this.props.thumbnailLink} alt=''/>
                            ) : (
                                <ProgressBar progress={this.props.progress || 0}/>
                            )
                        )
                    }
                    {this.renderMenu()}
                    {this.renderNewIndicator()}
                    {this.renderHighlight()}
                </div>
                <div className='nameLabel'>{this.props.name}</div>
            </div>
        );
    }

}

export default FileThumbnail;