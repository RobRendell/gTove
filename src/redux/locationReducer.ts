export const CHANGE_TABLETOP_ID = 'change-tabletop-id';

export interface LocationState {
    tabletopId: string;
}

export const routesMap = {
    [CHANGE_TABLETOP_ID]: '/:tabletopId?'
};

export function setTabletopIdAction(tabletopId?: string, tabletopTitle?: string) {
    return {type: CHANGE_TABLETOP_ID, payload: {tabletopId, tabletopTitle}};
}

