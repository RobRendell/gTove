import './tooltip.scss';

import RCTooltip from 'rc-tooltip';
import {FunctionComponent, PropsWithChildren, useMemo} from 'react';

interface TooltipProps extends PropsWithChildren {
    tooltip?: string | React.ReactElement;
    maxWidth?: number | string;
    verticalSpace?: number;
    className?: string;
    disabled?: boolean;
}

const Tooltip: FunctionComponent<TooltipProps> = ({tooltip, className, disabled, children}) => {
    const disabledObj = useMemo(() => (
        (disabled || !tooltip) ? {visible: false} : undefined
    ), [disabled, tooltip]);

    return (
        <RCTooltip overlay={<div className='tooltip-body'>{tooltip}</div>}
                   mouseEnterDelay={0.8}
                   showArrow={false}
                   {...disabledObj}
        >
            <span className={className}>{children}</span>
        </RCTooltip>
    );
};

export default Tooltip;