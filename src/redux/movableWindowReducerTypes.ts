export interface MovableWindowReducerType {
    window: {
        [windowName: string]: {
            x: number;
            y: number;
            width?: number;
            height?: number;
        }
    };
}

export enum MovableWindowReducerActions {
    SET_MOVABLE_WINDOW_POSITION = 'set-movable-window-position',
    SET_MOVABLE_WINDOW_SIZE = 'set-movable-window-size'
}

export interface SetMovableWindowPositionActionType {
    type: MovableWindowReducerActions.SET_MOVABLE_WINDOW_POSITION;
    windowName: string;
    x: number;
    y: number;
}

export interface SetMovableWindowSizeActionType {
    type: MovableWindowReducerActions.SET_MOVABLE_WINDOW_SIZE,
    windowName: string;
    width: number;
    height: number;
}