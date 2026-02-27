import {act, cleanup, fireEvent, render} from '@testing-library/react';
import * as chai from 'chai';
import * as sinon from 'sinon';
import {afterEach, beforeEach, describe, it, vi} from 'vitest';

import GestureControls, {
    GestureHandler,
    PAN_BUTTON,
    ROTATE_BUTTON,
    useGestureHandler,
    ZOOM_BUTTON
} from './gestureControls';
import {ObjectVector2} from '../util/scenarioUtils';

const mouseEventCoords = (x: number, y: number) => ({
    pageX: x,
    pageY: y,
    clientX: x,
    clientY: y
});

describe('GestureControls component', () => {

    const sandbox = sinon.createSandbox();

    let onPan: sinon.SinonStub;
    let onZoom: sinon.SinonStub;
    let onRotate: sinon.SinonStub;
    let onTap: sinon.SinonStub;
    let onPress: sinon.SinonStub;
    let onGestureStart: sinon.SinonStub;
    let onGestureEnd: sinon.SinonStub;

    const MOVE_THRESHOLD = 10;
    const PRESS_DELAY = 500;
    const startX = 100;
    const startY = 100;

    beforeEach(() => {
        onPan = sinon.stub();
        onZoom = sinon.stub();
        onRotate = sinon.stub();
        onTap = sinon.stub();
        onPress = sinon.stub();
        onGestureStart = sinon.stub();
        onGestureEnd = sinon.stub();
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        sandbox.restore();
        vi.restoreAllMocks();
    });

    const setup = (props = {}) => {
        const handler: GestureHandler = {
            id: 'test handler',
            onGestureStart,
            onPan,
            onZoom,
            onRotate,
            onTap,
            onPress,
            onGestureEnd
        };
        const utils = render(
            <GestureControls
                defaultHandler={handler}
                moveThreshold={MOVE_THRESHOLD}
                pressDelay={PRESS_DELAY}
                {...props}
            />
        );
        const target = utils.container.firstChild as HTMLElement;
        // Mock to prevent coordinates being NaN/0 from JSDOM limitations
        target.getBoundingClientRect = () => ({
            width: 500, height: 500, top: 0, left: 0, right: 500, bottom: 500, x: 0, y: 0, toJSON: () => {
            }
        } as DOMRect);
        return {...utils, target};
    };

    describe('Mouse Events', () => {

        it('should trigger onTap on mouse up if move is within threshold', () => {
            const {target} = setup();

            fireEvent.mouseDown(target, {button: PAN_BUTTON, ...mouseEventCoords(startX, startY)});
            fireEvent.mouseUp(target, {...mouseEventCoords(startX + 2, startY + 2)});

            chai.assert.equal(onTap.callCount, 1);
            chai.assert.deepEqual(onTap.getCall(0).args[0], {x: startX, y: startY});
        });

        it('should trigger onPan when moving beyond threshold', () => {
            const {target} = setup();

            fireEvent.mouseDown(target, {button: PAN_BUTTON, ...mouseEventCoords(startX, startY)});

            fireEvent.mouseMove(target, {
                button: PAN_BUTTON,
                ...mouseEventCoords(startX + MOVE_THRESHOLD + 5, startY)
            });

            chai.assert.equal(onPan.callCount, 1);
            // Delta should be the total movement since start
            chai.assert.equal(onPan.getCall(0).args[0].x, MOVE_THRESHOLD + 5);
        });

        it('should trigger onPress after delay', () => {
            const {target} = setup();

            fireEvent.mouseDown(target, {button: PAN_BUTTON, ...mouseEventCoords(startX, startY)});

            act(() => {
                vi.advanceTimersByTime(PRESS_DELAY + 10);
            });

            chai.assert.equal(onPress.callCount, 1);
            chai.assert.deepEqual(onPress.getCall(0).args[0], {x: startX, y: startY});
        });

        it('should trigger onZoom when using zoom button (middle click)', () => {
            const {target} = setup();

            fireEvent.mouseDown(target, {button: ZOOM_BUTTON, ...mouseEventCoords(startX, startY)});
            fireEvent.mouseMove(target, {
                button: ZOOM_BUTTON,
                ...mouseEventCoords(startX, startY + 20)
            });

            chai.assert.equal(onZoom.callCount, 1);
            chai.assert.equal(onZoom.getCall(0).args[0].y, 20);
        });

        it('should trigger onRotate when using rotate button (right click)', () => {
            const {target} = setup();

            fireEvent.mouseDown(target, {button: ROTATE_BUTTON, ...mouseEventCoords(startX, startY)});
            fireEvent.mouseMove(target, {
                button: ROTATE_BUTTON,
                ...mouseEventCoords(startX + 30, startY)
            });

            chai.assert.equal(onRotate.callCount, 1);
            chai.assert.equal(onRotate.getCall(0).args[0].x, 30);
        });

        it('should trigger onZoom on wheel event', () => {
            const {target} = setup();

            fireEvent.wheel(target, {deltaY: 100, deltaMode: 0});

            chai.assert.equal(onZoom.callCount, 1);
            // 100 * 0.07 from the component logic
            chai.assert.approximately(onZoom.getCall(0).args[0].y, 7, 0.1);
        });

    });

    describe('Touch Events', () => {
        const startX1 = 100, startY1 = 100;
        const startX2 = 200, startY2 = 200;

        it('should call onZoom with -ve Y if the fingers move apart', () => {
            const {target} = setup();

            fireEvent.touchStart(target, {
                touches: [
                    {pageX: startX1, pageY: startY1},
                    {pageX: startX2, pageY: startY2}
                ]
            });

            const delta = 20;
            fireEvent.touchMove(target, {
                touches: [
                    {pageX: startX1 - delta, pageY: startY1 - delta},
                    {pageX: startX2 + delta, pageY: startY2 + delta}
                ]
            });

            chai.assert.equal(onZoom.callCount, 1);
            chai.assert.isBelow(onZoom.getCall(0).args[0].y, 0);
        });
    });

    describe('GestureHandler fallback and priority', () => {
        let onPanDefault: sinon.SinonStub;
        let onPanChild: sinon.SinonStub;
        let onZoomDefault: sinon.SinonStub;

        const DummyChildHandler = ({handler}: {handler: GestureHandler<any>}) => {
            useGestureHandler(handler);
            return <div data-testid='child'/>;
        };

        beforeEach(() => {
            onPanDefault = sinon.stub();
            onPanChild = sinon.stub();
            onZoomDefault = sinon.stub();
        });

        it('should call child handler if matched, but fall back to default for unimplemented methods', () => {
            const childHandler: GestureHandler = {
                id: 'child',
                match: () => true, // Always claim the gesture
                onPan: onPanChild
                // onZoom is NOT implemented here
            };

            const {target} = setup({
                defaultHandler: {onPan: onPanDefault, onZoom: onZoomDefault},
                children: <DummyChildHandler handler={childHandler}/>
            });

            // 1. Test that Pan is intercepted by the child
            fireEvent.mouseDown(target, {button: PAN_BUTTON, ...mouseEventCoords(startX, startY)});
            fireEvent.mouseMove(target, mouseEventCoords(startX + 20, startY));

            chai.assert.equal(onPanChild.callCount, 1, 'Child should have handled Pan');
            chai.assert.equal(onPanDefault.callCount, 0, 'Default should not have been called for Pan');

            // 2. Test that Zoom falls back to default because child doesn't have it
            fireEvent.wheel(target, {deltaY: 100, deltaMode: 0});

            chai.assert.equal(onZoomDefault.callCount, 1, 'Default should have handled Zoom via fallback');
        });

        it('should respect priority when multiple handlers match', () => {
            const onPanHigh = sinon.stub();
            const onPanLow = sinon.stub();

            const highPriorityHandler: GestureHandler = {
                id: 'high',
                priority: 10,
                match: () => true,
                onPan: onPanHigh
            };

            const lowPriorityHandler: GestureHandler = {
                id: 'low',
                priority: 1,
                match: () => true,
                onPan: onPanLow
            };

            const {target} = setup({
                children: (
                    <>
                        <DummyChildHandler handler={lowPriorityHandler}/>
                        <DummyChildHandler handler={highPriorityHandler}/>
                    </>
                )
            });

            fireEvent.mouseDown(target, {button: PAN_BUTTON, ...mouseEventCoords(startX, startY)});
            fireEvent.mouseMove(target, mouseEventCoords(startX + 20, startY));

            chai.assert.equal(onPanHigh.callCount, 1, 'High priority should win');
            chai.assert.equal(onPanLow.callCount, 0, 'Low priority should be ignored');
        });

        it('should pass a custom context to the match function', () => {
            const matchStub = sinon.stub().returns(true);
            const buildContext = (pos: ObjectVector2) => ({isTest: true, pos});

            const contextHandler: GestureHandler<{isTest: boolean, pos: ObjectVector2}> = {
                id: 'context-test',
                match: matchStub,
                onPan: () => {}
            };

            const {target} = setup({
                buildContext,
                children: <DummyChildHandler handler={contextHandler}/>
            });

            fireEvent.mouseDown(target, {button: PAN_BUTTON, ...mouseEventCoords(startX, startY)});

            chai.assert.isTrue(matchStub.calledOnce);
            const contextArg = matchStub.getCall(0).args[0];
            chai.assert.strictEqual(contextArg.isTest, true);
            chai.assert.exists(contextArg.pos);
        });
    });
});