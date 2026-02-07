export type ObjectMapReducerType<S extends {}> = {[key: string]: S};

export interface ObjectMapReducerOptions {
    field?: string;
    deleteActionType?: string;
    reduceDeleteActionOnAll?: boolean;
}