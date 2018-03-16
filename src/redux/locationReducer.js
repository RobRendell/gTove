const CHANGE_TABLETOP_ID = 'change-tabletop-id';

export const routesMap = {
    [CHANGE_TABLETOP_ID]: '/:tabletopId?'
};

export function setTabletopIdAction(tabletopId) {
    return {type: CHANGE_TABLETOP_ID, payload: {tabletopId}};
}

export function getTabletopIdFromStore(store) {
    return store.location.payload.tabletopId;
}