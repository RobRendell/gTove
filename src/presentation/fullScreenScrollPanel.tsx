import './fullScreenScrollPanel.scss';

import {FunctionComponent, ReactElement} from 'react';

interface FullScreenScrollPanelProps {
    before?: ReactElement;
    after?: ReactElement;
}

const FullScreenScrollPanel: FunctionComponent<FullScreenScrollPanelProps> = ({before, children, after}) => {
    return (
        <div className='fullScreenScrollPanelComponent'>
            {!before ? null : (<div className='before'>{before}</div>)}
            <div className='children'>{children}</div>
            {!after ? null : (<div className='after'>{after}</div>)}
        </div>
    )
};

export default FullScreenScrollPanel;