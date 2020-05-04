import {AnyAction} from 'redux';

// =========================== Action types and generators

export enum ServiceWorkerReducerActionTypes {
    SERVICE_WORKER_SET_UPDATE = 'service-worker-set-update'
}

export interface ServiceWorkerSetUpdateActionType {
    type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE;
    registration?: ServiceWorkerRegistration;
}

export function serviceWorkerSetUpdateAction(registration?: ServiceWorkerRegistration): ServiceWorkerSetUpdateActionType {
    return {type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE, registration};
}

// =========================== Reducers

export interface ServiceWorkerReducerType {
    update?: ServiceWorkerRegistration;
}

export default function serviceWorkerReducer(state: ServiceWorkerReducerType = {}, action: AnyAction) {
    switch (action.type) {
        case ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE:
            return {
                ...state,
                update: action.registration
            };
        default:
            return state;
    }
}