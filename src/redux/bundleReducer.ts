import {Action, Reducer} from 'redux';

// =========================== Action types and generators

enum BundleActionTypes {
    SET_BUNDLE_ID = 'set-bundle-id'
}

export type BundleReducerType = string | null;

interface SetBundleIdActionType extends Action {
    type: BundleActionTypes.SET_BUNDLE_ID;
    bundleId: BundleReducerType;
}

export function setBundleIdAction(bundleId: BundleReducerType): SetBundleIdActionType {
    return {type: BundleActionTypes.SET_BUNDLE_ID, bundleId};
}

// =========================== Reducers

const bundleReducer: Reducer<BundleReducerType> = (state = null, action: SetBundleIdActionType) => {
    switch (action.type) {
        case BundleActionTypes.SET_BUNDLE_ID:
            return action.bundleId;
        default:
            return state;
    }
};

export default bundleReducer;
