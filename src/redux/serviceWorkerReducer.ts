// =========================== Action types and generators

export enum ServiceWorkerReducerActionTypes {
    SERVICE_WORKER_SET_REGISTRATION = 'service-worker-set-registration',
    SERVICE_WORKER_SET_UPDATE = 'service-worker-set-update'
}

export interface ServiceWorkerSetRegistrationActionType {
    type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_REGISTRATION;
    registration: ServiceWorkerRegistration;
}

export function serviceWorkerSetRegistrationAction(registration: ServiceWorkerRegistration): ServiceWorkerSetRegistrationActionType {
    return {type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_REGISTRATION, registration};
}

export interface ServiceWorkerSetUpdateActionType {
    type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE;
    update: boolean;
}

export function serviceWorkerSetUpdateAction(update: boolean): ServiceWorkerSetUpdateActionType {
    return {type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE, update};
}

type ServiceWorkerReducerActions = ServiceWorkerSetRegistrationActionType | ServiceWorkerSetUpdateActionType;

// =========================== Reducers

export interface ServiceWorkerReducerType {
    registration?: ServiceWorkerRegistration;
    update?: boolean;
}

export default function serviceWorkerReducer(state: ServiceWorkerReducerType = {}, action: ServiceWorkerReducerActions) {
    switch (action.type) {
        case ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_REGISTRATION:
            return {
                ...state,
                registration: action.registration
            };
        case ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE:
            return {
                ...state,
                update: action.update
            };
        default:
            return state;
    }
}