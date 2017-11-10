import React, {Component} from 'react';
import PropTypes from 'prop-types';

function vectorFromMouseEvent(event) {
    return {x: event.clientX, y: event.clientY};
}

function vectorsFromTouchEvents(event) {
    let result = [];
    for (let index = 0; index < event.touches.length; ++index) {
        result[index] = {x: event.touches[index].clientX, y: event.touches[index].clientY}
    }
    return result;
}

function vectorDifference(vec1, vec2) {
    return {x: vec1.x - vec2.x, y: vec1.y - vec2.y};
}

function vectorMagnitude2(vec) {
    return vec.x * vec.x + vec.y * vec.y;
}

function vectorMagnitude(vec) {
    return Math.sqrt(vectorMagnitude2(vec));
}

class UserControls extends Component {

    static propTypes = {
        config: PropTypes.object,               // Which mouse buttons correspond to which actions
        moveThreshold: PropTypes.number,        // pixels to move before cancelling tap/press
        pressDelay: PropTypes.number,           // ms to wait before detecting a press
        preventDefault: PropTypes.bool,         // whether to preventDefault on all events
        stopPropagation: PropTypes.bool,        // whether to stopPropagation on all events
        onTap: PropTypes.func,
        onPress: PropTypes.func,
        onPan: PropTypes.func,
        onZoom: PropTypes.func,
        onRotate: PropTypes.func,
    };

    static defaultProps = {
        config: {
            panButton: 0,
            zoomButton: 1,
            rotateButton: 2
        },
        moveThreshold: 5,
        pressDelay: 1000,
        preventDefault: true,
        stopPropagation: true
    };

    static NOTHING = 0;
    static TAPPING = 1;
    static PRESSING = 2;
    static PANNING = 3;
    static ZOOMING = 4;
    static ROTATING = 5;
    static TWO_FINGERS = 6; // can be either ZOOMING or ROTATING

    constructor(props) {
        super(props);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.state = {
            action: UserControls.NOTHING
        };
    }

    eventPrevent(event) {
        if (this.props.preventDefault) {
            event.preventDefault();
        }
        if (this.props.stopPropagation) {
            event.stopPropagation();
        }
    }

    onMouseDown(event) {
        this.eventPrevent(event);
        if (event.button === this.props.config.panButton) {
            this.setState({
                action: UserControls.TAPPING,
                lastPos: vectorFromMouseEvent(event),
                startTime: Date.now()
            });
        } else if (event.button === this.props.config.zoomButton) {
            this.setState({
                action: UserControls.ZOOMING,
                lastPos: vectorFromMouseEvent(event)
            });
        } else if (event.button === this.props.config.rotateButton) {
            this.setState({
                action: UserControls.ROTATING,
                lastPos: vectorFromMouseEvent(event)
            });
        }
    }

    onWheel(event) {
        this.eventPrevent(event);
        this.props.onZoom && this.props.onZoom({x: 0, y: event.deltaY / 20});
    }

    onContextMenu(event) {
        this.eventPrevent(event);
    }

    dragAction(currentPos, callback) {
        this.setState((prevState) => {
            const delta = vectorDifference(currentPos, prevState.lastPos);
            callback && callback(delta);
            return {lastPos: currentPos};
        });
    }

    onMove(currentPos, action) {
        const currentTime = Date.now();
        switch (action) {
            case UserControls.TAPPING:
            case UserControls.PRESSING:
                if (vectorMagnitude2(vectorDifference(currentPos, this.state.lastPos)) >= this.props.moveThreshold * this.props.moveThreshold) {
                    this.setState({
                        action: UserControls.PANNING
                    });
                    this.dragAction(currentPos, this.props.onPan);
                } else if (action === UserControls.TAPPING && currentTime - this.state.startTime >= this.props.pressDelay) {
                    this.setState({action: UserControls.PRESSING});
                }
                break;
            case UserControls.PANNING:
                return this.dragAction(currentPos, this.props.onPan);
            case UserControls.ZOOMING:
                return this.dragAction(currentPos, this.props.onZoom);
            case UserControls.ROTATING:
                return this.dragAction(currentPos, this.props.onRotate);
            default:
        }
    }

    onMouseMove(event) {
        if (this.state.action !== UserControls.NOTHING) {
            this.eventPrevent(event);
            this.onMove(vectorFromMouseEvent(event), this.state.action);
        }
    }

    onMouseUp(event) {
        this.eventPrevent(event);
        this.onTapReleased();
    }

    onTapReleased() {
        switch (this.state.action) {
            case UserControls.TAPPING:
                if (Date.now() - this.state.startTime < this.props.pressDelay) {
                    this.props.onTap && this.props.onTap(this.state.lastPos);
                }
            // else they've held the tap for >= pressDelay without moving - fall through to press case.
            // eslint nofallthrough: 0
            case UserControls.PRESSING:
                this.props.onPress && this.props.onPress(this.state.lastPos);
                break;
            default:
                break;
        }
        this.setState({action: UserControls.NOTHING, lastPos: null});
    }

    onTouchChange(event, touchStarted) {
        this.eventPrevent(event);
        switch (event.touches.length) {
            case 0:
                return this.onTapReleased();
            case 1:
                // Single finger touch is the same as tapping/pressing/panning with LMB.
                // If touchStarted is false (went from > 1 finger down to 1 finger), go straight to PANNING
                this.setState({
                    action: touchStarted ? UserControls.TAPPING : UserControls.PANNING,
                    lastPos: vectorsFromTouchEvents(event)[0],
                    startTime: Date.now()
                });
                break;
            case 2:
                // Two finger touch can pinch to zoom or drag to rotate.
                const lastPos = vectorsFromTouchEvents(event);
                this.setState({
                    action: UserControls.TWO_FINGERS,
                    lastPos
                });
                break;
            default:
                // Three or more fingers - do nothing until we're back to a handled number
                this.setState({
                    action: UserControls.NOTHING,
                });
                break;
        }
    }

    onTouchStart(event) {
        this.onTouchChange(event, true);
    }

    onTouchEnd(event) {
        this.onTouchChange(event, false);
    }

    touchDragAction(currentPos, callback, value) {
        this.setState(() => {
            callback && callback(value);
            return {lastPos: currentPos};
        });
    }

    /**
     * Compare two vectors and determine if they're within 45 degrees to being parallel or antiparallel.
     *
     * @param vec1 The first vector to compare
     * @param vec2 The second vector to compare
     * @return (number) 1 or -1 if the two vectors are within 45 degrees of parallel or antiparallel, or 0 otherwise.
     */
    static sameOppositeQuadrant(vec1, vec2) {
        let dot = vec1.x * vec2.x + vec1.y * vec2.y;
        // Dot product is |vec1|*|vec2|*cos(theta).  If we square it, we can divide by the magnitude squared of the two
        // vectors to end up with cos squared, which avoids having to square root the two vector magnitudes.
        let vec1Magnitude2 = vectorMagnitude2(vec1);
        let vec2Magnitude2 = vectorMagnitude2(vec2);
        let cos2 = dot * dot / (vec1Magnitude2 * vec2Magnitude2);
        // cos(45 degrees) is 1/sqrt(2), so cos^2(45 degrees) is 1/2.  Also, squares are always positive (i.e.
        // cos^2(135) is also +1/2, and cos^2(180) is +1), so can just check if cos2 is > 0.5
        return cos2 > 0.5 ? (dot > 0 ? 1 : -1) : 0;
    }

    onTouchMove(event) {
        this.eventPrevent(event);
        if (this.state.action !== UserControls.NOTHING) {
            switch (event.touches.length) {
                case 1:
                    return this.onMove(vectorFromMouseEvent(event.touches[0]), this.state.action);
                case 2:
                    // with two-finger gesture, can switch between zooming and rotating
                    const currentPos = vectorsFromTouchEvents(event);
                    const delta0 = vectorDifference(currentPos[0], this.state.lastPos[0]);
                    const delta1 = vectorDifference(currentPos[1], this.state.lastPos[1]);
                    // are both fingers travelling in the same direction (rotate) or apart (zoom)?
                    let deltaParallel = UserControls.sameOppositeQuadrant(delta0, delta1);
                    if (deltaParallel > 0) {
                        // moving in the same direction - user is rotating, and we can use an arbitrary finger
                        return this.touchDragAction(currentPos, this.props.onRotate, delta0);
                    } else if (deltaParallel < 0) {
                        let deltaFingers = vectorDifference(currentPos[0], currentPos[1]);
                        let fingerNormal = {x: deltaFingers.y, y: -deltaFingers.x};
                        let dotFinger = UserControls.sameOppositeQuadrant(delta0, fingerNormal);
                        if (dotFinger === 0) {
                            // moving in opposite directions but not clockwise/anticlockwise - zoom
                            const lastBetween = vectorMagnitude(vectorDifference(this.state.lastPos[1], this.state.lastPos[0]));
                            const between = vectorMagnitude(vectorDifference(currentPos[1], currentPos[0]));
                            return this.touchDragAction(currentPos, this.props.onZoom, {
                                x: 0,
                                y: lastBetween - between
                            });
                        } else {
                            // moving in opposite directions normal to each other - rotating.
                            let magnitude0 = vectorMagnitude(delta0);
                            return this.touchDragAction(currentPos, this.props.onRotate, {x: dotFinger * magnitude0, y: 0});
                        }
                    }
                    break;
                default:
            }
        }
    }

    render() {
        return (
            <div className='userControls'
                 onMouseDown={this.onMouseDown}
                 onWheel={this.onWheel}
                 onContextMenu={this.onContextMenu}
                 onMouseMove={this.onMouseMove}
                 onMouseUp={this.onMouseUp}
                 onTouchStart={this.onTouchStart}
                 onTouchMove={this.onTouchMove}
                 onTouchEnd={this.onTouchEnd}
            >
                {this.props.children}
            </div>
        );
    }
}

export default UserControls;