import {Fragment, FunctionComponent, PropsWithChildren, useContext} from 'react';

import {MovableWindowContextObject} from '../presentation/movableWindow';

const MovableWindowRemountChild: FunctionComponent<PropsWithChildren> = ({children}) => {
    const movableWindow = useContext(MovableWindowContextObject);

    return (
        <Fragment key={movableWindow ? 'inPoppedOutWindow' : 'inApp'}>
            {children}
        </Fragment>
    );
}

export default MovableWindowRemountChild;