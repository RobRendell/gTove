import {
    ServiceWorkerReducerActions,
    ServiceWorkerReducerActionTypes,
    ServiceWorkerReducerType,
    ServiceWorkerSetUpdateActionType
} from './serviceWorkerReducerTypes';

// =========================== Action generators

export function serviceWorkerSetUpdateAction(update: boolean): ServiceWorkerSetUpdateActionType {
    return {type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE, update};
}

// =========================== Reducers

export default function serviceWorkerReducer(state: ServiceWorkerReducerType = {}, action: ServiceWorkerReducerActions) {
    switch (action.type) {
        case ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE:
            return {
                ...state,
                update: action.update
            };
        default:
            return state;
    }
}