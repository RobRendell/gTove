import {AnyAction} from 'redux';

export interface SendToOptions {
    throttleKey?: string;
    onSentMessage?: (recipients: string[], message: string | object) => void;
}

export interface CommsNodeCallbacks {
    shouldConnect?: (commsNode: CommsNode, peerId: string, userId?: string) => boolean;
    connect?: (commsNode: CommsNode, peerId: string) => Promise<void>;
    data?: (commsNode: CommsNode, peerId: string, data: string) => Promise<void>;
    close?: (commsNode: CommsNode, peerId: string) => Promise<void>;
    error?: (commsNode: CommsNode, peerId: string, error: string) => Promise<void>;
}

export interface CommsNodeOptions {
    onEvents?: CommsNodeCallbacks;
    throttleWait?: number;
    shouldDispatchLocally?: (action: AnyAction, state: any, commsNode: CommsNode | null) => boolean;
}

export abstract class CommsNode {

    static HEARTBEAT_INTERVAL_MS = 30 * 1000;

    public peerId: string;
    public userId: string;
    public shutdown: boolean = false;
    public options: CommsNodeOptions;

    abstract init(): Promise<void>;

    abstract sendTo(message: string | object, sendToOptions?: SendToOptions): Promise<void>;

    abstract disconnectAll(): Promise<void>;

    abstract destroy(): Promise<void>;

    abstract close(peerId: string, reason?: string): Promise<void>;

    abstract isPeerIdValid(peerId: string): Promise<boolean>;
}