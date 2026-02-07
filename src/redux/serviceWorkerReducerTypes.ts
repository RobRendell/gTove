export enum ServiceWorkerReducerActionTypes {
    SERVICE_WORKER_SET_UPDATE = 'service-worker-set-update'
}

export interface ServiceWorkerSetUpdateActionType {
    type: ServiceWorkerReducerActionTypes.SERVICE_WORKER_SET_UPDATE;
    update: boolean;
}

export type ServiceWorkerReducerActions = ServiceWorkerSetUpdateActionType;

export interface ServiceWorkerReducerType {
    update?: boolean;
}