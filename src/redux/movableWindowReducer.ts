

// =========================== Action types and generators

import {AnyAction} from 'redux';

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

enum MovableWindowReducerActions {
    SET_MOVABLE_WINDOW_POSITION = 'set-movable-window-position',
    SET_MOVABLE_WINDOW_SIZE = 'set-movable-window-size'
}

interface SetMovableWindowPositionActionType {
    type: MovableWindowReducerActions.SET_MOVABLE_WINDOW_POSITION;
    windowName: string;
    x: number;
    y: number;
}

export function setMovableWindowPositionAction(windowName: string, x: number, y: number): SetMovableWindowPositionActionType {
    return {type: MovableWindowReducerActions.SET_MOVABLE_WINDOW_POSITION, windowName, x, y};
}

interface SetMovableWindowSizeActionType {
    type: MovableWindowReducerActions.SET_MOVABLE_WINDOW_SIZE,
    windowName: string;
    width: number;
    height: number;
}

export function setMovableWindowSizeAction(windowName: string, width: number, height: number): SetMovableWindowSizeActionType {
    return {type: MovableWindowReducerActions.SET_MOVABLE_WINDOW_SIZE, windowName, width, height};
}

// =========================== Reducers

export function movableWindowReducer(state: MovableWindowReducerType | undefined = {window: {}}, action: AnyAction): MovableWindowReducerType {
    switch (action.type) {
        case MovableWindowReducerActions.SET_MOVABLE_WINDOW_POSITION:
            return {
                ...state,
                window: {
                    ...state.window,
                    [action.windowName]: {
                        ...state.window[action.windowName],
                        x: action.x, y: action.y
                    }
                }
            };
        case MovableWindowReducerActions.SET_MOVABLE_WINDOW_SIZE:
            return {
                ...state,
                window: {
                    ...state.window,
                    [action.windowName]: {
                        ...state.window[action.windowName],
                        width: action.width, height: action.height
                    }
                }
            };
        default:
            return state;
    }
}
