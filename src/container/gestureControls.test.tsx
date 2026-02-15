import {act, cleanup, fireEvent, render} from '@testing-library/react';
import * as chai from 'chai';
import * as sinon from 'sinon';
import {afterEach, beforeEach, describe, it, vi} from 'vitest';

import GestureControls, {PAN_BUTTON, ROTATE_BUTTON, ZOOM_BUTTON} from './gestureControls';

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
        const utils = render(
            <GestureControls
                onPan={onPan}
                onZoom={onZoom}
                onRotate={onRotate}
                onTap={onTap}
                onPress={onPress}
                onGestureStart={onGestureStart}
                onGestureEnd={onGestureEnd}
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
});