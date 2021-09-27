import {Action} from 'redux';
import {PayloadAction} from '@reduxjs/toolkit';

import {ReduxStoreType} from '../redux/mainReducer';

export interface SizedEvent {
    target: {
        width: number;
        height: number;
    }
}

export function isSizedEvent(e: any): e is SizedEvent {
    return (e && e.target && e.target.width !== undefined && e.target.height !== undefined);
}

export type GToveThunk<A extends Action> = (dispatch: (action: A) => A, getState: () => ReduxStoreType) => void


export interface ScenarioAction extends NetworkedAction {
    actionId: string;
    headActionIds: string[];
    peerKey: string;
    gmOnly: boolean;
    playersOnly?: boolean;
}

export function isScenarioAction(action: any): action is ScenarioAction {
    return (action && action.actionId && action.headActionIds);
}

export interface NetworkedMeta {
    // These fields are set by the network infrastructure on actions which are sent to us over the net.
    fromPeerId?: string; // PeerId which sent this message
    fromGM?: boolean; // Whether fromPeerId matches the tabletop's GM
    originPeerId?: string; // PeerId of the client which originally sent the message
}

export interface NetworkedAction extends Action, NetworkedMeta {
}

export type NetworkedPayloadAction<T> = PayloadAction<T, string, NetworkedMeta & {peerKey: string}>;