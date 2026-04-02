import {FunctionComponent, PropsWithChildren, useCallback} from 'react';
import FullScreen from 'react-full-screen';
import {useDispatch, useSelector} from 'react-redux';

import {getTabletopStateFromStore} from '../redux/mainReducer';
import {setTabletopStateFullScreenAction} from '../redux/tabletopStateReducer';

const FullScreenContainer: FunctionComponent<PropsWithChildren> = ({children}) => {
    const dispatch = useDispatch();
    const {fullScreen} = useSelector(getTabletopStateFromStore);

    const setFullScreen = useCallback((fullScreen: boolean) => {
        dispatch(setTabletopStateFullScreenAction(fullScreen));
    }, [dispatch]);

    return (
        <FullScreen enabled={fullScreen} onChange={setFullScreen}>
            {children}
        </FullScreen>
    )
};

export default FullScreenContainer;