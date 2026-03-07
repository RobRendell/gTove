import classNames from 'classnames';
import omit from 'lodash/omit';
import {
    createContext,
    forwardRef,
    MouseEvent,
    PropsWithChildren,
    Ref,
    RefObject,
    TouchEvent,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    WheelEvent
} from 'react';

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

type DragGestureHandler = (delta: ObjectVector2, position: ObjectVector2, startPos: ObjectVector2) => void;

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

export interface GestureHandler<Context = ObjectVector2> {
    // A unique ID for this handler.
    id: string;
    // Default 0. Multiple handlers are tested in descending priority order, and the first one that matches is used.
    priority?: number;
    // Returns true if this handler should be used for this gesture. If undefined, this handler always matches.
    match?: (context: Context) => boolean;

    onGestureStart?: (startPos: ObjectVector2) => void;
    onGestureEnd?: () => void;
    onTap?: (position: ObjectVector2) => void;
    onPress?: (position: ObjectVector2) => void;
    onPan?: DragGestureHandler;
    onZoom?: DragGestureHandler;
    onRotate?: DragGestureHandler;
}

type DragGestureHandlerKey = 'onPan' | 'onZoom' | 'onRotate';

type GestureHandlerCallback = Required<Pick<GestureHandler, 'onGestureStart' | 'onGestureEnd' | 'onTap' | 'onPress' | DragGestureHandlerKey>>;

const GestureControlsContextObject = createContext<null | ((arg: string | GestureHandler<unknown>) => void)>(null);

export interface GestureControlsProps<Context = ObjectVector2> extends PropsWithChildren {
    // pixels to move before cancelling tap/press
    moveThreshold?: number;
    // ms to wait before detecting a press
    pressDelay?: number;
    // whether to preventDefault on all events
    preventDefault?: boolean;
    // whether to stopPropagation on all events
    stopPropagation?: boolean;
    className?: string;
    // Adjustment in pixels to make to x coordinates, due to padding/margins around the element to handle gestures
    offsetX?: number;
    // Adjustment in pixels to make to y coordinates, due to padding/margins around the element to handle gestures
    offsetY?: number;
    forwardRef?: RefObject<HTMLDivElement>;
    // If set, maps the initial screen interaction into a context object, to be used by any GestureHandler match functions.
    buildContext?: (startPos?: ObjectVector2, targetElement?: Element) => Context;
    // A set of gesture handlers which are used by default, both when no other handler's `match` returns true and when
    // the current handler doesn't define a matching gesture handler (e.g. no onZoom handler for a zoom action).
    defaultHandler: GestureHandler<Context>;
}

function GestureControlsInner<Context = ObjectVector2>({
                                                           moveThreshold = 5,
                                                           pressDelay = 1000,
                                                           preventDefault = true,
                                                           stopPropagation = true,
                                                           className,
                                                           offsetX = 0,
                                                           offsetY = 0,
                                                           buildContext,
                                                           defaultHandler,
                                                           children
                                                       }: GestureControlsProps<Context>, ref: Ref<HTMLDivElement>) {
    const pressTimerRef = useRef<number | undefined>();
    const actionRef = useRef(GestureControlsAction.NOTHING);
    const lastPosRef = useRef<ObjectVector2 | undefined>();
    const startPosRef = useRef<ObjectVector2 | undefined>();
    const lastTouchesRef = useRef<ObjectVector2[] | undefined>();

    const [gestureHandlers, setGestureHandlers] = useState<{[id: string]: GestureHandler<Context>}>({});

    // Manage gestureHandlers.
    useEffect(() => {
        setGestureHandlers((prev) => (
            {...prev, [defaultHandler.id]: defaultHandler}
        ));
        return () => {
            setGestureHandlers((prev) => (omit(prev, defaultHandler.id)));
        }
    }, [defaultHandler]);
    const setGestureHandler = useCallback((arg: string | GestureHandler<Context>) => {
        setGestureHandlers((prev) => (
            typeof arg === 'string' ? omit(prev, arg) : {...prev, [arg.id]: arg}
        ))
    }, []);
    const sortedHandlerIds = useMemo(() => (
        Object.keys(gestureHandlers)
            .sort((id1, id2) => ((gestureHandlers[id2]?.priority ?? 0) - (gestureHandlers[id1]?.priority ?? 0)))
    ), [gestureHandlers]);
    const activeHandlerId = useRef('');

    const eventPrevent = useCallback((event: MouseEvent<HTMLElement> | WheelEvent<HTMLElement> | TouchEvent<HTMLElement>) => {
        if (preventDefault) {
            event.preventDefault();
        }
        if (stopPropagation) {
            event.stopPropagation();
        }
    }, [preventDefault, stopPropagation]);

    const callGestureCallback = useCallback(<Key extends keyof GestureHandlerCallback>(
        type: Key,
        ...args: Parameters<GestureHandlerCallback[Key]>
    ) => {
        const currentHandler = gestureHandlers[activeHandlerId.current];
        let callback = currentHandler?.[type] ?? defaultHandler[type];
        if (type === 'onGestureEnd' && defaultHandler.onGestureEnd && (
            (actionRef.current === GestureControlsAction.ZOOMING && !currentHandler.onZoom)
            || (actionRef.current === GestureControlsAction.PANNING && !currentHandler.onPan)
            || (actionRef.current === GestureControlsAction.ROTATING && !currentHandler.onRotate)
            || (actionRef.current === GestureControlsAction.TAPPING && !currentHandler.onTap)
            || (actionRef.current === GestureControlsAction.PRESSING && !currentHandler.onPress)
        )) {
            // Special handling for onGestureEnd - if the gesture that is ending was being handled by the
            // defaultHandler, then we should also call the defaultHandler's onGestureEnd rather than the currently
            // active one.
            callback = defaultHandler.onGestureEnd;
        }
        return (callback as any)?.(...args);
    }, [defaultHandler, gestureHandlers]);

    const onPressTimeout = useCallback(() => {
        // Held a press for the delay period - change state to PRESSING and emit onPress action
        actionRef.current = GestureControlsAction.PRESSING;
        callGestureCallback('onPress', lastPosRef.current || startPosRef.current!);
    }, [callGestureCallback]);

    const getActiveHandlerId = useCallback((position?: ObjectVector2, targetElement?: EventTarget | null) => {
        // Search for the active handler in priority order, and set activeHandlerId.current to whichever handler is
        // going to handle this gesture.
        const context = !buildContext || (targetElement && !(targetElement instanceof Element))
            ? position as Context : buildContext(position, targetElement ?? undefined);
        return sortedHandlerIds.find((id) => (
            !gestureHandlers[id].match || gestureHandlers[id].match(context)
        ));
    }, [buildContext, gestureHandlers, sortedHandlerIds]);

    const handleGestureStart = useCallback((position: ObjectVector2, targetElement: EventTarget | null) => {
        activeHandlerId.current = getActiveHandlerId(position, targetElement) ?? '';
        callGestureCallback('onGestureStart', position);
    }, [callGestureCallback, getActiveHandlerId]);

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
        handleGestureStart(startPosRef.current, event.nativeEvent.target);
    }, [eventPrevent, handleGestureStart, offsetX, offsetY, onPressTimeout, pressDelay]);

    const onWheel = useCallback((event: WheelEvent<HTMLElement>) => {
        // Mouse wheel isn't preceded by an onGestureStart, so manually set activeHandlerId if required.
        if (!activeHandlerId.current) {
            activeHandlerId.current = getActiveHandlerId() ?? '';
        }
        // deltaMode is 0 (pixels), 1 (lines) or 2 (pages).  Scale up deltaY so they're roughly equivalent.
        const distance = event.deltaY * [0.07, 1, 7][event.deltaMode];
        callGestureCallback('onZoom', {x: 0, y: distance}, {x: 0, y: 0}, {x: 0, y: 0});
    }, [callGestureCallback, getActiveHandlerId]);

    const onContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
        eventPrevent(event);
    }, [eventPrevent]);

    const dragAction = useCallback((currentPos: ObjectVector2, callbackName: DragGestureHandlerKey) => {
        const delta = vectorDifference(currentPos, lastPosRef.current!);
        callGestureCallback(callbackName, delta, currentPos, startPosRef.current!);
        lastPosRef.current = currentPos;
    }, [callGestureCallback]);

    const onMove = useCallback((currentPos: ObjectVector2, action: GestureControlsAction) => {
        switch (action) {
            case GestureControlsAction.TAPPING:
            case GestureControlsAction.PRESSING:
                if (vectorMagnitude2(vectorDifference(currentPos, lastPosRef.current!)) >= moveThreshold * moveThreshold) {
                    window.clearTimeout(pressTimerRef.current);
                    actionRef.current = GestureControlsAction.PANNING;
                    dragAction(currentPos, 'onPan');
                }
                break;
            case GestureControlsAction.PANNING:
                return dragAction(currentPos, 'onPan');
            case GestureControlsAction.ZOOMING:
                return dragAction(currentPos, 'onZoom');
            case GestureControlsAction.ROTATING:
                return dragAction(currentPos, 'onRotate');
            default:
        }
    }, [dragAction, moveThreshold]);

    const onMouseMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (actionRef.current !== GestureControlsAction.NOTHING) {
            eventPrevent(event);
            onMove(positionFromMouseEvent(event, offsetX, offsetY), actionRef.current);
        }
    }, [eventPrevent, offsetX, offsetY, onMove]);

    const onTapReleased = useCallback(() => {
        window.clearTimeout(pressTimerRef.current);
        if (actionRef.current === GestureControlsAction.TAPPING) {
            callGestureCallback('onTap', lastPosRef.current!);
        }
        callGestureCallback('onGestureEnd');
        actionRef.current = GestureControlsAction.NOTHING;
        lastPosRef.current = undefined;
        startPosRef.current = undefined;
        activeHandlerId.current = '';
    }, [callGestureCallback]);

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
                if (touchStarted) {
                    handleGestureStart(startPos, event.nativeEvent.target);
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
                if (touchStarted) {
                    handleGestureStart(lastTouches[0], event.nativeEvent.target);
                }
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
    }, [handleGestureStart, onPressTimeout, onTapReleased, pressDelay]);

    const onTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
        onTouchChange(event, true);
    }, [onTouchChange]);

    const onTouchEnd = useCallback((event: React.TouchEvent<HTMLElement>) => {
        onTouchChange(event, false);
    }, [onTouchChange]);

    const touchDragAction = useCallback((currentPos: ObjectVector2[], callbackName: DragGestureHandlerKey, value: ObjectVector2) => {
        callGestureCallback(callbackName, value, currentPos[0], startPosRef.current!);
        lastTouchesRef.current = currentPos;
    }, [callGestureCallback]);

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
                        touchDragAction(currentPos, 'onRotate', {x: 0, y: delta[largerIndex].y});
                    } else {
                        let deltaFingers = vectorDifference(currentPos[largerIndex], currentPos[smallerIndex]);
                        let fingerNormal = {x: +deltaFingers.y, y: -deltaFingers.x};
                        let dotFinger = sameOppositeQuadrant(delta[largerIndex], fingerNormal);
                        if (dotFinger === 0) {
                            // not moving clockwise/anticlockwise - zoom
                            const lastBetween = vectorMagnitude(vectorDifference(lastTouchesRef.current![1], lastTouchesRef.current![0]));
                            const between = vectorMagnitude(vectorDifference(currentPos[1], currentPos[0]));
                            touchDragAction(currentPos, 'onZoom', {x: 0, y: lastBetween - between});
                        } else {
                            // moving clockwise/anticlockwise - rotating in XZ plane
                            let magnitude = vectorMagnitude(delta[largerIndex]);
                            touchDragAction(currentPos, 'onRotate', {x: dotFinger * magnitude, y: 0});
                        }
                    }
                    break;
                default:
            }
        }
    }, [onMove, touchDragAction]);

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
            <GestureControlsContextObject.Provider value={setGestureHandler}>
                {children}
            </GestureControlsContextObject.Provider>
        </div>
    );
}

const GestureControls = forwardRef(GestureControlsInner) as <Context = ObjectVector2>(
    props: GestureControlsProps<Context> & {ref?: Ref<HTMLDivElement>}
) => JSX.Element;

export default GestureControls;

export function useGestureHandler<Context = ObjectVector2>(handler: GestureHandler<Context>) {
    const setGestureHandler = useContext(GestureControlsContextObject);

    useEffect(() => {
        setGestureHandler?.(handler as GestureHandler<unknown>);
        return () => {
            setGestureHandler?.(handler.id);
        };
    }, [handler, setGestureHandler]);
}