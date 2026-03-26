import {useThree} from '@react-three/fiber';
import {useCallback, useEffect, useRef} from 'react';
import {useSelector} from 'react-redux';
import {Vector3} from 'three';

import {useCameraParameters} from '../context/cameraParametersContextBridge';
import {getTabletopStateFromStore} from '../redux/mainReducer';
import {ObjectVector2} from '../util/scenarioUtils';

const EDGE_RECT_DRAG_BORDER = 30;
const EDGE_DRAG_SENSITIVITY = 0.05;
const SIDE_MENU_WIDTH = 120;

export function useEdgeAutoPan(isActive: boolean) {
    const {size: {width, height}} = useThree();
    const {setCameraParameters} = useCameraParameters();
    const {sideMenuOpen} = useSelector(getTabletopStateFromStore);

    const positionRef = useRef<ObjectVector2>();
    const deltaRef = useRef(new Vector3());
    useEffect(() => {
        const autoPanInterval = !isActive ? undefined : window.setInterval(() => {
            if (!positionRef.current) {
                return;
            }
            const dragBorder = Math.min(EDGE_RECT_DRAG_BORDER, width / 10, height / 10);
            const leftMargin = dragBorder + (sideMenuOpen ? SIDE_MENU_WIDTH : 0);
            const dx = (positionRef.current.x < leftMargin) ? positionRef.current.x - leftMargin
                : (positionRef.current.x > width - dragBorder) ? positionRef.current.x - width + dragBorder
                    : 0;
            const dy = (positionRef.current.y < dragBorder) ? positionRef.current.y - dragBorder
                : (positionRef.current.y > height - dragBorder) ? positionRef.current.y - height + dragBorder
                    : 0;
            if (dx || dy) {
                deltaRef.current.set(dx * EDGE_DRAG_SENSITIVITY, 0, dy * EDGE_DRAG_SENSITIVITY);
                setCameraParameters({deltaPosition: deltaRef.current, deltaLookAt: deltaRef.current}, 100);
            }
        }, 100);
        return () => {
            window.clearInterval(autoPanInterval);
            positionRef.current = undefined;
        }
    }, [height, isActive, positionRef, setCameraParameters, sideMenuOpen, width]);

    return useCallback((position: ObjectVector2) => {
        if (!positionRef.current) {
            positionRef.current = {...position};
        } else {
            positionRef.current.x = position.x;
            positionRef.current.y = position.y;
        }
    }, [])
}