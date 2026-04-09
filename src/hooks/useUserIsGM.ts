import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getLoggedInUserFromStore, getTabletopFromStore} from '../redux/mainReducer';

export function useUserIsGM() {
    const loggedInUser = useSelector(getLoggedInUserFromStore)!;
    const tabletop = useSelector(getTabletopFromStore);
    return useMemo(() => (
        loggedInUser?.emailAddress === tabletop.gm
    ), [loggedInUser?.emailAddress, tabletop.gm]);
}