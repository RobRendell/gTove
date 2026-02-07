import {Action} from 'redux';

export enum BundleActionTypes {
    SET_BUNDLE_ID = 'set-bundle-id'
}

export type BundleReducerType = string | null;

export interface SetBundleIdActionType extends Action {
    type: BundleActionTypes.SET_BUNDLE_ID;
    bundleId: BundleReducerType;
}