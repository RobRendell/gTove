import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';

import {promiseSleep} from './promiseSleep';
import {CommsNode, CommsNodeCallbacks, CommsNodeOptions, SendToOptions} from './commsNode';

export enum McastMessageType {
    connect = 'connect',
    otherPeers = 'otherPeers',
    data = 'data',
    close = 'close'
}

interface McastMessage {
    peerId: string;
    userId: string;
    type: McastMessageType;
    recipientIds?: string[];
    payload?: any;
}

interface McastConnection {
    timestamp: number;
    userId: string;
}

/**
 * A node in a multicast network.  Uses gtove-relay-server to do the multicasting.
 */
export class McastNode extends CommsNode {

    static MCAST_URL = 'https://radiant-thicket-18054.herokuapp.com/mcast/';

    private signalChannelId: string;
    private readonly onEvents: CommsNodeCallbacks;
    private connectedPeers: {[key: string]: McastConnection};
    private ignoredPeers: {[key: string]: boolean};
    private readonly memoizedThrottle: (key: string, func: (...args: any[]) => any) => (...args: any[]) => any;
    private sequenceId: number | null = null;
    private requestOffersInterval: number;

    /**
     * @param signalChannelId The unique string used to identify the multi-cast channel on gtove-relay-server.  All
     * McastNodes with the same signalChannelId will signal each other and connect.
     * @param userId A string uniquely identifying the owner of this node.  A single user can own multiple nodes across
     * the network.
     * @param commsNodeOptions The options this node is initialised with
     */
    constructor(signalChannelId: string, userId: string, commsNodeOptions: CommsNodeOptions) {
        super();
        this.signalChannelId = signalChannelId;
        this.options = commsNodeOptions;
        this.onEvents = commsNodeOptions.onEvents || {};
        this.connectedPeers = {};
        this.peerId = v4();
        this.ignoredPeers = {[this.peerId]: true};
        this.userId = userId;
        const throttleWait = commsNodeOptions.throttleWait || 250;
        console.log(`Created multi-cast node for user ${this.userId} with id ${this.peerId}`);
        // Create a memoized throttle function wrapper.  Calls with the same (truthy) throttleKey will be throttled so
        // the function is called at most once each throttleWait milliseconds.  This is used to wrap the send function,
        // so things like dragging minis doesn't flood the connection - since each position update supersedes the
        // previous one, we don't need to send every intermediate value.
        this.memoizedThrottle = memoize((throttleKey, func) => (throttle(func, throttleWait)));
        this.sendToRaw = this.sendToRaw.bind(this);
    }

    async init() {
        const listenPromise = this.listen();
        await this.sendConnectMessage();
        this.startHeartbeat();
        return listenPromise;
    }

    startHeartbeat() {
        if (!this.requestOffersInterval) {
            this.requestOffersInterval =
                window.setInterval(this.heartbeat.bind(this), CommsNode.HEARTBEAT_INTERVAL_MS);
        }
    }

    async heartbeat() {
        // Periodically send connect message, which also lets connected peers know I'm still active.
        await this.sendConnectMessage();
        // Check if any peers have failed to signal for a while.
        const timeout = Date.now() - 2 * CommsNode.HEARTBEAT_INTERVAL_MS;
        for (let peerId of Object.keys(this.connectedPeers)) {
            if (this.connectedPeers[peerId].timestamp < timeout) {
                // peer is idle - time it out.
                console.warn(`Peer ${peerId} sent last message ${(Date.now() - this.connectedPeers[peerId].timestamp)/1000} seconds ago - destroying it.`);
                this.destroyPeer(peerId);
            }
        }
    }

    async getFromMcastServer(): Promise<McastMessage> {
        const response = await fetch(`${McastNode.MCAST_URL}${this.signalChannelId}${this.sequenceId !== null ? `?sequenceId=${this.sequenceId}` : ''}`, {
            cache: 'no-store'
        });
        if (response.ok) {
            this.sequenceId = Number(response.headers.get('x-relay-sequenceId'));
            return response.json();
        } else {
            throw new Error('invalid response on GET from mcast server: ' + response.statusText);
        }
    }

    async postToMcastServer(body: McastMessage): Promise<void> {
        const response = await fetch(`${McastNode.MCAST_URL}${this.signalChannelId}`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error('invalid response on POST to mcast server: ' + response.statusText);
        }
    }

    async sendConnectMessage() {
        await this.postToMcastServer({type: McastMessageType.connect, peerId: this.peerId, userId: this.userId});
    }

    /**
     * Listens for messages from the mcast server, gtove-relay-server.  The messages are JSON McastMessage objects.
     *
     * @return {Promise} A promise which continues to listen for future signalling messages.
     */
    async listen(): Promise<void> {
        while (!this.shutdown) {
            try {
                const message = await this.getFromMcastServer();
                if (this.shutdown || !message.type || this.ignoredPeers[message.peerId]) {
                    // Ignore message if shut down, or without a type (caused by a timeout), or from an ignored peer
                    continue;
                }
                if (message.recipientIds === undefined || message.recipientIds!.indexOf(this.peerId) >= 0) {
                    // A message I'm potentially interested in.
                    await this.onEvent(message.type, message.peerId, message.userId, message.payload);
                }
                if (!this.ignoredPeers[message.peerId] && !this.connectedPeers[message.peerId]) {
                    // If the message is from a peerId we don't know, send another "connect" message
                    await this.sendConnectMessage();
                }
                if (this.connectedPeers[message.peerId]) {
                    // Update timestamp, so they aren't timed out.
                    this.connectedPeers[message.peerId].timestamp = Date.now();
                }
            } catch (err) {
                console.error(err);
                await promiseSleep(5000);
            }
        }
    }

    handleNewConnection(peerId: string, userId: string) {
        if (!this.ignoredPeers[peerId] && !this.connectedPeers[peerId]) {
            if (this.onEvents.shouldConnect && !this.onEvents.shouldConnect(this, peerId, userId)) {
                this.ignoredPeers[peerId] = true;
            } else {
                console.log('Established connection with', peerId);
                this.connectedPeers[peerId] = {
                    timestamp: Date.now(),
                    userId
                };
                return true;
            }
        }
        return false;
    }

    async onEvent(type: McastMessageType, senderId: string, userId: string, payload: any): Promise<void> {
        // Do in-built actions first.
        switch (type) {
            case McastMessageType.connect:
                if (this.handleNewConnection(senderId, userId)) {
                    // New connection - tell them the already connected peers.
                    await this.postToMcastServer({
                        type: McastMessageType.otherPeers,
                        recipientIds: [senderId],
                        peerId: this.peerId,
                        userId: this.userId,
                        payload: Object.keys(this.connectedPeers)
                            .map((peerId) => ({peerId, userId: this.connectedPeers[peerId].userId}))
                            .concat({peerId: this.peerId, userId: this.userId})
                    });
                } else {
                    return;
                }
                break;
            case McastMessageType.otherPeers:
                const connectedPeers = payload as {peerId: string, userId: string}[];
                for (let peer of connectedPeers) {
                    if (this.handleNewConnection(peer.peerId, peer.userId)) {
                        await this.doCustomEvents(McastMessageType.connect, peer.peerId, null);
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
        if (this.connectedPeers[peerId]) {
            console.log('Lost connection with', peerId);
            delete(this.connectedPeers[peerId]);
        }
        delete(this.ignoredPeers[peerId]);
    }

    async destroyPeer(peerId: string) {
        this.onClose(peerId);
        await this.doCustomEvents(McastMessageType.close, peerId, null);
    }

    private async sendToRaw(message: string | object, recipientIds: string[], onSentMessage?: (recipients: string[], message: string | object) => void): Promise<void> {
        // JSON has no "undefined" value, so if JSON-stringifying, convert undefined values to null.
        const payload: string = (typeof(message) === 'object') ?
            JSON.stringify(message, (k, v) => (v === undefined ? null : v)) : message;
        await this.postToMcastServer({
            type: McastMessageType.data,
            recipientIds,
            peerId: this.peerId,
            userId: this.userId,
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
            peerId: this.peerId,
            userId: this.userId
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
