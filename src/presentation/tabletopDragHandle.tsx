import './tabletopDragHandle.scss';

import classNames from 'classnames';
import {FunctionComponent, useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getTabletopStateFromStore} from '../redux/mainReducer';
import Tooltip from './tooltip';

interface TabletopDragHandleProps {
    className?: string;
}

const TabletopDragHandle: FunctionComponent<TabletopDragHandleProps> = ({className}) => {
    const {dragMode} = useSelector(getTabletopStateFromStore);

    const dragHandleTooltip = useMemo(() => (
        (dragMode === 'fogOfWarMode') ? 'Use this handle to pan the camera without leaving Fog of War mode.'
            : (dragMode === 'measureDistanceMode') ? 'Use this handle to pan the camera while measuring distances.'
                : (dragMode === 'elasticBandMode') ? 'Use this handle to pan the camera while in elastic band mode.'
                    : (dragMode === 'paintMode') ? 'Use this handle to pan the camera without leaving paint mode.'
                        : (dragMode === 'repositionMapMode') ? 'Use this handle to pan the camera while repositioning the map.'
                            : undefined
    ), [dragMode]);

    return (
        (!dragHandleTooltip) ? null : (
            <div className={classNames('tabletopDragHandle', className)}>
                <Tooltip tooltip={dragHandleTooltip}>
                    <div className='material-icons'>pan_tool</div>
                </Tooltip>
            </div>
        )
    )
};

export default TabletopDragHandle;