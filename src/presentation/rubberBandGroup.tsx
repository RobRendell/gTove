import './rubberBandGroup.scss';

import throttle from 'lodash/throttle';
import {
    createContext,
    FunctionComponent,
    JSXElementConstructor,
    MouseEvent,
    PropsWithChildren,
    ReactInstance, RefObject,
    TouchEvent as ReactTouchEvent,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {findDOMNode} from 'react-dom';

import RubberBand, {RubberBandProps} from './rubberBand';

interface SelectableGroupContextType {
    [key: string]: Element | Text | null;
}

const SelectableGroupContext = createContext<RefObject<SelectableGroupContextType> | undefined>(undefined);

interface SelectableChildProps {
    selectionId?: string;
}

export function makeSelectableChildHOC<P extends object>(Component: JSXElementConstructor<P>): FunctionComponent<P & SelectableChildProps> {
    return (props) => {
        const {selectionId, ...otherProps} = props;
        const selectableChildren = useContext(SelectableGroupContext);

        return (
            <Component ref={(ref: ReactInstance) => {
                if (selectableChildren?.current && selectionId) {
                    if (ref) {
                        selectableChildren.current[selectionId] = findDOMNode(ref);
                    } else {
                        delete (selectableChildren.current[selectionId]);
                    }
                }
            }} {...otherProps as P}/>
        );
    }
}

interface RubberBandGroupProps extends PropsWithChildren {
    setSelectedIds: (selectedIds: {[id: string]: boolean}) => void;
    overlap?: number;
}

export const RubberBandGroup: FunctionComponent<RubberBandGroupProps> = ({overlap, setSelectedIds, children}) => {

    const divRef = useRef<HTMLDivElement>(null);
    const [rubberBand, setRubberBand] = useState<RubberBandProps & {show: boolean}>({left: 0, top: 0, width: 0, height: 0, show: false});
    const [, setStartTimeout] = useState<number | undefined>();

    const selectableChildren = useRef<SelectableGroupContextType>({});

    const selectedIdsRef = useRef<{[id: string]: boolean}>({});
    useEffect(() => {
        if (!rubberBand.show) {
            // Reset our local copy of selected refs when the elastic band is hidden.
            selectedIdsRef.current = {};
        }
    }, [rubberBand.show]);

    const updateSelectedIds = useMemo(() => (
        throttle(() => {
            // Find all selectable children overlapping the rubber band.
            const overlapPx = overlap || 10;
            setRubberBand((prev) => {
                if (prev.show && Math.abs(prev.width) > 2 * overlapPx && Math.abs(+prev.height) > 2 * overlapPx) {
                    const minX = (prev.width < 0 ? prev.left + prev.width : prev.left) + overlapPx;
                    const maxX = (prev.width > 0 ? prev.left + prev.width : prev.left) - overlapPx;
                    const minY = (prev.height < 0 ? prev.top + prev.height : prev.top) + overlapPx;
                    const maxY = (prev.height > 0 ? prev.top + prev.height : prev.top) - overlapPx;
                    let selectedIds: {[id: string]: boolean} = {};
                    for (let id of Object.keys(selectableChildren.current)) {
                        const element = selectableChildren.current[id];
                        if (element && element instanceof Element) {
                            const bounds = element.getBoundingClientRect();
                            const x = bounds.left + window.scrollX;
                            const y = bounds.top + window.scrollY;
                            const selected = (x + bounds.width >= minX && x <= maxX
                                && y + bounds.height >= minY && y <= maxY);
                            if (!selected !== !selectedIdsRef.current[id]) {
                                selectedIds[id] = selected;
                                selectedIdsRef.current[id] = selected;
                            }
                        }
                    }
                    if (Object.keys(selectedIds).length) {
                        setSelectedIds(selectedIds);
                    }
                }
                return prev;
            });
        }, 100)
    ), [overlap, setSelectedIds, selectableChildren]);

    const onMouseDown = useCallback((evt: MouseEvent) => {
        if (evt.currentTarget === divRef.current) {
            setRubberBand({left: evt.clientX, top: evt.clientY, width: 0, height: 0, show: true});
        }
    }, []);

    const onMouseMove = useCallback((evt: MouseEvent) => {
        if (rubberBand.show) {
            setRubberBand((rubberBand) => ({
                ...rubberBand,
                width: evt.clientX - rubberBand.left,
                height: evt.clientY - rubberBand.top
            }));
            updateSelectedIds();
        }
    }, [rubberBand, updateSelectedIds]);

    const onMouseUp = useCallback(() => {
        if (rubberBand.show) {
            updateSelectedIds();
            setRubberBand((prev) => ({...prev, show: false}));
            setStartTimeout(undefined);
        }
    }, [rubberBand, updateSelectedIds]);

    const onTouchStart = useCallback((evt: ReactTouchEvent) => {
        if (evt.currentTarget === divRef.current && evt.touches.length > 0) {
            const {clientX, clientY} = evt.touches[0];
            setRubberBand({left: clientX, top: clientY, width: 0, height: 0, show: false});
            setStartTimeout(window.setTimeout(() => {
                setRubberBand((prev) => (
                    (prev.left === clientX && prev.top === clientY
                        && Math.abs(prev.width) < 10 && Math.abs(prev.height) < 10)
                        ? {...prev, show: true}
                        : prev
                ));
                setStartTimeout(undefined);
            }, 500));
        }
    }, []);

    // Note that because this event handler is manually added/removed, evt is a native TouchEvent, not a React synthetic
    // event wrapping the native event.
    const onTouchMove = useCallback((evt: TouchEvent) => {
        if (evt.touches.length > 0) {
            const {clientX, clientY} = evt.touches[0];
            setRubberBand((prev) => {
                if (prev.show) {
                    evt.preventDefault();
                    updateSelectedIds();
                }
                return {
                    ...prev,
                    width: clientX - prev.left,
                    height: clientY - prev.top
                };
            });
        }
    }, [updateSelectedIds]);
    // We have to manually add the event listener because React event registration can't nominate passive true/false.
    useEffect(() => {
        const current = divRef.current;
        current?.addEventListener('touchmove', onTouchMove, {passive: false});
        return () => {
            current?.removeEventListener('touchmove', onTouchMove);
        }
    }, [onTouchMove]);

    const onTouchEnd = useCallback((evt: ReactTouchEvent) => {
        if (evt.touches.length === 0) {
            setStartTimeout((prev) => {
                if (prev) {
                    window.clearTimeout(prev);
                }
                return undefined;
            });
            setRubberBand((prev) => {
                if (prev.show) {
                    updateSelectedIds();
                    return {...prev, show: false};
                }
                return prev;
            });
        }
    }, [updateSelectedIds]);

    return (
        <div className='rubberBandGroup'
             onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
             onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
             ref={divRef}
        >
            <SelectableGroupContext.Provider value={selectableChildren}>
                {children}
            </SelectableGroupContext.Provider>
            {
                !rubberBand.show ? null : (
                    <RubberBand {...rubberBand} />
                )
            }
        </div>
    );
}

export default RubberBandGroup;