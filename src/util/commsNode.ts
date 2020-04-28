import {AnyAction} from 'redux';

export enum CommsStyle {
    PeerToPeer = 'PeerToPeer',
    MultiCast = 'MultiCast'
}

export interface SendToOptions {
    only?: string[];
    except?: string[];
    throttleKey?: string;
    onSentMessage?: (recipients: string[], message: string | object) => void;
}

export interface CommsNodeCallbacks {
    shouldConnect?: (commsNode: CommsNode, peerId: string, userId?: string) => boolean;
    signal?: (commsNode: CommsNode, peerId: string, offer: any) => Promise<void>;
    signalError?: (commsNode: CommsNode, error: string) => Promise<void>;
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

    abstract async init(): Promise<void>;

    abstract async sendTo(message: string | object, sendToOptions?: SendToOptions): Promise<void>;

    abstract async disconnectAll(): Promise<void>;

    abstract async destroy(): Promise<void>;
}