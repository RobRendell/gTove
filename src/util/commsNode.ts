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
}

export abstract class CommsNode {
    abstract peerId: string;

    abstract async init(): Promise<void>;

    abstract async sendTo(message: string | object, sendToOptions?: SendToOptions): Promise<void>;

    abstract async disconnectAll(): Promise<void>;

    abstract async destroy(): Promise<void>;
}