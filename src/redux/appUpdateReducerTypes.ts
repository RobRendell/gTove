export interface AppUpdateReducerType {
    error?: any;
    updatePending?: boolean;
    promptUpdate?: boolean;
    forceUpdate?: boolean;
    lastCheckedForUpdate?: number;
}