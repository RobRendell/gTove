import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Rnd as Draggable} from 'react-rnd';
import NewWindow from 'react-new-window';
import {connect} from 'react-redux';
import {findDOMNode} from 'react-dom';

import {
    MovableWindowReducerType,
    setMovableWindowPositionAction,
    setMovableWindowSizeAction
} from '../redux/movableWindowReducer';
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
        this.onPopOut = this.onPopOut.bind(this);
        this.state = {
            poppedOut: false
        };
    }

    onPopOut() {
        this.setState({poppedOut: true});
        this.props.onPopOut && this.props.onPopOut();
    }

    render() {
        const window = this.props.windows.window[this.props.title];
        const position = window ? {x: window.x, y: window.y} : {x: 0, y: 0};
        const size = (window && window.width && window.height) ? {width: window.width, height: window.height} : undefined;
        return this.state.poppedOut ? (
            <NewWindow title={'gTove ' + this.props.title} onUnload={this.props.onClose} features={
                (size === undefined) ? undefined : {width: size.width + 1, height: size.height + 1}
            }>
                <div className='fullHeight'>
                    {this.props.children}
                </div>
            </NewWindow>
        ) : (
            <Draggable dragHandleClassName='movableWindowHeader'
                       position={position}
                       size={size}
                       resizeHandleStyles={{
                           topRight: {display: 'none'}
                       }}
                       ref={(ref) => {
                           if (ref && !size) {
                               const node = findDOMNode(ref) as Element;
                               const rect = node.getBoundingClientRect();
                               const {clientWidth, clientHeight} = document.body;
                               const width = Math.min(rect.width, clientWidth / 2);
                               const height = Math.min(rect.height, clientHeight / 2);
                               this.props.dispatch(setMovableWindowSizeAction(this.props.title, width, height));
                               this.props.dispatch(setMovableWindowPositionAction(this.props.title, (clientWidth - width) / 2, (clientHeight - height) / 2));
                           }
                       }}
                       onDragStop={(_evt, data) => {
                            this.props.dispatch(setMovableWindowPositionAction(this.props.title, data.x, data.y));
                       }}
                       onResizeStop={(_evt, _direction, ref, _delta, position) => {
                           this.props.dispatch(setMovableWindowSizeAction(this.props.title, parseInt(ref.style.width), parseInt(ref.style.height)));
                           this.props.dispatch(setMovableWindowPositionAction(this.props.title, position.x, position.y));
                       }}
            >
                <div className='movableWindow'>
                    <div className='movableWindowHeader'>
                        <span className='title'>{this.props.title}</span>
                        <span className='material-icons' onClick={this.onPopOut} onTouchStart={this.onPopOut}>open_in_new</span>
                        <span className='material-icons' onClick={this.props.onClose} onTouchStart={this.props.onClose}>close</span>
                    </div>
                    <div className='movableWindowBody'>
                        <div className='fullHeight'>
                            {this.props.children}
                        </div>
                    </div>
                </div>
            </Draggable>
        )
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        windows: getMovableWindowsFromStore(store)
    }
}

export default connect(mapStoreToProps)(MovableWindow);