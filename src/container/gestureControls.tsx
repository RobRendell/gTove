import {Component} from 'react';
import classNames from 'classnames';

import {ObjectVector2} from '../util/scenarioUtils';

function positionFromMouseEvent(event: React.MouseEvent<HTMLElement>, offsetX: number, offsetY: number): ObjectVector2 {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
        x: event.pageX + event.currentTarget.scrollLeft - rect.left - offsetX,
        y: event.pageY + event.currentTarget.scrollTop - rect.top - offsetY
    };
}

function positionsFromTouchEvents(event: React.TouchEvent<HTMLElement>): ObjectVector2[] {
    const rect = event.currentTarget.getBoundingClientRect();
    let result = [];
    for (let index = 0; index < event.touches.length; ++index) {
        result[index] = {x: event.touches[index].pageX - rect.left, y: event.touches[index].pageY - rect.top}
    }
    return result;
}

function vectorDifference(vec1: ObjectVector2, vec2: ObjectVector2): ObjectVector2 {
    return {x: vec1.x - vec2.x, y: vec1.y - vec2.y};
}

function vectorMagnitude2(vec: ObjectVector2): number {
    return vec.x * vec.x + vec.y * vec.y;
}

function vectorMagnitude(vec: ObjectVector2): number {
    return Math.sqrt(vectorMagnitude2(vec));
}

/**
 * Compare two vectors and determine if they're within 45 degrees to being parallel or antiparallel.
 *
 * @param vec1 The first vector to compare
 * @param vec2 The second vector to compare
 * @return (number) 1 or -1 if the two vectors are within 45 degrees of parallel or antiparallel, or 0 otherwise.
 */
export function sameOppositeQuadrant(vec1: ObjectVector2, vec2: ObjectVector2) {
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

type DragEventHandler = (delta: ObjectVector2, position: ObjectVector2, startPos: ObjectVector2) => void;

export interface GestureControlsProps {
    moveThreshold: number;      // pixels to move before cancelling tap/press
    pressDelay: number;         // ms to wait before detecting a press
    preventDefault: boolean;    // whether to preventDefault on all events
    stopPropagation: boolean;   // whether to stopPropagation on all events
    onGestureStart?: (startPos: ObjectVector2) => void;
    onGestureEnd?: () => void;
    onTap?: (position: ObjectVector2) => void;
    onPress?: (position: ObjectVector2) => void;
    onPan?: DragEventHandler;
    onZoom?: DragEventHandler;
    onRotate?: DragEventHandler;
    className?: string;
    offsetX: number;            // Adjustment in pixels to make to x coordinates, due to padding/margins around the element to handle gestures
    offsetY: number;            // Adjustment in pixels to make to y coordinates, due to padding/margins around the element to handle gestures
}

export enum GestureControlsAction {
    NOTHING,
    TAPPING,
    PRESSING,
    PANNING,
    ZOOMING,
    ROTATING,
    TWO_FINGERS // can be either ZOOMING or ROTATING
}

export interface GestureControlsState {
    action: GestureControlsAction;
    lastPos?: ObjectVector2;
    startPos?: ObjectVector2;
    lastTouches?: ObjectVector2[];
}

export const PAN_BUTTON = 0;
export const ZOOM_BUTTON = 1;
export const ROTATE_BUTTON = 2;

export default class GestureControls extends Component<GestureControlsProps, GestureControlsState> {

    static defaultProps = {
        moveThreshold: 5,
        pressDelay: 1000,
        preventDefault: true,
        stopPropagation: true,
        offsetX: 0,
        offsetY: 0
    };

    private pressTimer: number | undefined;

    constructor(props: GestureControlsProps) {
        super(props);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onPressTimeout = this.onPressTimeout.bind(this);
        this.state = {
            action: GestureControlsAction.NOTHING,
            lastPos: undefined,
            startPos: undefined
        };
    }

    eventPrevent(event: React.MouseEvent<HTMLElement> | React.WheelEvent<HTMLElement> | React.TouchEvent<HTMLElement>) {
        if (this.props.preventDefault) {
            event.preventDefault();
        }
        if (this.props.stopPropagation) {
            event.stopPropagation();
        }
    }

    onMouseDown(event: React.MouseEvent<HTMLElement>) {
        if (event.isDefaultPrevented()) {
            // This is a hack, but stopping propagation doesn't work between the pingsComponent and here.
            return;
        }
        this.eventPrevent(event);
        const startPos = positionFromMouseEvent(event, this.props.offsetX, this.props.offsetY);
        switch (event.button) {
            case PAN_BUTTON:
                if (event.shiftKey) {
                    // Holding down shift makes the PAN_BUTTON act like the ZOOM_BUTTON.
                    this.setState({
                        action: GestureControlsAction.ZOOMING,
                        lastPos: startPos,
                        startPos
                    });
                } else if (event.ctrlKey) {
                    // Holding down control makes it act like the ROTATE_BUTTON.
                    this.setState({
                        action: GestureControlsAction.ROTATING,
                        lastPos: startPos,
                        startPos
                    });
                } else {
                    this.setState({
                        action: GestureControlsAction.TAPPING,
                        lastPos: startPos,
                        startPos
                    });
                    this.pressTimer = window.setTimeout(this.onPressTimeout, this.props.pressDelay);
                }
                break;
            case ZOOM_BUTTON:
                this.setState({
                    action: GestureControlsAction.ZOOMING,
                    lastPos: startPos,
                    startPos
                });
                break;
            case ROTATE_BUTTON:
                this.setState({
                    action: GestureControlsAction.ROTATING,
                    lastPos: startPos,
                    startPos
                });
                break;
            default:
                return;
        }
        this.props.onGestureStart && this.props.onGestureStart(startPos);
    }

    onPressTimeout() {
        // Held a press for the delay period - change state to PRESSING and emit onPress action
        this.setState({action: GestureControlsAction.PRESSING});
        this.props.onPress && this.props.onPress(this.state.lastPos || this.state.startPos!);
    }

    onWheel(event: React.WheelEvent<HTMLElement>) {
        // deltaMode is 0 (pixels), 1 (lines) or 2 (pages).  Scale up deltaY so they're roughly equivalent.
        const distance = event.deltaY * [0.07, 1, 7][event.deltaMode];
        this.props.onZoom && this.props.onZoom({x: 0, y: distance}, {x: 0, y: 0}, {x: 0, y: 0});
    }

    onContextMenu(event: React.MouseEvent<HTMLElement>) {
        this.eventPrevent(event);
    }

    dragAction(currentPos: ObjectVector2, callback?: DragEventHandler) {
        this.setState((prevState) => {
            const delta = vectorDifference(currentPos, prevState.lastPos!);
            callback && callback(delta, currentPos, prevState.startPos!);
            return {lastPos: currentPos};
        });
    }

    onMove(currentPos: ObjectVector2, action: GestureControlsAction) {
        switch (action) {
            case GestureControlsAction.TAPPING:
            case GestureControlsAction.PRESSING:
                if (vectorMagnitude2(vectorDifference(currentPos, this.state.lastPos!)) >= this.props.moveThreshold * this.props.moveThreshold) {
                    window.clearTimeout(this.pressTimer);
                    this.setState({
                        action: GestureControlsAction.PANNING
                    });
                    this.dragAction(currentPos, this.props.onPan);
                }
                break;
            case GestureControlsAction.PANNING:
                return this.dragAction(currentPos, this.props.onPan);
            case GestureControlsAction.ZOOMING:
                return this.dragAction(currentPos, this.props.onZoom);
            case GestureControlsAction.ROTATING:
                return this.dragAction(currentPos, this.props.onRotate);
            default:
        }
    }

    onMouseMove(event: React.MouseEvent<HTMLElement>) {
        if (this.state.action !== GestureControlsAction.NOTHING) {
            this.eventPrevent(event);
            this.onMove(positionFromMouseEvent(event, this.props.offsetX, this.props.offsetY), this.state.action);
        }
    }

    onMouseUp(event: React.MouseEvent<HTMLElement>) {
        this.eventPrevent(event);
        this.onTapReleased();
    }

    onTapReleased() {
        window.clearTimeout(this.pressTimer);
        this.props.onGestureEnd && this.props.onGestureEnd();
        if (this.state.action === GestureControlsAction.TAPPING && this.props.onTap) {
            this.props.onTap(this.state.lastPos!);
        }
        this.setState({action: GestureControlsAction.NOTHING, lastPos: undefined, startPos: undefined});
    }

    onTouchChange(event: React.TouchEvent<HTMLElement>, touchStarted: boolean) {
        // this.eventPrevent(event);
        switch (event.touches.length) {
            case 0:
                return this.onTapReleased();
            case 1:
                // Single finger touch is the same as tapping/pressing/panning with LMB.
                const startPos = positionsFromTouchEvents(event)[0];
                if (touchStarted && this.props.onGestureStart) {
                    this.props.onGestureStart(startPos);
                }
                // If touchStarted is false (went from > 1 finger down to 1 finger), go straight to PANNING
                this.setState({
                    action: touchStarted ? GestureControlsAction.TAPPING : GestureControlsAction.PANNING,
                    lastPos: startPos,
                    startPos
                });
                // If touchStarted is true, they just touched with one finger - might be the start of a press.
                if (touchStarted) {
                    this.pressTimer = window.setTimeout(this.onPressTimeout, this.props.pressDelay);
                }
                break;
            case 2:
                // Two finger touch can pinch to zoom or drag to rotate.
                window.clearTimeout(this.pressTimer);
                const lastTouches = positionsFromTouchEvents(event);
                this.setState({
                    action: GestureControlsAction.TWO_FINGERS,
                    lastTouches,
                    startPos: this.state.startPos || lastTouches[0]
                });
                break;
            default:
                // Three or more fingers - do nothing until we're back to a handled number
                window.clearTimeout(this.pressTimer);
                this.setState({
                    action: GestureControlsAction.NOTHING
                });
                break;
        }
    }

    onTouchStart(event: React.TouchEvent<HTMLElement>) {
        this.onTouchChange(event, true);
    }

    onTouchEnd(event: React.TouchEvent<HTMLElement>) {
        this.onTouchChange(event, false);
    }

    touchDragAction(currentPos: ObjectVector2[], callback: DragEventHandler | undefined, value: ObjectVector2) {
        this.setState(() => {
            callback && callback(value, currentPos[0], this.state.startPos!);
            return {lastTouches: currentPos};
        });
    }

    onTouchMove(event: React.TouchEvent<HTMLElement>) {
        // this.eventPrevent(event);
        if (this.state.action !== GestureControlsAction.NOTHING) {
            const currentPos = positionsFromTouchEvents(event);
            switch (currentPos.length) {
                case 1:
                    return this.onMove(currentPos[0], this.state.action);
                case 2:
                    // with two-finger gesture, can switch between zooming and rotating
                    const delta = this.state.lastTouches!.map((lastPos, index) => (vectorDifference(currentPos[index], lastPos)));
                    const largerIndex = (vectorMagnitude2(delta[0]) > vectorMagnitude2(delta[1])) ? 0 : 1;
                    const smallerIndex = 1 - largerIndex;
                    let deltaParallel = sameOppositeQuadrant(delta[0], delta[1]);
                    if (deltaParallel > 0) {
                        // fingers moving in the same direction - user is rotating vertically
                        this.touchDragAction(currentPos, this.props.onRotate, {x: 0, y: delta[largerIndex].y});
                    } else {
                        let deltaFingers = vectorDifference(currentPos[largerIndex], currentPos[smallerIndex]);
                        let fingerNormal = {x: deltaFingers.y, y: -deltaFingers.x};
                        let dotFinger = sameOppositeQuadrant(delta[largerIndex], fingerNormal);
                        if (dotFinger === 0) {
                            // not moving clockwise/anticlockwise - zoom
                            const lastBetween = vectorMagnitude(vectorDifference(this.state.lastTouches![1], this.state.lastTouches![0]));
                            const between = vectorMagnitude(vectorDifference(currentPos[1], currentPos[0]));
                            this.touchDragAction(currentPos, this.props.onZoom, {
                                x: 0,
                                y: lastBetween - between
                            });
                        } else {
                            // moving clockwise/anticlockwise - rotating in XZ plane
                            let magnitude = vectorMagnitude(delta[largerIndex]);
                            this.touchDragAction(currentPos, this.props.onRotate, {x: dotFinger * magnitude, y: 0});
                        }
                    }
                    break;
                default:
            }
        }
    }

    render() {
        return (
            <div className={classNames('gestureControls', this.props.className)}
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
