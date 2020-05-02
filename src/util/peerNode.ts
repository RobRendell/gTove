import Peer from 'simple-peer';
import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';

import {promiseSleep} from './promiseSleep';
import {CommsNode, CommsNodeCallbacks, CommsNodeOptions, SendToOptions} from './commsNode';
import {closeMessage} from './peerMessageHandler';

interface ConnectedPeer {
    peerId: string;
    peer: Peer.Instance;
    connected: number;
    initiatedByMe: boolean;
    errorCount: number;
    linkReadUrl?: string;
    linkWriteUrl?: string;
    lastSignal: number;
}

export interface SimplePeerOffer {
    sdp: string;
    type: 'offer' | 'answer';
}

interface SignalMessage {
    peerId: string;
    userId: string;
    offer?: SimplePeerOffer;
    recipientId?: string;
}

/**
 * A node in a peer-to-peer network.  Uses gtove-relay-server to do signalling and webRTC (via simple-peer) for the actual
 * communication.  Builds a totally connected network topology - each node in the network has a direct peer-to-peer
 * connection to each other node.
 */
export class PeerNode extends CommsNode {

    static SIGNAL_URL = 'https://radiant-thicket-18054.herokuapp.com/mcast/';
    // Relay messages via gtove-relay-server as a fallback for failed p2p (manually emulate TURN).
    static RELAY_URL = 'https://radiant-thicket-18054.herokuapp.com/link/';

    private requestOffersInterval: number;
    private readonly signalChannelId: string;
    private onEvents: CommsNodeCallbacks;
    private connectedPeers: {[key: string]: ConnectedPeer};
    private ignoredPeers: {[key: string]: boolean};
    private readonly memoizedThrottle: (key: string, func: (...args: any[]) => any) => (...args: any[]) => any;
    private sequenceId: number | null = null;

    /**
     * @param signalChannelId The unique string used to identify the multi-cast channel on gtove-relay-server.  All
     * PeerNodes with the same signalChannelId will signal each other and connect.
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
        this.ignoredPeers = {};
        this.peerId = v4();
        this.userId = userId;
        const throttleWait = commsNodeOptions.throttleWait || 250;
        console.log(`Created peer-to-peer node for user ${this.userId} with id ${this.peerId}`);
        // Create a memoized throttle function wrapper.  Calls with the same (truthy) throttleKey will be throttled so
        // the function is called at most once each throttleWait milliseconds.  This is used to wrap the send function,
        // so things like dragging minis doesn't flood the connection - since each position update supersedes the
        // previous one, we don't need to send every intermediate value.
        this.memoizedThrottle = memoize((throttleKey, func) => (throttle(func, throttleWait)));
        this.sendToRaw = this.sendToRaw.bind(this);
    }

    async init(): Promise<void> {
        // Request offers from anyone already online, then start listening.
        await this.requestOffers();
        this.startHeartbeat();
        await this.listenForSignal();
    }

    private onSignalError(error: boolean) {
        this.onEvents.signalError && this.onEvents.signalError(this, error ? 'Signal error' : '');
    }

    async getFromSignalServer(): Promise<SignalMessage> {
        const response = await fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}${this.sequenceId !== null ? `?sequenceId=${this.sequenceId}` : ''}`, {
                cache: 'no-store'
            });
        if (response.ok) {
            this.onSignalError(false);
            this.sequenceId = Number(response.headers.get('x-relay-sequenceId'));
            return response.json();
        } else {
            this.onSignalError(true);
            throw new Error('invalid response from signal server: ' + JSON.stringify(response));
        }
    }

    async postToSignalServer(body: SignalMessage) {
        let success = true;
        try {
            const response = await fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}`, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            success = response.ok;
        } catch (e) {
            success = false;
        }
        this.onSignalError(!success);
        if (!success) {
            await promiseSleep(5000);
            await this.postToSignalServer(body);
        }
    }

    /**
     * Handles a single signal from the signalling server.
     *
     * Signals are of the form {peerId} or {peerId, offer, recipientId}.  The first form is a broadcast "I'm
     * online, please talk to me" message.  The second form is a handshake between peers.
     * * "peerId" is the id of the sender of the message.
     * * "offer" is a webRTC offer.  If omitted, the peer is signalling us that they want to fall back to a relay.
     * * "recipientId" is the peerId to whom the offer is being made.
     * @param signal
     */
    async handleSignal(signal: SignalMessage) {
        if (this.shutdown || !signal.peerId) {
            // Ignore signals if shut down, or those without a peerId (caused by a timeout).
            return;
        }
        if (signal.peerId !== this.peerId && !this.ignoredPeers[signal.peerId]) {
            // Signal from another peer (we need to check because we also see our own signals come back).
            if (!this.connectedPeers[signal.peerId]) {
                // A node I don't know about is out there.  It might be requesting offers (recipientId undefined),
                // talking with another peer (recipientId !== my peerId) or making an offer specifically to me
                // (recipientId === my peerId).
                if (!this.onEvents.shouldConnect || this.onEvents.shouldConnect(this, signal.peerId, signal.userId)) {
                    // Make an offer to them, initiating the connection unless they've made me an offer.
                    this.addPeer(signal.peerId, signal.recipientId !== this.peerId);
                } else {
                    // We're going to ignore this peer.
                    this.ignoredPeers[signal.peerId] = true;
                }
            }
        }
        if (this.connectedPeers[signal.peerId]) {
            // Update the last signal timestamp for the peer, so they aren't timed out.
            this.connectedPeers[signal.peerId].lastSignal = Date.now();
        }
        if (signal.recipientId === this.peerId) {
            // Received a message addressed to our peer
            if (this.ignoredPeers[signal.peerId]) {
                // This is unexpected - received comms directly from an ignored peer
                console.error(`Received a message addressed to me from ignored peer ${signal.userId}/${signal.peerId}`);
            } else if (this.connectedPeers[signal.peerId].connected) {
                // This is unexpected - we think we're connected, but the peer is still trying to handshake with us.
                if (signal.offer && signal.offer.type === 'offer') {
                    // They're trying to (re-)initiate the connection.
                    if (this.connectedPeers[signal.peerId].linkReadUrl || Date.now() - this.connectedPeers[signal.peerId].connected < 3000) {
                        // If we've fallen back on the TURN server, ignore the offer.  Also, they might have spammed a
                        // few offers in a row before we accepted - ignore if connection was only a few seconds ago.
                        return;
                    }
                    // Otherwise, try to accept their offer.
                    console.warn(`Re-initiating connection with ${signal.peerId}.`);
                    this.connectedPeers[signal.peerId].peer && this.connectedPeers[signal.peerId].peer.destroy();
                    this.addPeer(signal.peerId, false);
                    this.connectedPeers[signal.peerId].peer.signal(signal.offer);
                } else if (!signal.offer) {
                    if (this.connectedPeers[signal.peerId].linkReadUrl) {
                        // We're already connected via the TURN server.
                        return;
                    }
                    // They're telling us to switch to the relay even though we thought we'd connected P2P.
                    console.warn(`Changing already-established connection with ${signal.peerId} to relay.`);
                    this.connectViaRelay(signal.peerId, false);
                } else {
                    if (Date.now() - this.connectedPeers[signal.peerId].connected < 3000) {
                        // They might have spammed a few answers in a row before we accepted - ignore if connection was
                        // only a few seconds ago.
                        return;
                    }
                    console.warn(`Received unexpected answer to our offer from ${signal.peerId}`);
                }
            } else {
                // Received an offer from a peer we're not yet connected with.
                if (!signal.offer) {
                    // They've decided to fall back to using the relay server, so switch to that channel.
                    await this.connectViaRelay(signal.peerId, false);
                } else {
                    if (this.connectedPeers[signal.peerId].initiatedByMe && signal.offer.type === 'offer') {
                        // Both ends attempted to initiate the connection.  Break the tie by treating the
                        // lexicographically earlier peerId as the initiator.
                        if (this.peerId > signal.peerId) {
                            // Start over as the non-initial peer, and reply to the other peer's initial offer.
                            this.connectedPeers[signal.peerId].peer && this.connectedPeers[signal.peerId].peer.destroy();
                            this.addPeer(signal.peerId, false);
                        } else {
                            // Assume they will start over and reply to our initial offer.
                            return;
                        }
                    }
                    // Accept the offer.
                    this.connectedPeers[signal.peerId].peer.signal(signal.offer);
                }
            }
        }
    }

    /**
     * Listens for a message from the signalling server, gtove-relay-server.  Signals are used to establish connections
     * between webRTC peers.
     */
    async listenForSignal(): Promise<void> {
        while (!this.shutdown) {
            try {
                const signal = await this.getFromSignalServer();
                await this.handleSignal(signal);
            } catch (err) {
                console.error(err);
                await promiseSleep(5000);
            }
        }
    }

    async requestOffers() {
        await this.postToSignalServer({peerId: this.peerId, userId: this.userId});
    }

    startHeartbeat() {
        if (!this.requestOffersInterval) {
            this.requestOffersInterval =
                window.setInterval(this.heartbeat.bind(this), CommsNode.HEARTBEAT_INTERVAL_MS);
        }
    }

    async heartbeat() {
        // Periodically invite offers, which also lets connected peers know I'm still active.
        await this.requestOffers();
        // Check if any peers have failed to signal for a while.
        const timeout = Date.now() - 2 * CommsNode.HEARTBEAT_INTERVAL_MS;
        for (let peerId of Object.keys(this.connectedPeers)) {
            if (this.connectedPeers[peerId].lastSignal < timeout) {
                // peer is idle - time it out.
                console.warn(`Peer ${peerId} sent last signal ${(Date.now() - this.connectedPeers[peerId].lastSignal)/1000} seconds ago - destroying it.`);
                this.destroyPeer(peerId);
            }
        }
    }

    async sendOffer(peerId: string, offer: SimplePeerOffer): Promise<void> {
        await this.postToSignalServer({peerId: this.peerId, userId: this.userId, offer, recipientId: peerId});
        await promiseSleep(5000);
        if (this.connectedPeers[peerId] && this.connectedPeers[peerId].connected) {
            // We're connected!
            return;
        }
        if (this.connectedPeers[peerId]) {
            // Give up on establishing a peer-to-peer connection, fall back on relay.
            this.connectViaRelay(peerId, offer.type === 'offer');
        }
    }

    private async connectViaRelay(peerId: string, initiator: boolean): Promise<void> {
        console.log(`Failed to connect peer-to-peer with ${peerId}, falling back to relay.`);
        this.connectedPeers[peerId] = {
            peerId,
            peer: this.connectedPeers[peerId] && this.connectedPeers[peerId].peer,
            connected: Date.now(),
            initiatedByMe: initiator,
            lastSignal: Date.now(),
            linkReadUrl: PeerNode.RELAY_URL + `${this.peerId}-${peerId}`,
            linkWriteUrl: PeerNode.RELAY_URL + `${peerId}-${this.peerId}`,
            errorCount: 0
        };
        // Do not wait for listenForRelayTraffic, it doesn't resolve until this node shuts down.
        this.listenForRelayTraffic(peerId);
        if (initiator) {
            await this.postToSignalServer({peerId: this.peerId, userId: this.userId, recipientId: peerId});
        }
        this.connectedPeers[peerId].peer.emit('connect');
    }

    async listenForRelayTraffic(peerId: string) {
        while (!this.shutdown && this.connectedPeers[peerId]) {
            try {
                const response = await fetch(this.connectedPeers[peerId].linkReadUrl!, {cache: 'no-store'});
                if (response.ok) {
                    const message = await response.json();
                    this.connectedPeers[peerId].peer.emit(message.type, message.message);
                } else {
                    this.connectedPeers[peerId].peer.emit('error', response);
                }
            } catch (e) {
                if (this.connectedPeers[peerId] && this.connectedPeers[peerId].peer) {
                    this.connectedPeers[peerId].peer.emit('error', e);
                }
            }
        }
    }

    addPeer(peerId: string, initiator: boolean) {
        const peer: Peer.Instance = new Peer({initiator, trickle: false});
        peer.on('signal', (offer) => (this.onSignal(peerId, offer)));
        peer.on('error', (error) => (this.onError(peerId, error)));
        peer.on('close', () => (this.onClose(peerId)));
        peer.on('connect', () => (this.onConnect(peerId)));
        Object.keys(this.onEvents).forEach((event) => {
            peer.on(event, (...args) => this.onEvents[event](this, peerId, ...args));
        });
        this.connectedPeers[peerId] = {peerId, peer, connected: 0, initiatedByMe: initiator, errorCount: 0, lastSignal: Date.now()};
    }

    async onSignal(peerId: string, offer: any): Promise<void> {
        if (!this.connectedPeers[peerId].linkReadUrl) {
            await this.sendOffer(peerId, offer);
        }
    }

    onError(peerId: string, error: Error) {
        console.error('Error from', peerId, error);
        delete(this.connectedPeers[peerId]);
    }

    onClose(peerId: string) {
        console.log('Lost connection with', peerId);
        delete(this.connectedPeers[peerId]);
    }

    onConnect(peerId: string) {
        console.log('Established connection with', peerId);
        this.connectedPeers[peerId].connected = Date.now();
    }

    private async sendDataViaP2POrRelay(peerId: string, message: string) {
        try {
            if (this.connectedPeers[peerId].linkWriteUrl) {
                await fetch(this.connectedPeers[peerId].linkWriteUrl!, {
                    method: 'POST',
                    body: JSON.stringify({type: 'data', message})
                });
            } else {
                this.connectedPeers[peerId].peer.send(message);
            }
            this.connectedPeers[peerId].errorCount = 0;
        } catch (e) {
            if (this.connectedPeers[peerId]) {
                this.connectedPeers[peerId].errorCount++;
                const consecutive = this.connectedPeers[peerId].errorCount === 1 ? '' : ` (${this.connectedPeers[peerId].errorCount} consecutive errors)`;
                console.error(`Error sending to peer ${peerId}${consecutive}:`, e);
                if (this.connectedPeers[peerId].errorCount > 10) {
                    // Give up on this peer
                    console.error(`Too many errors, giving up on peer ${peerId}`);
                    this.destroyPeer(peerId);
                }
            }
        }
    }

    destroyPeer(peerId: string) {
        console.log(`Destroying connection with peer ${peerId}.`);
        if (this.connectedPeers[peerId]) {
            if (this.connectedPeers[peerId].linkWriteUrl) {
                // Don't wait for fetch to resolve.
                fetch(this.connectedPeers[peerId].linkWriteUrl!, {
                    method: 'POST',
                    body: JSON.stringify({type: 'close'})
                });
                if (this.connectedPeers[peerId].peer) {
                    this.connectedPeers[peerId].peer.emit('close');
                } else {
                    this.onEvents.close && this.onEvents.close(this, peerId);
                }
            } else if (!this.connectedPeers[peerId].connected) {
                if (this.connectedPeers[peerId].peer) {
                    this.connectedPeers[peerId].peer.emit('close');
                } else {
                    this.onEvents.close && this.onEvents.close(this, peerId);
                }
            } else {
                if (this.connectedPeers[peerId].peer) {
                    this.connectedPeers[peerId].peer.destroy();
                } else {
                    this.onEvents.close && this.onEvents.close(this, peerId);
                }
            }
            delete(this.connectedPeers[peerId]);
        }
    }

    private async sendToRaw(message: string | object, recipients: string[], onSentMessage?: (recipients: string[], message: string | object) => void) {
        // JSON has no "undefined" value, so if JSON-stringifying, convert undefined values to null.
        const stringMessage: string = (typeof(message) === 'object') ?
            JSON.stringify(message, (k, v) => (v === undefined ? null : v)) : message;
        for (let peerId of recipients) {
            if (this.connectedPeers[peerId] && this.connectedPeers[peerId].connected) {
                await this.sendDataViaP2POrRelay(peerId, stringMessage);
            } else {
                // Keep trying until peerId connects, or the connection is removed.
                const intervalId = window.setInterval(async () => {
                    if (this.connectedPeers[peerId]) {
                        if (this.connectedPeers[peerId].connected) {
                            await this.sendDataViaP2POrRelay(peerId, stringMessage);
                        } else {
                            return; // Keep trying
                        }
                    }
                    // Either peer has been removed or we've managed to send the message - stop interval loop.
                    window.clearInterval(intervalId);
                }, 250);
            }
        }
        onSentMessage && onSentMessage(recipients, message);
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
    async sendTo(message: string | object, {only, except, throttleKey, onSentMessage}: SendToOptions = {}) {
        const recipients = (only || Object.keys(this.connectedPeers))
            .filter((peerId) => (!except || except.indexOf(peerId) < 0));
        if (throttleKey) {
            await this.memoizedThrottle(throttleKey, this.sendToRaw)(message, recipients, onSentMessage);
        } else {
            await this.sendToRaw(message, recipients, onSentMessage);
        }
    }

    async disconnectAll() {
        Object.keys(this.connectedPeers).forEach((peerId) => (this.destroyPeer(peerId)));
        this.connectedPeers = {};
    }

    async destroy() {
        console.log('Shutting down peer-to-peer node', this.peerId);
        this.shutdown = true;
        window.clearInterval(this.requestOffersInterval);
        await this.disconnectAll();
    }

    async close(peerId: string, reason?: string) {
        if (this.connectedPeers[peerId]) {
            if (reason) {
                await this.sendToRaw(closeMessage(reason), [peerId]);
            }
            this.destroyPeer(peerId);
        }
    }
}
