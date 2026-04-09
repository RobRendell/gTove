import {splitFileName} from '../util/storage/storageUtils';

export const CHANGE_TABLETOP_ID = 'change-tabletop-id';

export const routesMap = {
    [CHANGE_TABLETOP_ID]: '/:tabletopId?/:resourceKey?'
};

export function setTabletopIdAction(tabletopId?: string, tabletopTitle?: string, resourceKey?: string) {
    return {type: CHANGE_TABLETOP_ID, payload: {
        tabletopId, tabletopTitle: !tabletopTitle ? undefined : splitFileName(tabletopTitle).name, resourceKey
    }};
}

