

// =========================== Action types and generators

import {AnyAction} from 'redux';

export interface MovableWindowReducerType {
    window: {
        [windowName: string]: {
            x: number;
            y: number;
        }
    };
}

enum MovableWindowReducerActions {
    SET_MOVABLE_WINDOW_POSITION = 'set-movable-window-position'
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

// =========================== Reducers

export function movableWindowReducer(state: MovableWindowReducerType | undefined = {window: {}}, action: AnyAction): MovableWindowReducerType {
    switch (action.type) {
        case MovableWindowReducerActions.SET_MOVABLE_WINDOW_POSITION:
            return {
                ...state,
                window: {
                    ...state.window,
                    [action.windowName]: {x: action.x, y: action.y}
                }
            };
        default:
            return state;
    }
}
