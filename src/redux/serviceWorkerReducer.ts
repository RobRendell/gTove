// =========================== Action types and generators

export enum ServiceWorkerReducerActionTypes {
    SERVICE_WORKER_SET_UPDATE = 'service-worker-set-update'
}

export interface ServiceWorkerSetUpdateActionType {
    type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE;
    update: boolean;
}

export function serviceWorkerSetUpdateAction(update: boolean): ServiceWorkerSetUpdateActionType {
    return {type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE, update};
}

type ServiceWorkerReducerActions = ServiceWorkerSetUpdateActionType;

// =========================== Reducers

export interface ServiceWorkerReducerType {
    update?: boolean;
}

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