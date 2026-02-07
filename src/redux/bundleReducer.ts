import {AnyAction, Reducer} from 'redux';

import {BundleActionTypes, BundleReducerType, SetBundleIdActionType} from './bundleReducerTypes';

// =========================== Action generators

export function setBundleIdAction(bundleId: BundleReducerType): SetBundleIdActionType {
    return {type: BundleActionTypes.SET_BUNDLE_ID, bundleId};
}

// =========================== Reducers

const bundleReducer: Reducer<BundleReducerType> = (state = null, action: SetBundleIdActionType | AnyAction) => {
    switch (action.type) {
        case BundleActionTypes.SET_BUNDLE_ID:
            return action.bundleId;
        default:
            return state;
    }
};

export default bundleReducer;
