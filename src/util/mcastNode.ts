import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';

import {promiseSleep} from './promiseSleep';
import {CommsNode, CommsNodeCallbacks, SendToOptions} from './commsNode';

export enum McastMessageType {
    connect = 'connect',
    otherPeers = 'otherPeers',
    data = 'data',
    close = 'close'
}

interface McastMessage {
    peerId: string;
    type: McastMessageType;
    recipientIds?: string[];
    payload?: any;
}

/**
 * A node in a multicast network.  Uses httprelay.io to do the multicasting.
 */
export class McastNode extends CommsNode {

    static MCAST_URL = 'https://httprelay.io/mcast/';

    public peerId: string;

    private signalChannelId: string;
    private readonly onEvents: CommsNodeCallbacks;
    private connectedPeers: {[key: string]: boolean};
    private readonly memoizedThrottle: (key: string, func: Function) => Function;
    private seqId: number | null = null;
    private shutdown: boolean = false;

    /**
     * @param signalChannelId The unique string used to identify the multi-cast channel on httprelay.io.  All McastNodes
     * with the same signalChannelId will signal each other and connect.
     * @param onEvents An array of objects with keys event and callback.  Each peer-to-peer connection will invoke the
     * callbacks when they get the corresponding events.  The first two parameters to the callback are this McastNode
     * instance and the peerId of the connection, and the subsequent parameters vary for different events.
     * @param throttleWait The number of milliseconds to throttle messages with the same throttleKey (see sendTo).
     */
    constructor(signalChannelId: string, onEvents: CommsNodeCallbacks, throttleWait: number = 250) {
        super();
        this.signalChannelId = signalChannelId;
        this.onEvents = onEvents;
        this.connectedPeers = {};
        this.peerId = v4();
        console.log('Created multi-cast node', this.peerId);
        // Create a memoized throttle function wrapper.  Calls with the same (truthy) throttleKey will be throttled so
        // the function is called at most once each throttleWait milliseconds.  This is used to wrap the send function,
        // so things like dragging minis doesn't flood the connection - since each position update supersedes the
        // previous one, we don't need to send every intermediate value.
        this.memoizedThrottle = memoize((throttleKey, func) => (throttle(func, throttleWait)));
        this.sendToRaw = this.sendToRaw.bind(this);
        // Constructor cannot be async, but launch a promise anyway.
        this.sendConnectMessage()
            .then(() => (this.listen()));
    }

    getFromMcastServer(): Promise<McastMessage> {
        return fetch(`${McastNode.MCAST_URL}${this.signalChannelId}${this.seqId !== null ? `?SeqId=${this.seqId}` : ''}`, {
                cache: 'no-store'
            })
            .then((response) => {
                if (response.ok) {
                    this.seqId = Number(response.headers.get('httprelay-seqid')) + 1;
                    return response.json();
                } else {
                    throw new Error('invalid response on GET from mcast server: ' + response.statusText);
                }
            });
    }

    postToMcastServer(body: McastMessage): Promise<void> {
        return fetch(`${McastNode.MCAST_URL}${this.signalChannelId}`, {
            method: 'POST',
            body: JSON.stringify(body)
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('invalid response on POST to mcast server: ' + response.statusText);
                }
            });
    }

    sendConnectMessage() {
        return this.postToMcastServer({type: McastMessageType.connect, peerId: this.peerId});
    }

    /**
     * Listens for messages from the mcast server, httprelay.io.  The messages are JSON McastMessage objects.
     *
     * @return {Promise} A promise which continues to listen for future signalling messages.
     */
    listen(): Promise<any> {
        return this.getFromMcastServer()
            .then((message) => {
                if (this.shutdown || message.peerId === this.peerId || !message.type
                        || (message.recipientIds !== undefined && message.recipientIds!.indexOf(this.peerId) < 0)) {
                    return message;
                } else {
                    // A message I'm interested in.
                    return this.onEvent(message.type, message.peerId, message.payload)
                        .then(() => (message));
                }
            })
            .then((message) => {
                const unknown = (message.peerId !== this.peerId && !this.connectedPeers[message.peerId]);
                // If the message is from a peerId we don't know, send another "connect" message
                return unknown ? this.sendConnectMessage() : undefined;
            })
            .catch((err) => {
                console.error(err);
                return promiseSleep(5000);
            })
            .then(() => {
                return this.shutdown ? undefined : this.listen();
            });
    }

    async onEvent(type: McastMessageType, senderId: string, payload: any): Promise<void> {
        // Do in-built actions first.
        switch (type) {
            case McastMessageType.connect:
                if (!this.connectedPeers[senderId]) {
                    // New connection - tell them the already connected peers.
                    await this.postToMcastServer({
                        type: McastMessageType.otherPeers,
                        recipientIds: [senderId],
                        peerId: this.peerId,
                        payload: [this.peerId, ...Object.keys(this.connectedPeers)]
                    });
                    this.connectedPeers[senderId] = true;
                }
                break;
            case McastMessageType.otherPeers:
                const connectedPeers = payload as string[];
                for (let peerId of connectedPeers) {
                    if (peerId !== this.peerId && !this.connectedPeers[peerId]) {
                        this.connectedPeers[peerId] = true;
                        await this.doCustomEvents(McastMessageType.connect, peerId, null);
                    }
                }
                break;
            case McastMessageType.close:
                this.onClose(senderId);
                break;
            default:
                break;
        }
        await this.doCustomEvents(type, senderId, payload);
    }

    async doCustomEvents(type: McastMessageType, senderId: string, payload: any): Promise<void> {
        // Perform any custom user actions for the given message type
        if (this.onEvents[type]) {
            await this.onEvents[type](this, senderId, payload);
        }
    }

    onClose(peerId: string) {
        console.log('Lost connection with', peerId);
        delete(this.connectedPeers[peerId]);
    }

    private async sendToRaw(message: string | object, recipientIds: string[], onSentMessage?: (recipients: string[], message: string | object) => void): Promise<void> {
        // JSON has no "undefined" value, so if JSON-stringifying, convert undefined values to null.
        const payload: string = (typeof(message) === 'object') ?
            JSON.stringify(message, (k, v) => (v === undefined ? null : v)) : message;
        await this.postToMcastServer({
            type: McastMessageType.data,
            recipientIds,
            peerId: this.peerId,
            payload
        });
        onSentMessage && onSentMessage(recipientIds, message);
    }

    /**
     * Send a message to peers on the network.
     *
     * @param message The message to send.  If it is an object, it will be JSON.stringified.
     * @param only (optional) Array of peerIds to receive the message.  If omitted, sends the message to all connected
     * peers (except any listed in except)
     * @param except (optional) Array of peerIds who should not receive the message.
     * @param throttleKey (optional) If specified, messages with the same throttleKey are throttled so only one message
     * is actually sent every throttleWait milliseconds - calling sendTo more frequently than that will discard
     * messages.  The last message is always delivered.  Only use this for sending messages which supersede previous
     * messages with the same throttleKey value, such as updating an object's position using absolute coordinates.
     * @param onSentMessage (optional) Function that will be called after messages have been sent, with the list of
     * peerId recipients provided as the parameter.
     */
    async sendTo(message: string | object, {only, except, throttleKey, onSentMessage}: SendToOptions = {}): Promise<void> {
        const recipients = (only || Object.keys(this.connectedPeers))
            .filter((peerId) => (!except || except.indexOf(peerId) < 0));
        if (recipients && recipients.length === 0) {
            // No recipients - send nothing, but still trigger onSentMessage if provided.
            onSentMessage && onSentMessage(recipients, message);
            return;
        }
        if (throttleKey) {
            await this.memoizedThrottle(throttleKey, this.sendToRaw)(message, recipients, onSentMessage);
        } else {
            await this.sendToRaw(message, recipients, onSentMessage);
        }
    }

    async disconnectAll(): Promise<void> {
        await this.postToMcastServer({
            type: McastMessageType.close,
            peerId: this.peerId
        });
        for (let peerId of Object.keys(this.connectedPeers)) {
            await this.doCustomEvents(McastMessageType.close, peerId, null);
        }
        this.connectedPeers = {};
    }

    async destroy() {
        console.log('Shutting down multicast node', this.peerId);
        this.shutdown = true;
        await this.disconnectAll();
    }
}
