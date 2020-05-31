import * as React from 'react';
import * as PropTypes from 'prop-types';
import {Rnd as Draggable} from 'react-rnd';
import NewWindow from 'react-new-window';
import {connect} from 'react-redux';
import {findDOMNode} from 'react-dom';
import {createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal} from 'react-reverse-portal';

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

    private readonly portalNode: HtmlPortalNode;
    private bodyRef = React.createRef<HTMLDivElement>();

    constructor(props: MovableWindowProps) {
        super(props);
        this.onPopOut = this.onPopOut.bind(this);
        this.portalNode = createHtmlPortalNode();
        this.portalNode.element.setAttribute('class', 'fullHeight');
        this.state = {
            poppedOut: false
        };
    }

    onPopOut() {
        this.setState({poppedOut: true});
        this.props.onPopOut && this.props.onPopOut();
    }

    private renderPoppedOutWindow() {
        let size;
        if (this.bodyRef.current) {
            const {width, height} = this.bodyRef.current.getBoundingClientRect();
            size = {width, height};
        }
        return (
            <NewWindow title={'gTove ' + this.props.title} onUnload={this.props.onClose} features={size}>
                <OutPortal node={this.portalNode}/>
            </NewWindow>
        );
    }

    private renderDraggableWindow() {
        const moveWindow = this.props.windows.window[this.props.title];
        const position = moveWindow ? {x: moveWindow.x, y: moveWindow.y} : {x: 0, y: 0};
        const size = (moveWindow && moveWindow.width && moveWindow.height) ? {
            width: moveWindow.width,
            height: moveWindow.height
        } : undefined;
        return (
            <Draggable dragHandleClassName='movableWindowHeader'
                       position={position}
                       size={size}
                       resizeHandleStyles={{
                           topRight: {display: 'none'}
                       }}
                       ref={(ref) => {
                           if (ref && !size) {
                               const node = findDOMNode(ref) as Element;
                               let {width, height} = node.getBoundingClientRect();
                               const {clientWidth, clientHeight} = document.body;
                               if (width > clientWidth / 2 || height > clientHeight / 2) {
                                   width = Math.min(width, clientWidth / 2);
                                   height = Math.min(height, clientHeight / 2);
                                   this.props.dispatch(setMovableWindowSizeAction(this.props.title, width, height));
                               }
                               if (position.x === 0 && position.y === 0) {
                                   this.props.dispatch(setMovableWindowPositionAction(this.props.title, (clientWidth - width) / 2, (clientHeight - height) / 2));
                               }
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
                        <span className='material-icons'
                              onClick={this.onPopOut}
                              onTouchStart={this.onPopOut}
                        >open_in_new</span>
                        <span className='material-icons'
                              onClick={this.props.onClose}
                              onTouchStart={this.props.onClose}
                        >close</span>
                    </div>
                    <div className='movableWindowBody' ref={this.bodyRef}>
                        <OutPortal node={this.portalNode}/>
                    </div>
                </div>
            </Draggable>
        );
    }

    render() {
        return (
            <>
                <InPortal node={this.portalNode}>
                    {this.props.children}
                </InPortal>
                {
                    this.state.poppedOut ? (
                        this.renderPoppedOutWindow()
                    ) : (
                        this.renderDraggableWindow()
                    )
                }
            </>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        windows: getMovableWindowsFromStore(store)
    }
}

export default connect(mapStoreToProps)(MovableWindow);