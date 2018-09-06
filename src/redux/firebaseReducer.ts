import {Action, Reducer} from 'redux';

// =========================== Action types and generators

enum FirebaseSettingActionTypes {
    UPDATE_FIREBASE_SETTING = 'change-firebase-setting'
}

interface FirebaseSettings {
    enabled: boolean | null;
}

interface UpdateFirebaseSettingActionType extends Action {
    type: FirebaseSettingActionTypes.UPDATE_FIREBASE_SETTING;
    settings: Partial<FirebaseSettings>;
}

export type FirebaseSettingReducerType = Partial<FirebaseSettings>;

export function updateFirebaseSettingAction(settings: FirebaseSettingReducerType): UpdateFirebaseSettingActionType {
    return {type: FirebaseSettingActionTypes.UPDATE_FIREBASE_SETTING, settings};
}

// =========================== Reducer

const initState = {
    enabled: false
};

const firebaseReducer: Reducer<FirebaseSettingReducerType> = (state = initState, action: UpdateFirebaseSettingActionType) => {
    switch (action.type) {
        case FirebaseSettingActionTypes.UPDATE_FIREBASE_SETTING:
            return action.settings;
        default:
            return state;
    }
};

export default firebaseReducer;