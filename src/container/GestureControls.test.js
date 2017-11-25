import React from 'react';
import chai from 'chai';
import chaiEnzyme from 'chai-enzyme';
import {shallow} from 'enzyme';
import * as sinon from 'sinon';

import GestureControls from './GestureControls';

describe('GestureControls component', () => {

    chai.use(chaiEnzyme());

    const baseEvent = {
        preventDefault: sinon.stub(),
        stopPropagation: sinon.stub()
    };
    const mouseDownEvent = 'mouseDown';
    const mouseMoveEvent = 'mouseMove';
    const mouseUpEvent = 'mouseUp';
    const mouseWheelEvent = 'wheel';
    const touchStartEvent = 'touchStart';
    const touchMoveEvent = 'touchMove';
    const touchEndEvent = 'touchEnd';

    describe('sameOppositeQuadrant function', () => {

        it('should return 1 for parallel vectors', () => {
            let dot = GestureControls.sameOppositeQuadrant({x: 1, y: 0}, {x: 1, y: 0});
            chai.assert.equal(dot, 1);
        });

        it('should return -1 for antiparallel vectors', () => {
            let dot = GestureControls.sameOppositeQuadrant({x: 1, y: 0}, {x: -1, y: 0});
            chai.assert.equal(dot, -1);
        });

        it('should return 0 for vectors which diverge by 45 degrees', () => {
            let dot = GestureControls.sameOppositeQuadrant({x: 1, y: 0}, {x: 1, y: 1});
            chai.assert.equal(dot, 0);
        });

        it('should return 1 for vectors which diverge by less than 45 degrees', () => {
            let dot = GestureControls.sameOppositeQuadrant({x: 1, y: 0}, {x: 1, y: 0.999});
            chai.assert.equal(dot, 1);
        });

    });

    describe('mouse events with panButton', () => {

        const startX = 2 * GestureControls.defaultProps.moveThreshold;
        const startY = 2 * GestureControls.defaultProps.moveThreshold;

        let onTap, onPress, onPan;
        let component;

        beforeEach(() => {
            onTap = sinon.stub();
            onPress = sinon.stub();
            onPan = sinon.stub();
            component = shallow(<GestureControls onTap={onTap} onPress={onPress} onPan={onPan}/>);
        });

        it('should start out treating a pan button click as a tap', () => {
            const event = {
                ...baseEvent,
                button: GestureControls.defaultProps.config.panButton,
                clientX: startX,
                clientY: startY
            };

            component.simulate(mouseDownEvent, event);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            component.simulate(mouseUpEvent, event);
            chai.assert.equal(onTap.callCount, 1);
            chai.assert.equal(onTap.getCall(0).args[0].x, startX);
            chai.assert.equal(onTap.getCall(0).args[0].y, startY);
        });

        it('should change a tap to a press if it stays close to the start for long enough', () => {
            const clickEvent = {
                ...baseEvent,
                button: GestureControls.defaultProps.config.panButton,
                clientX: startX,
                clientY: startY
            };
            component.simulate(mouseDownEvent, clickEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            // Somewhat dodgy - directly change state
            component.instance().state.startTime = Date.now() - GestureControls.defaultProps.pressDelay;
            const moveEvent = {
                ...clickEvent,
                clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                clientY: startY
            };
            component.simulate(mouseMoveEvent, moveEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.PRESSING);
            component.simulate(mouseUpEvent, moveEvent);
            chai.assert.equal(onPress.callCount, 1);
            chai.assert.equal(onPress.getCall(0).args[0].x, startX);
            chai.assert.equal(onPress.getCall(0).args[0].y, startY);
        });

        it('should change a tap to a pan if it moves too far', () => {
            const clickEvent = {
                ...baseEvent,
                button: GestureControls.defaultProps.config.panButton,
                clientX: startX,
                clientY: startY
            };
            component.simulate(mouseDownEvent, clickEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            const moveEvent = {
                ...clickEvent,
                clientX: startX + GestureControls.defaultProps.moveThreshold,
                clientY: startY
            };
            component.simulate(mouseMoveEvent, moveEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.PANNING);
            chai.assert.equal(onPan.callCount, 1);
            chai.assert.equal(onPan.getCall(0).args[0].x, GestureControls.defaultProps.moveThreshold);
        });

        it('should remain a tap if it stays close and under the threshold time', () => {
            const clickEvent = {
                ...baseEvent,
                button: GestureControls.defaultProps.config.panButton,
                clientX: startX,
                clientY: startY
            };
            component.simulate(mouseDownEvent, clickEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            // Somewhat dodgy - directly change state
            component.instance().state.startTime = Date.now() - GestureControls.defaultProps.pressDelay + 10;
            const moveEvent = {
                ...clickEvent,
                clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                clientY: startY
            };
            component.simulate(mouseMoveEvent, moveEvent);
            component.simulate(mouseUpEvent, moveEvent);
            chai.assert.equal(onTap.callCount, 1);
            chai.assert.equal(onTap.getCall(0).args[0].x, startX);
            chai.assert.equal(onTap.getCall(0).args[0].y, startY);
        });

        it('should call onPan with deltas, starting from the initial click position', () => {
            const clickEvent = {
                ...baseEvent,
                button: GestureControls.defaultProps.config.panButton,
                clientX: startX,
                clientY: startY
            };
            component.simulate(mouseDownEvent, clickEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            const moveEvent = {
                ...clickEvent,
                clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                clientY: startY
            };
            component.simulate(mouseMoveEvent, moveEvent);
            chai.assert.equal(onPan.callCount, 0);
            component.simulate(mouseMoveEvent, {...moveEvent, clientX: 2 * startX});
            chai.assert.equal(component.instance().state.action, GestureControls.PANNING);
            chai.assert.equal(onPan.callCount, 1);
            chai.assert.equal(onPan.getCall(0).args[0].x, startX);
            chai.assert.equal(onPan.getCall(0).args[0].y, 0);
            component.simulate(mouseMoveEvent, {...moveEvent, clientX: startX, clientY: 2 * startY});
            chai.assert.equal(component.instance().state.action, GestureControls.PANNING);
            chai.assert.equal(onPan.callCount, 2);
            chai.assert.equal(onPan.getCall(1).args[0].x, -startX);
            chai.assert.equal(onPan.getCall(1).args[0].y, startY);
        });

    });

    describe('mouse events with zoomButton', () => {

        const startX = 100;
        const startY = 100;

        let onZoom;
        let component;

        beforeEach(() => {
            onZoom = sinon.stub();
            component = shallow(<GestureControls onZoom={onZoom}/>);
        });

        it('should call onZoom with deltas, starting from the initial click position', () => {
            const clickEvent = {
                ...baseEvent,
                button: GestureControls.defaultProps.config.zoomButton,
                clientX: startX,
                clientY: startY
            };
            component.simulate(mouseDownEvent, clickEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.ZOOMING);
            const moveEvent = {
                ...clickEvent,
                clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                clientY: startY
            };
            component.simulate(mouseMoveEvent, moveEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.ZOOMING);
            chai.assert.equal(onZoom.callCount, 1);
            chai.assert.equal(onZoom.getCall(0).args[0].x, GestureControls.defaultProps.moveThreshold - 1);
            chai.assert.equal(onZoom.getCall(0).args[0].y, 0);
            component.simulate(mouseMoveEvent, {...moveEvent, clientX: startX, clientY: 2 * startY});
            chai.assert.equal(component.instance().state.action, GestureControls.ZOOMING);
            chai.assert.equal(onZoom.callCount, 2);
            chai.assert.equal(onZoom.getCall(1).args[0].x, -(GestureControls.defaultProps.moveThreshold - 1));
            chai.assert.equal(onZoom.getCall(1).args[0].y, startY);
        });

    });

    describe('mouse events with rotateButton', () => {

        const startX = 100;
        const startY = 100;

        let onRotate;
        let component;

        beforeEach(() => {
            onRotate = sinon.stub();
            component = shallow(<GestureControls onRotate={onRotate}/>);
        });

        it('should call onRotate with deltas, starting from the initial click position', () => {
            const clickEvent = {
                ...baseEvent,
                button: GestureControls.defaultProps.config.rotateButton,
                clientX: startX,
                clientY: startY
            };
            component.simulate(mouseDownEvent, clickEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.ROTATING);
            const moveEvent = {
                ...clickEvent,
                clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                clientY: startY
            };
            component.simulate(mouseMoveEvent, moveEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.ROTATING);
            chai.assert.equal(onRotate.callCount, 1);
            chai.assert.equal(onRotate.getCall(0).args[0].x, GestureControls.defaultProps.moveThreshold - 1);
            chai.assert.equal(onRotate.getCall(0).args[0].y, 0);
            component.simulate(mouseMoveEvent, {...moveEvent, clientX: startX, clientY: 2 * startY});
            chai.assert.equal(component.instance().state.action, GestureControls.ROTATING);
            chai.assert.equal(onRotate.callCount, 2);
            chai.assert.equal(onRotate.getCall(1).args[0].x, -(GestureControls.defaultProps.moveThreshold - 1));
            chai.assert.equal(onRotate.getCall(1).args[0].y, startY);
        });

    });

    describe('mouse wheel events', () => {

        let onZoom;
        let component;

        beforeEach(() => {
            onZoom = sinon.stub();
            component = shallow(<GestureControls onZoom={onZoom}/>);
        });

        it('should call onZoom with +ve Y on wheel down', () => {
            let event = {
                ...baseEvent,
                deltaY: 100
            };
            component.simulate(mouseWheelEvent, event);
            chai.assert.equal(onZoom.callCount, 1);
            // Zoom is converted to be in the Y direction only
            chai.assert.equal(onZoom.getCall(0).args[0].x, 0);
            chai.assert.isTrue(onZoom.getCall(0).args[0].y > 0);
        });

        it('should call onZoom with -ve Y on wheel up', () => {
            let event = {
                ...baseEvent,
                deltaY: -100
            };
            component.simulate(mouseWheelEvent, event);
            chai.assert.equal(onZoom.callCount, 1);
            // Zoom is converted to be in the Y direction only
            chai.assert.equal(onZoom.getCall(0).args[0].x, 0);
            chai.assert.isTrue(onZoom.getCall(0).args[0].y < 0);
        });

    });

    describe('touch events with one finger', () => {

        const startX = 2 * GestureControls.defaultProps.moveThreshold;
        const startY = 2 * GestureControls.defaultProps.moveThreshold;

        let onTap, onPress, onPan;
        let component;

        beforeEach(() => {
            onTap = sinon.stub();
            onPress = sinon.stub();
            onPan = sinon.stub();
            component = shallow(<GestureControls onTap={onTap} onPress={onPress} onPan={onPan}/>);
        });

        it('should start out treating a single finger touch as a tap', () => {
            const event = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchStartEvent, event);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            component.simulate(touchEndEvent, {...event, touches: []});
            chai.assert.equal(onTap.callCount, 1);
            chai.assert.equal(onTap.getCall(0).args[0].x, startX);
            chai.assert.equal(onTap.getCall(0).args[0].y, startY);
        });

        it('should change a tap to a press if it stays close to the start for long enough', () => {
            const touchEvent = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchStartEvent, touchEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            // Somewhat dodgy - directly change state
            component.instance().state.startTime = Date.now() - GestureControls.defaultProps.pressDelay;
            const moveEvent = {
                ...touchEvent,
                touches: [
                    {
                        clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchMoveEvent, moveEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.PRESSING);
            component.simulate(touchEndEvent, {...moveEvent, touches: []});
            chai.assert.equal(onPress.callCount, 1);
            chai.assert.equal(onPress.getCall(0).args[0].x, startX);
            chai.assert.equal(onPress.getCall(0).args[0].y, startY);
        });

        it('should change a tap to a pan if it moves too far', () => {
            const touchEvent = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchStartEvent, touchEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            const moveEvent = {
                ...touchEvent,
                touches: [
                    {
                        clientX: startX + GestureControls.defaultProps.moveThreshold,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchMoveEvent, moveEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.PANNING);
            chai.assert.equal(onPan.callCount, 1);
            chai.assert.equal(onPan.getCall(0).args[0].x, GestureControls.defaultProps.moveThreshold);
        });

        it('should remain a tap if it stays close and under the threshold time', () => {
            const touchEvent = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchStartEvent, touchEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            // Somewhat dodgy - directly change state
            component.instance().state.startTime = Date.now() - GestureControls.defaultProps.pressDelay + 10;
            const moveEvent = {
                ...touchEvent,
                touches: [
                    {
                        clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchMoveEvent, moveEvent);
            component.simulate(touchEndEvent, {...moveEvent, touches: []});
            chai.assert.equal(onTap.callCount, 1);
            chai.assert.equal(onTap.getCall(0).args[0].x, startX);
            chai.assert.equal(onTap.getCall(0).args[0].y, startY);
        });

        it('should call onPan with deltas, staring from the initial touch position', () => {
            const clickEvent = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX,
                        clientY: startY
                    }
                ]
            };
            component.simulate(touchStartEvent, clickEvent);
            chai.assert.equal(component.instance().state.action, GestureControls.TAPPING);
            const moveEvent = {
                ...clickEvent,
                clientX: startX + GestureControls.defaultProps.moveThreshold - 1,
                clientY: startY
            };
            component.simulate(touchMoveEvent, moveEvent);
            chai.assert.equal(onPan.callCount, 0);
            component.simulate(touchMoveEvent, {
                ...moveEvent,
                touches: [
                    {
                        clientX: 2 * startX,
                        clientY: startY
                    }
                ]
            });
            chai.assert.equal(component.instance().state.action, GestureControls.PANNING);
            chai.assert.equal(onPan.callCount, 1);
            chai.assert.equal(onPan.getCall(0).args[0].x, startX);
            chai.assert.equal(onPan.getCall(0).args[0].y, 0);
            component.simulate(touchMoveEvent, {
                ...moveEvent,
                touches: [
                    {
                        clientX: startX,
                        clientY: 2 * startY
                    }
                ]
            });
            chai.assert.equal(component.instance().state.action, GestureControls.PANNING);
            chai.assert.equal(onPan.callCount, 2);
            chai.assert.equal(onPan.getCall(1).args[0].x, -startX);
            chai.assert.equal(onPan.getCall(1).args[0].y, startY);
        });

    });

    describe('touch events with two fingers', () => {

        const startX1 = 100;
        const startY1 = 100;
        const startX2 = 200;
        const startY2 = 200;

        let onRotate, onZoom;
        let component;

        beforeEach(() => {
            onRotate = sinon.stub();
            onZoom = sinon.stub();
            component = shallow(<GestureControls onRotate={onRotate} onZoom={onZoom}/>);
        });

        it('should call onRotate vertically if the fingers move in parallel', () => {
            const event = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX1,
                        clientY: startY1
                    },
                    {
                        clientX: startX2,
                        clientY: startY2
                    }
                ]
            };
            component.simulate(touchStartEvent, event);
            const deltaX = 20, deltaY = 10;
            component.simulate(touchMoveEvent, {
                ...event,
                touches: [
                    {
                        clientX: startX1 + deltaX,
                        clientY: startY1 + deltaY
                    },
                    {
                        clientX: startX2 + deltaX,
                        clientY: startY2 + deltaY
                    }
                ]
            });
            chai.assert.equal(onRotate.callCount, 1);
            // Turns movement into purely vertical rotation
            chai.assert.equal(onRotate.getCall(0).args[0].x, 0);
            chai.assert.equal(onRotate.getCall(0).args[0].y, deltaY);
        });

        it('should call onRotate if the fingers move in a clockwise direction', () => {
            const event = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX1,
                        clientY: startY1
                    },
                    {
                        clientX: startX2,
                        clientY: startY2
                    }
                ]
            };
            component.simulate(touchStartEvent, event);
            const delta = 20;
            component.simulate(touchMoveEvent, {
                ...event,
                touches: [
                    {
                        clientX: startX1 + delta,
                        clientY: startY1 - delta
                    },
                    {
                        clientX: startX2 - delta,
                        clientY: startY2 + delta
                    }
                ]
            });
            chai.assert.equal(onRotate.callCount, 1);
            // Rotate is converted to be in the X direction only
            chai.assert.equal(onRotate.getCall(0).args[0].x, -Math.sqrt(2 * delta * delta));
            chai.assert.equal(onRotate.getCall(0).args[0].y, 0);
        });

        it('should call onRotate if the fingers move in an anticlockwise direction', () => {
            const event = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX1,
                        clientY: startY1
                    },
                    {
                        clientX: startX2,
                        clientY: startY2
                    }
                ]
            };
            component.simulate(touchStartEvent, event);
            const delta = 20;
            component.simulate(touchMoveEvent, {
                ...event,
                touches: [
                    {
                        clientX: startX1 - delta,
                        clientY: startY1 + delta
                    },
                    {
                        clientX: startX2 + delta,
                        clientY: startY2 - delta
                    }
                ]
            });
            chai.assert.equal(onRotate.callCount, 1);
            // Rotate is converted to be in the X direction only
            chai.assert.equal(onRotate.getCall(0).args[0].x, Math.sqrt(2 * delta * delta));
            chai.assert.equal(onRotate.getCall(0).args[0].y, 0);
        });

        it('should call onZoom with -ve Y if the fingers move apart along the same axis', () => {
            const event = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX1,
                        clientY: startY1
                    },
                    {
                        clientX: startX2,
                        clientY: startY2
                    }
                ]
            };
            component.simulate(touchStartEvent, event);
            const delta = 20;
            component.simulate(touchMoveEvent, {
                ...event,
                touches: [
                    {
                        clientX: startX1 - delta,
                        clientY: startY1 - delta
                    },
                    {
                        clientX: startX2 + delta,
                        clientY: startY2 + delta
                    }
                ]
            });
            chai.assert.equal(onZoom.callCount, 1);
            // Zoom is converted to be in the Y direction only
            chai.assert.equal(onZoom.getCall(0).args[0].x, 0);
            chai.assert.equal(onZoom.getCall(0).args[0].y, -2 * Math.sqrt(2 * delta * delta));
        });

        it('should call onZoom with +ve Y if the fingers move together along the same axis', () => {
            const event = {
                ...baseEvent,
                touches: [
                    {
                        clientX: startX1,
                        clientY: startY1
                    },
                    {
                        clientX: startX2,
                        clientY: startY2
                    }
                ]
            };
            component.simulate(touchStartEvent, event);
            const delta = 20;
            component.simulate(touchMoveEvent, {
                ...event,
                touches: [
                    {
                        clientX: startX1 + delta,
                        clientY: startY1 + delta
                    },
                    {
                        clientX: startX2 - delta,
                        clientY: startY2 - delta
                    }
                ]
            });
            chai.assert.equal(onZoom.callCount, 1);
            // Zoom is converted to be in the Y direction only
            chai.assert.equal(onZoom.getCall(0).args[0].x, 0);
            chai.assert.equal(onZoom.getCall(0).args[0].y, 2 * Math.sqrt(2 * delta * delta));
        });

    });

});