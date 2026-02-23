import classNames from 'classnames';
import {forwardRef, MouseEvent, PropsWithChildren, RefObject, TouchEvent, useCallback, useRef, WheelEvent} from 'react';

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

enum GestureControlsAction {
    NOTHING,
    TAPPING,
    PRESSING,
    PANNING,
    ZOOMING,
    ROTATING,
    TWO_FINGERS // can be either ZOOMING or ROTATING
}

export const PAN_BUTTON = 0;
export const ZOOM_BUTTON = 1;
export const ROTATE_BUTTON = 2;

export interface GestureControlsProps extends PropsWithChildren {
    moveThreshold?: number;      // pixels to move before cancelling tap/press
    pressDelay?: number;         // ms to wait before detecting a press
    preventDefault?: boolean;    // whether to preventDefault on all events
    stopPropagation?: boolean;   // whether to stopPropagation on all events
    onGestureStart?: (startPos: ObjectVector2) => void;
    onGestureEnd?: () => void;
    onTap?: (position: ObjectVector2) => void;
    onPress?: (position: ObjectVector2) => void;
    onPan?: DragEventHandler;
    onZoom?: DragEventHandler;
    onRotate?: DragEventHandler;
    className?: string;
    offsetX?: number;            // Adjustment in pixels to make to x coordinates, due to padding/margins around the
                                 // element to handle gestures
    offsetY?: number;            // Adjustment in pixels to make to y coordinates, due to padding/margins around the
                                 // element to handle gestures
    forwardRef?: RefObject<HTMLDivElement>;
}

const GestureControls = forwardRef<HTMLDivElement, GestureControlsProps>(({
                                                                              moveThreshold = 5,
                                                                              pressDelay = 1000,
                                                                              preventDefault = true,
                                                                              stopPropagation = true,
                                                                              onGestureStart,
                                                                              onGestureEnd,
                                                                              onTap,
                                                                              onPress,
                                                                              onPan,
                                                                              onZoom,
                                                                              onRotate,
                                                                              className,
                                                                              offsetX = 0,
                                                                              offsetY = 0,
                                                                              children
                                                                          }, ref) => {

    const pressTimerRef = useRef<number | undefined>();
    const actionRef = useRef(GestureControlsAction.NOTHING);
    const lastPosRef = useRef<ObjectVector2 | undefined>();
    const startPosRef = useRef<ObjectVector2 | undefined>();
    const lastTouchesRef = useRef<ObjectVector2[] | undefined>();

    const eventPrevent = useCallback((event: MouseEvent<HTMLElement> | WheelEvent<HTMLElement> | TouchEvent<HTMLElement>) => {
        if (preventDefault) {
            event.preventDefault();
        }
        if (stopPropagation) {
            event.stopPropagation();
        }
    }, [preventDefault, stopPropagation]);

    const onPressTimeout = useCallback(() => {
        // Held a press for the delay period - change state to PRESSING and emit onPress action
        actionRef.current = GestureControlsAction.PRESSING;
        onPress?.(lastPosRef.current || startPosRef.current!);
    }, [onPress]);

    const onMouseDown = useCallback((event: MouseEvent<HTMLElement>) => {
        if (event.isDefaultPrevented()) {
            // This is a hack, but stopping propagation doesn't work between the pingsComponent and here.
            return;
        }
        eventPrevent(event);
        const startPos = positionFromMouseEvent(event, offsetX, offsetY);
        switch (event.button) {
            case PAN_BUTTON:
                if (event.shiftKey) {
                    // Holding down shift makes the PAN_BUTTON act like the ZOOM_BUTTON.
                    actionRef.current = GestureControlsAction.ZOOMING;
                } else if (event.ctrlKey) {
                    // Holding down control makes it act like the ROTATE_BUTTON.
                    actionRef.current = GestureControlsAction.ROTATING;
                } else {
                    actionRef.current = GestureControlsAction.TAPPING;
                    pressTimerRef.current = window.setTimeout(onPressTimeout, pressDelay);
                }
                lastPosRef.current = startPos;
                startPosRef.current = startPos;
                break;
            case ZOOM_BUTTON:
                actionRef.current = GestureControlsAction.ZOOMING;
                lastPosRef.current = startPos;
                startPosRef.current = startPos;
                break;
            case ROTATE_BUTTON:
                actionRef.current = GestureControlsAction.ROTATING;
                lastPosRef.current = startPos;
                startPosRef.current = startPos;
                break;
            default:
                return;
        }
        onGestureStart?.(startPosRef.current);
    }, [eventPrevent, offsetX, offsetY, onGestureStart, onPressTimeout, pressDelay]);

    const onWheel = useCallback((event: WheelEvent<HTMLElement>) => {
        // deltaMode is 0 (pixels), 1 (lines) or 2 (pages).  Scale up deltaY so they're roughly equivalent.
        const distance = event.deltaY * [0.07, 1, 7][event.deltaMode];
        onZoom?.({x: 0, y: distance}, {x: 0, y: 0}, {x: 0, y: 0});
    }, [onZoom]);

    const onContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
        eventPrevent(event);
    }, [eventPrevent]);

    const dragAction = useCallback((currentPos: ObjectVector2, callback?: DragEventHandler) => {
        const delta = vectorDifference(currentPos, lastPosRef.current!);
        callback && callback(delta, currentPos, startPosRef.current!);
        lastPosRef.current = currentPos;
    }, []);

    const onMove = useCallback((currentPos: ObjectVector2, action: GestureControlsAction) => {
        switch (action) {
            case GestureControlsAction.TAPPING:
            case GestureControlsAction.PRESSING:
                if (vectorMagnitude2(vectorDifference(currentPos, lastPosRef.current!)) >= moveThreshold * moveThreshold) {
                    window.clearTimeout(pressTimerRef.current);
                    actionRef.current = GestureControlsAction.PANNING;
                    dragAction(currentPos, onPan);
                }
                break;
            case GestureControlsAction.PANNING:
                return dragAction(currentPos, onPan);
            case GestureControlsAction.ZOOMING:
                return dragAction(currentPos, onZoom);
            case GestureControlsAction.ROTATING:
                return dragAction(currentPos, onRotate);
            default:
        }
    }, [dragAction, moveThreshold, onPan, onRotate, onZoom]);

    const onMouseMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (actionRef.current !== GestureControlsAction.NOTHING) {
            eventPrevent(event);
            onMove(positionFromMouseEvent(event, offsetX, offsetY), actionRef.current);
        }
    }, [eventPrevent, offsetX, offsetY, onMove]);

    const onTapReleased = useCallback(() => {
        window.clearTimeout(pressTimerRef.current);
        onGestureEnd && onGestureEnd();
        if (actionRef.current === GestureControlsAction.TAPPING && onTap) {
            onTap(lastPosRef.current!);
        }
        actionRef.current = GestureControlsAction.NOTHING;
        lastPosRef.current = undefined;
        startPosRef.current = undefined;
    }, [onGestureEnd, onTap]);

    const onMouseUp = useCallback((event: React.MouseEvent<HTMLElement>) => {
        eventPrevent(event);
        onTapReleased();
    }, [eventPrevent, onTapReleased]);

    const onTouchChange = useCallback((event: React.TouchEvent<HTMLElement>, touchStarted: boolean) => {
        // eventPrevent(event);
        switch (event.touches.length) {
            case 0:
                return onTapReleased();
            case 1:
                // Single finger touch is the same as tapping/pressing/panning with LMB.
                const startPos = positionsFromTouchEvents(event)[0];
                if (touchStarted && onGestureStart) {
                    onGestureStart(startPos);
                }
                // If touchStarted is false (went from > 1 finger down to 1 finger), go straight to PANNING
                actionRef.current = touchStarted ? GestureControlsAction.TAPPING : GestureControlsAction.PANNING;
                lastPosRef.current = startPos;
                startPosRef.current = startPos;
                // If touchStarted is true, they just touched with one finger - might be the start of a press.
                if (touchStarted) {
                    pressTimerRef.current = window.setTimeout(onPressTimeout, pressDelay);
                }
                break;
            case 2:
                // Two finger touch can pinch to zoom or drag to rotate.
                window.clearTimeout(pressTimerRef.current);
                const lastTouches = positionsFromTouchEvents(event);
                actionRef.current = GestureControlsAction.TWO_FINGERS;
                lastTouchesRef.current = lastTouches;
                startPosRef.current = startPosRef.current || lastTouches[0];
                break;
            default:
                // Three or more fingers - do nothing until we're back to a handled number
                window.clearTimeout(pressTimerRef.current);
                actionRef.current = GestureControlsAction.NOTHING;
                break;
        }
    }, [onGestureStart, onPressTimeout, onTapReleased, pressDelay]);

    const onTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
        onTouchChange(event, true);
    }, [onTouchChange]);

    const onTouchEnd = useCallback((event: React.TouchEvent<HTMLElement>) => {
        onTouchChange(event, false);
    }, [onTouchChange]);

    const touchDragAction = useCallback((currentPos: ObjectVector2[], callback: DragEventHandler | undefined, value: ObjectVector2) => {
        callback && callback(value, currentPos[0], startPosRef.current!);
        lastTouchesRef.current = currentPos;
    }, []);

    const onTouchMove = useCallback((event: React.TouchEvent<HTMLElement>) => {
        // eventPrevent(event);
        if (actionRef.current !== GestureControlsAction.NOTHING) {
            const currentPos = positionsFromTouchEvents(event);
            switch (currentPos.length) {
                case 1:
                    return onMove(currentPos[0], actionRef.current);
                case 2:
                    // with two-finger gesture, can switch between zooming and rotating
                    const delta = lastTouchesRef.current!.map((lastPos, index) => (vectorDifference(currentPos[index], lastPos)));
                    const largerIndex = (vectorMagnitude2(delta[0]) > vectorMagnitude2(delta[1])) ? 0 : 1;
                    const smallerIndex = 1 - largerIndex;
                    let deltaParallel = sameOppositeQuadrant(delta[0], delta[1]);
                    if (deltaParallel > 0) {
                        // fingers moving in the same direction - user is rotating vertically
                        touchDragAction(currentPos, onRotate, {x: 0, y: delta[largerIndex].y});
                    } else {
                        let deltaFingers = vectorDifference(currentPos[largerIndex], currentPos[smallerIndex]);
                        let fingerNormal = {x: +deltaFingers.y, y: -deltaFingers.x};
                        let dotFinger = sameOppositeQuadrant(delta[largerIndex], fingerNormal);
                        if (dotFinger === 0) {
                            // not moving clockwise/anticlockwise - zoom
                            const lastBetween = vectorMagnitude(vectorDifference(lastTouchesRef.current![1], lastTouchesRef.current![0]));
                            const between = vectorMagnitude(vectorDifference(currentPos[1], currentPos[0]));
                            touchDragAction(currentPos, onZoom, {
                                x: 0,
                                y: lastBetween - between
                            });
                        } else {
                            // moving clockwise/anticlockwise - rotating in XZ plane
                            let magnitude = vectorMagnitude(delta[largerIndex]);
                            touchDragAction(currentPos, onRotate, {x: dotFinger * magnitude, y: 0});
                        }
                    }
                    break;
                default:
            }
        }
    }, [onMove, onRotate, onZoom, touchDragAction]);

    return (
        <div className={classNames('gestureControls', className)}
             onMouseDown={onMouseDown}
             onWheel={onWheel}
             onContextMenu={onContextMenu}
             onMouseMove={onMouseMove}
             onMouseUp={onMouseUp}
             onTouchStart={onTouchStart}
             onTouchMove={onTouchMove}
             onTouchEnd={onTouchEnd}
             ref={ref}
        >
            {children}
        </div>
    );
});

export default GestureControls;