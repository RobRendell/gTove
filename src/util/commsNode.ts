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

export type CommsNodeCallback = (commsNode: CommsNode, peerId: string, ...args: any[]) => void;

export type CommsNodeEvent = {event: string, callback: CommsNodeCallback};

export interface CommsNodeOptions {
    onEvents?: CommsNodeEvent[];
    throttleWait?: number;
}

export abstract class CommsNode {
    abstract peerId: string;

    abstract async sendTo(message: string | object, sendToOptions?: SendToOptions): Promise<void>;

    abstract async disconnectAll(): Promise<void>;

    abstract async destroy(): Promise<void>;
}