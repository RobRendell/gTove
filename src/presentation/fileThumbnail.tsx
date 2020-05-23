import * as React from 'react';
import classNames from 'classnames';

import ProgressBar from './progressBar';
import {default as DropDownMenu, DropDownMenuOption} from './dropDownMenu';
import Spinner from './spinner';
import {promiseSleep} from '../util/promiseSleep';
import Tooltip from './tooltip';

import './fileThumbnail.scss';

interface FileThumbnailProps {
    fileId: string;
    name: string;
    isFolder: boolean;
    isIcon: boolean;
    isNew: boolean;
    onClick?: (fileId: string) => void;
    progress?: number;
    thumbnailLink?: string;
    highlight?: boolean;
    disabled?: boolean;
    menuOptions?: DropDownMenuOption<any>[];
    icon?: string | React.ReactElement<any>;
    showBusySpinner: (show: boolean) => void;
    fetchMissingThumbnail?: () => Promise<void>;
}

interface FileThumbnailState {
    isRetrying: boolean;
    retry: number;
    missingThumbnailTimeout?: number;
}

class FileThumbnail extends React.Component<FileThumbnailProps, FileThumbnailState> {

    constructor(props: FileThumbnailProps) {
        super(props);
        this.fetchMissingThumbnail = this.fetchMissingThumbnail.bind(this);
        this.retryImageSrc = this.retryImageSrc.bind(this);
        this.state = {
            isRetrying: false,
            retry: 0
        };
    }

    componentDidMount() {
        this.checkMissingThumbnail();
    }

    componentDidUpdate() {
        this.checkMissingThumbnail();
    }

    componentWillUnmount() {
        if (this.state.missingThumbnailTimeout !== undefined) {
            window.clearTimeout(this.state.missingThumbnailTimeout);
        }
    }

    checkMissingThumbnail() {
        if (!this.state.missingThumbnailTimeout && this.props.fetchMissingThumbnail
                && !this.props.isFolder && !this.props.icon && this.props.progress === undefined && !this.props.thumbnailLink) {
            this.setState(() => ({missingThumbnailTimeout: window.setTimeout(this.fetchMissingThumbnail, 5000)}));
        }
    }

    async fetchMissingThumbnail() {
        if (this.props.fetchMissingThumbnail && !this.props.thumbnailLink) {
            await this.props.fetchMissingThumbnail();
            this.setState({missingThumbnailTimeout: window.setTimeout(this.fetchMissingThumbnail, 5000)});
        } else {
            this.setState({missingThumbnailTimeout: undefined});
        }
    }

    async retryImageSrc(evt: React.SyntheticEvent<HTMLImageElement>) {
        if (!this.state.isRetrying) {
            this.setState({isRetrying: true});
            const retry = this.state.retry + 1;
            const target = evt.currentTarget;
            target.src = '';
            await promiseSleep(500 * retry);
            this.setState({isRetrying: false, retry}, () => {
                target.src = this.props.thumbnailLink!;
            });
        }
    }

    renderNewIndicator() {
        return (!this.props.isNew || this.props.progress !== undefined) ? null : (
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
                showBusySpinner={this.props.showBusySpinner}
            />
        );
    }

    renderIcon() {
        if (typeof(this.props.icon) === 'string') {
            return (<div className='material-icons'>{this.props.icon}</div>);
        } else if (this.props.icon) {
            return this.props.icon;
        } else {
            return null;
        }
    }

    render() {
        return (
            <div className={classNames('fileThumbnail', {disabled: this.props.disabled})} onClick={() => {
                if (!this.props.disabled && this.props.onClick) {
                    this.props.onClick(this.props.fileId)
                }
            }}>
                <div className='imageDiv'>
                    {
                        (this.props.isFolder) ? (
                            <div className='material-icons'>folder</div>
                        ) : this.props.isIcon ? (
                            this.renderIcon()
                        ) : (
                            this.props.progress !== undefined ? (
                                <ProgressBar progress={this.props.progress}/>
                            ) : this.props.thumbnailLink ? (
                                <img src={this.props.thumbnailLink} alt='' onError={this.retryImageSrc} />
                            ) : (
                                <Tooltip className='pendingThumbnail' tooltip='Thumbnail not yet available'>
                                    <div className='material-icons'>movie</div>
                                    <Spinner size={20}/>
                                </Tooltip>
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