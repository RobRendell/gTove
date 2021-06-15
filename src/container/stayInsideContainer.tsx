import {FunctionComponent} from 'react';
import {useResizeDetector} from 'react-resize-detector';

interface StayInsideContainerProps {
    top: number;
    left: number;
    className: string;
}

const StayInsideContainer: FunctionComponent<StayInsideContainerProps> = ({top, left, className, children}) => {

    const {width, height, ref} = useResizeDetector({handleWidth: true, handleHeight: true});
    const {width: innerWidth, height: innerHeight, ref: innerRef} = useResizeDetector({handleWidth: true, handleHeight: true});

    const outerTop = (height !== undefined && innerHeight !== undefined && top + innerHeight >= height) ? height - innerHeight - 1 : top;
    const outerLeft = (width !== undefined && innerWidth !== undefined && left + innerWidth >= width) ? width - innerWidth - 1 : left;
    return (
        <div ref={ref} className='fullHeight'>
            <div ref={innerRef} className={className} style={{top: outerTop, left: outerLeft}}>
                {children}
            </div>
        </div>
    );
}

export default StayInsideContainer;