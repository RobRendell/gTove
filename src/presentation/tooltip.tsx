import React, {FunctionComponent, MutableRefObject, useEffect, useRef, useState} from 'react';
import * as ReactDOM from 'react-dom';
import memoizeOne from 'memoize-one';

import './tooltip.scss';

interface TooltipProps {
    tooltip?: string | React.ReactElement;
    maxWidth?: number | string;
    verticalSpace?: number;
    className?: string;
}

/**
 * This code is adapted from https://codepen.io/davidgilbertson/pen/ooXVyw
 */
const getStyle = memoizeOne((tooltipElement: HTMLDivElement | null, containerElement?: HTMLSpanElement | null, maxWidth?: number | string, height = 5) => {
    if (!tooltipElement || !containerElement) {
        return undefined;
    }
    let width = tooltipElement.offsetWidth;
    const dimensions = containerElement.getBoundingClientRect();
    const targetDocument = containerElement.ownerDocument ? containerElement.ownerDocument : document;
    const {clientWidth, clientHeight} = targetDocument.body;
    if (typeof(maxWidth) === 'string') {
        const percent = parseInt(maxWidth);
        maxWidth = clientWidth * percent / 100;
    }
    if (maxWidth === undefined || maxWidth > clientWidth) {
        maxWidth = clientWidth;
    }
    const style: React.CSSProperties = {};
    if (width > maxWidth) {
        width = maxWidth;
        style.width = width;
    }
    // center align the tooltip by taking both the target and tooltip widths into account
    style.left = (dimensions.left + (dimensions.width / 2)) - (width / 2);
    style.left = Math.max(0, style.left); // make sure it doesn't poke off the left side of the page
    style.left = Math.min(style.left, clientWidth - width - 1); // or off the right
    if (dimensions.top + dimensions.height < clientHeight / 2) { // the top half of the page
        // when on the top half of the page, position the top of the tooltip just below the target (it will stretch downwards)
        style.top = dimensions.top + dimensions.height + height;
    } else {
        // when on the bottom half, set the bottom of the tooltip just above the top of the target (it will stretch upwards)
        style.bottom = (clientHeight - dimensions.top) + height;
    }
    return style;
});

const getElement = memoizeOne((containerRef: MutableRefObject<HTMLSpanElement | null>): HTMLElement => {
    // Create one shared 'tooltip-container' div to be used by all tooltips, and don't remove it afterwards.
    const elementId = 'tooltip-container';
    // ... except that now we support popping out windows, we need to get the *right* shared tooltip-container
    const targetDocument = containerRef.current && containerRef.current.ownerDocument ? containerRef.current.ownerDocument : document;
    let element = targetDocument.getElementById(elementId);
    if (!element) {
        element = targetDocument.createElement('div');
        element.id = elementId;
        targetDocument.body.appendChild(element);
    }
    return element;
});

const Tooltip: FunctionComponent<TooltipProps> = (props) => {
    const [openTimeout, setOpenTimeout] = useState<number | undefined>();
    useEffect(() => () => {openTimeout && window.clearTimeout(openTimeout)}, [openTimeout]);
    const [closeTimeout, setCloseTimeout] = useState<number | undefined>();
    useEffect(() => () => {closeTimeout && window.clearTimeout(closeTimeout)}, [closeTimeout]);
    const [visible, setVisible] = useState(false);
    const containerRef = useRef<HTMLSpanElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    return !props.tooltip ? (
        <span className={props.className}>{props.children}</span>
    ) : (
        <span
            className={props.className}
            ref={containerRef}
            onPointerOver={() => {
                setCloseTimeout(undefined); // useEffect cleanup will clear pending timeout on next frame.
                if (!visible) {
                    setOpenTimeout(window.setTimeout(() => {
                        setVisible(true);
                        setOpenTimeout(undefined);
                    }, 500));
                }
            }}
            onPointerOut={(evt) => {
                setOpenTimeout(undefined); // useEffect cleanup will clear pending timeout on next frame.
                if (visible) {
                    setCloseTimeout(window.setTimeout(() => {
                        setVisible(false);
                        setCloseTimeout(undefined);
                    }, evt.pointerType === 'touch' ? 1000 : 50));
                }
            }}
        >
            {props.children}
            {
                !visible ? null : (
                    ReactDOM.createPortal((
                        <div className='tooltip-body' ref={tooltipRef} style={
                            getStyle(tooltipRef.current, containerRef.current, props.maxWidth, props.verticalSpace)
                        }>
                            {props.tooltip}
                        </div>
                    ), getElement(containerRef))
                )
            }
        </span>
    );
};

export default Tooltip;