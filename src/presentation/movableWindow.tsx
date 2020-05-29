import * as React from 'react';
import * as PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import NewWindow from 'react-new-window';
import ReactResizeDetector from 'react-resize-detector';
import {connect} from 'react-redux';

import {MovableWindowReducerType, setMovableWindowPositionAction} from '../redux/movableWindowReducer';
import {getMovableWindowsFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';

import './movableWindow.scss';

export interface MovableWindowContext {
    windowPoppedOut: boolean;
}

interface MovableWindowProps extends GtoveDispatchProp {
    windows: MovableWindowReducerType;
    title: string;
    onClose: () => void;
    onPopOut?: () => void;
}

interface MovableWindowState {
    poppedOut: boolean;
    width?: number;
    height?: number;
}

class MovableWindow extends React.Component<MovableWindowProps, MovableWindowState> {

    static childContextTypes = {
        windowPoppedOut: PropTypes.bool
    };

    getChildContext(): MovableWindowContext {
        return {
            windowPoppedOut: this.state.poppedOut
        }
    }

    constructor(props: MovableWindowProps) {
        super(props);
        this.state = {
            poppedOut: false
        };
    }

    render() {
        const position = this.props.windows.window[this.props.title] || {x: 0, y: 0};
        return this.state.poppedOut ? (
            <NewWindow title={'gTove ' + this.props.title} onUnload={this.props.onClose} features={
                (this.state.width === undefined || this.state.height === undefined) ? undefined :
                {width: this.state.width + 1, height: this.state.height + 1}
            }>
                <div className='fullHeight'>
                    {this.props.children}
                </div>
            </NewWindow>
        ) : (
            <div className='movableWindowContainer'>
                <Draggable handle='.movableWindowHeader'
                           positionOffset={{x: '-50%', y: 'calc(-50vh - 50%)'}}
                           position={position}
                           onDrag={(_evt, data) => {
                                this.props.dispatch(setMovableWindowPositionAction(this.props.title, data.x, data.y));
                           }}
                >
                    <div className='movableWindow'>
                        <div className='movableWindowHeader'>
                            <span className='title'>{this.props.title}</span>
                            <span className='material-icons' onClick={() => {
                                this.setState({poppedOut: true});
                                this.props.onPopOut && this.props.onPopOut();
                            }}>open_in_new</span>
                            <span className='material-icons' onClick={this.props.onClose}>close</span>
                        </div>
                        <div className='movableWindowBody'>
                            <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={(width, height) => {this.setState({width, height})}}/>
                            {this.props.children}
                        </div>
                    </div>
                </Draggable>
            </div>
        )
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        windows: getMovableWindowsFromStore(store)
    }
}

export default connect(mapStoreToProps)(MovableWindow);