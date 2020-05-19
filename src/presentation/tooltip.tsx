import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react';
import * as ReactDOM from 'react-dom';
import memoizeOne from 'memoize-one';

import './tooltip.scss';

interface TooltipProps {
    tooltip?: string | React.ReactElement;
    maxWidth?: number;
    verticalSpace?: number;
    className?: string;
}

/**
 * This code is adapted from https://codepen.io/davidgilbertson/pen/ooXVyw
 */
const getStyle = memoizeOne((width?: number, dimensions?: DOMRect, maxWidth: number = document.body.clientWidth, height = 16) => {
    if (width === undefined || dimensions === undefined) {
        return undefined;
    }
    const style: React.CSSProperties = {};
    if (width > maxWidth) {
        width = maxWidth;
        style.width = width;
    }
    // center align the tooltip by taking both the target and tooltip widths into account
    style.left = (dimensions.left + (dimensions.width / 2)) - (width / 2);
    style.left = Math.max(0, style.left); // make sure it doesn't poke off the left side of the page
    style.left = Math.min(style.left, document.body.clientWidth - width - 1); // or off the right
    if (dimensions.top < window.innerHeight / 2) { // the top half of the page
        // when on the top half of the page, position the top of the tooltip just below the target (it will stretch downwards)
        style.top = dimensions.top + dimensions.height + height;
    } else {
        // when on the bottom half, set the bottom of the tooltip just above the top of the target (it will stretch upwards)
        style.bottom = (window.innerHeight - dimensions.top) + height;
    }
    return style;
});

const Tooltip: FunctionComponent<TooltipProps> = (props) => {
    const element = useMemo(() => {
        // Create one shared 'tooltip-container' div to be used by all tooltips, and don't remove it afterwards.
        const elementId = 'tooltip-container';
        let element = document.getElementById(elementId);
        if (!element) {
            element = document.createElement('div');
            element.id = elementId;
            document.body.appendChild(element);
        }
        return element;
    }, []);
    const [openTimeout, setOpenTimeout] = useState<number | undefined>();
    useEffect(() => () => {openTimeout && window.clearTimeout(openTimeout)}, [openTimeout]);
    const [closeTimeout, setCloseTimeout] = useState<number | undefined>();
    useEffect(() => () => {closeTimeout && window.clearTimeout(closeTimeout)}, [closeTimeout]);
    const [dimensions, setDimensions] = useState<DOMRect | undefined>();
    const [visible, setVisible] = useState(false);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    return !props.tooltip ? (
        <span className={props.className}>{props.children}</span>
    ) : (
        <span
            className={props.className}
            onPointerOver={(evt) => {
                setDimensions(evt.currentTarget.getBoundingClientRect());
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
                            getStyle(tooltipRef.current ? tooltipRef.current.offsetWidth : undefined, dimensions, props.maxWidth, props.verticalSpace)
                        }>
                            {props.tooltip}
                        </div>
                    ), element)
                )
            }
        </span>
    );
};

export default Tooltip;