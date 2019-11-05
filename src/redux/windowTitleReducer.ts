import {AnyAction} from 'redux';

import {CHANGE_TABLETOP_ID} from './locationReducer';

export type WindowTitleReducerType = string;

export const WINDOW_TITLE_DEFAULT = 'gTove';

export default function windowTitleReducer(state = WINDOW_TITLE_DEFAULT, action: AnyAction) {
    switch (action.type) {
        case CHANGE_TABLETOP_ID:
            return action.payload.tabletopTitle ? action.payload.tabletopTitle + ' - gTove' : WINDOW_TITLE_DEFAULT;
        default:
            return state;
    }
}