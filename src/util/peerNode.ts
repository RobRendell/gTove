import Peer from 'simple-peer';
import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';

import {promiseSleep} from './promiseSleep';
import {CommsNode, CommsNodeCallback, SendToOptions} from './commsNode';

interface ConnectedPeer {
    peerId: string;
    peer: Peer.Instance;
    connected: boolean;
    initiatedByMe: boolean;
    errorCount: number;
    linkReadUrl?: string;
    linkWriteUrl?: string;
}

interface SignalMessage {
    peerId: string;
    offer?: string;
    initiator?: boolean;
    recipientId?: string;
}

/**
 * A node in a peer-to-peer network.  Uses httprelay.io to do signalling and webRTC (via simple-peer) for the actual
 * communication.  Builds a totally connected network topology - each node in the network has a direct peer-to-peer
 * connection to each other node.
 */
export class PeerNode extends CommsNode {

    static SIGNAL_URL = 'https://httprelay.io/mcast/';
    // I don't want to run an actual WebRTC TURN server, but I can relay messages manually via httprelay.io as a fallback.
    static RELAY_URL = 'https://httprelay.io/link/';

    public peerId: string;

    private readonly signalChannelId: string;
    private onEvents: {event: string, callback: CommsNodeCallback}[];
    private connectedPeers: {[key: string]: ConnectedPeer};
    private readonly memoizedThrottle: (key: string, func: Function) => Function;
    private seqId: number | null = null;
    private shutdown: boolean = false;

    /**
     * @param signalChannelId The unique string used to identify the multi-cast channel on httprelay.io.  All PeerNodes
     * with the same signalChannelId will signal each other and connect.
     * @param onEvents An array of objects with keys event and callback.  Each peer-to-peer connection will invoke the
     * callbacks when they get the corresponding events.  The first two parameters to the callback are this PeerNode
     * instance and the peerId of the connection, and the subsequent parameters vary for different events.
     * @param throttleWait The number of milliseconds to throttle messages with the same throttleKey (see sendTo).
     */
    constructor(signalChannelId: string, onEvents: {event: string, callback: CommsNodeCallback}[], throttleWait: number = 250) {
        super();
        this.signalChannelId = signalChannelId;
        this.onEvents = onEvents;
        this.connectedPeers = {};
        this.peerId = v4();
        console.log('Created peer-to-peer node', this.peerId);
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
        await this.listenForSignal();
    }

    async getFromSignalServer(): Promise<SignalMessage> {
        const response = await fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}${this.seqId !== null ? `?SeqId=${this.seqId}` : ''}`, {
                cache: 'no-store'
            });
        if (response.ok) {
            this.seqId = Number(response.headers.get('httprelay-seqid')) + 1;
            return response.json();
        } else {
            throw new Error('invalid response from signal server: ' + response.statusText);
        }
    }

    async postToSignalServer(body: SignalMessage) {
        const response = await fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error('invalid response from signal server: ' + response.statusText);
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
     * * "initiator" is a boolean indicating whether the sender thinks they initiated the offer or not.
     * @param signal
     */
    async handleSignal(signal: SignalMessage) {
        if (!this.shutdown && signal.peerId !== this.peerId && !this.connectedPeers[signal.peerId]) {
            // A node I don't already have is out there.
            if (signal.recipientId && signal.recipientId !== this.peerId) {
                // It's talking to someone else - request an offer after a random delay
                await promiseSleep(250 * Math.random());
                await this.requestOffers();
            } else {
                // It's either requesting offers or making me an offer - add the node.
                this.addPeer(signal.peerId, !signal.recipientId);
            }
        }
        if (!this.shutdown && signal.recipientId === this.peerId && !this.connectedPeers[signal.peerId].connected) {
            // Received an offer from a peer we're not yet connected with.
            if (!signal.offer) {
                return this.connectViaRelay(signal.peerId, false);
            } else {
                if (this.connectedPeers[signal.peerId].initiatedByMe && signal.initiator) {
                    // Both ends attempted to initiate the connection.  Break the tie by giving it to the earlier peerId.
                    if (this.peerId > signal.peerId) {
                        // Start over as the non-initial peer.
                        this.connectedPeers[signal.peerId].peer && this.connectedPeers[signal.peerId].peer.destroy();
                        this.addPeer(signal.peerId, false);
                    } else {
                        // Assume they will re-send an offer with us as the initial peer.
                        return;
                    }
                }
                // Accept the offer.
                this.connectedPeers[signal.peerId].peer.signal(signal.offer);
            }
        }
    }

    /**
     * Listens for a message from the signalling server, httprelay.io.  Signals are used to establish connections
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
        await this.postToSignalServer({peerId: this.peerId});
    }

    async sendOffer(peerId: string, offer: string, initiator: boolean): Promise<void> {
        for (let retries = 5; retries >= 0; retries--) {
            await this.postToSignalServer({peerId: this.peerId, offer, recipientId: peerId, initiator});
            await promiseSleep(500 + Math.random() * 1000);
            if (this.connectedPeers[peerId] && this.connectedPeers[peerId].connected) {
                // We're connected!
                return;
            }
        }
        // Give up on establishing a peer-to-peer connection, fall back on relay.
        await this.connectViaRelay(peerId, initiator);
    }

    private async connectViaRelay(peerId: string, initiator: boolean): Promise<void> {
        console.log(`Failed to connect peer-to-peer with ${peerId}, falling back to relay.`);
        this.connectedPeers[peerId].linkReadUrl = PeerNode.RELAY_URL + `${this.peerId}-${peerId}`;
        this.connectedPeers[peerId].linkWriteUrl = PeerNode.RELAY_URL + `${peerId}-${this.peerId}`;
        this.connectedPeers[peerId].connected = true;
        const listenPromise = this.listenForRelayTraffic(peerId);
        if (initiator) {
            await this.postToSignalServer({peerId: this.peerId, recipientId: peerId, initiator});
        }
        this.connectedPeers[peerId].peer.emit('connect');
        return listenPromise;
    }

    async listenForRelayTraffic(peerId: string) {
        while (!this.shutdown && this.connectedPeers[peerId]) {
            try {
                const response = await fetch(this.connectedPeers[peerId].linkReadUrl, {cache: 'no-store'});
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
        peer.on('signal', (offer) => (this.onSignal(peerId, offer, initiator)));
        peer.on('error', (error) => (this.onError(peerId, error)));
        peer.on('close', () => (this.onClose(peerId)));
        peer.on('connect', () => (this.onConnect(peerId)));
        this.onEvents.forEach(({event, callback}) => {
            peer.on(event, (...args) => (callback(this, peerId, ...args)));
        });
        this.connectedPeers[peerId] = {peerId, peer, connected: false, initiatedByMe: initiator, errorCount: 0};
    }

    async onSignal(peerId: string, offer: string, initiator: boolean): Promise<void> {
        if (!this.connectedPeers[peerId].linkReadUrl) {
            await this.sendOffer(peerId, offer, initiator);
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
        this.connectedPeers[peerId].connected = true;
    }

    private async sendDataViaP2POrRelay(peerId: string, message: string) {
        try {
            if (this.connectedPeers[peerId].linkWriteUrl) {
                await fetch(this.connectedPeers[peerId].linkWriteUrl, {
                    method: 'POST',
                    body: JSON.stringify({type: 'data', message})
                });
            } else {
                this.connectedPeers[peerId].peer.send(message);
            }
            this.connectedPeers[peerId].errorCount = 0;
        } catch (e) {
            this.connectedPeers[peerId].errorCount++;
            const consecutive = this.connectedPeers[peerId].errorCount === 1 ? '' : ` (${this.connectedPeers[peerId].errorCount} consecutive errors)`;
            console.error(`Error sending to peer ${peerId}${consecutive}:`, e);
            if (this.connectedPeers[peerId].errorCount > 10) {
                // Give up on this peer
                console.error(`Too many errors, giving up on peer ${peerId}`);
                await this.destroyPeer(peerId);
            }
        }
    }

    async destroyPeer(peerId: string) {
        console.log(`Destroying connection with peer ${peerId}.`);
        if (this.connectedPeers[peerId]) {
            if (this.connectedPeers[peerId].linkWriteUrl) {
                await fetch(this.connectedPeers[peerId].linkWriteUrl, {
                    method: 'POST',
                    body: JSON.stringify({type: 'close'})
                });
                if (this.connectedPeers[peerId] && this.connectedPeers[peerId].peer) {
                    this.connectedPeers[peerId].peer.emit('close');
                }
            } else {
                this.connectedPeers[peerId].peer.destroy();
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
        await this.disconnectAll();
    }
}
