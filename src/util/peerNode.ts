import Peer from 'simple-peer';
import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';

import {promiseSleep} from './promiseSleep';
import {CommsNode, CommsNodeCallback} from './commsNode';

interface ConnectedPeer {
    peerId: string;
    peer: Peer.Instance;
    connected: boolean;
    initiatedByMe: boolean;
}

export interface SendToOptions {
    only?: string[];
    except?: string[];
    throttleKey?: string;
    onSentMessage?: (recipients: string[], message: string | object) => void;
}

interface SignalMessage {
    peerId: string;
    offer?: string;
    initiator?: boolean;
    recipientId?: string;
    type?: string;
}

/**
 * A node in a peer-to-peer network.  Uses httprelay.io to do signalling and webRTC (via simple-peer) for the actual
 * communication.  Builds a totally connected network topology - each node in the network has a direct peer-to-peer
 * connection to each other node.
 */
export class PeerNode extends CommsNode {

    static SIGNAL_URL = 'https://httprelay.io/mcast/';

    public peerId: string;

    private signalChannelId: string;
    private onEvents: {event: string, callback: CommsNodeCallback}[];
    private connectedPeers: {[key: string]: ConnectedPeer};
    private memoizedThrottle: (key: string, func: Function) => Function;
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
        this.init();
    }

    init() {
        // Request offers from anyone already online, then start listening.
        return this.requestOffers()
            .then(() => (this.listenForSignal()));
    }

    getFromSignalServer(): Promise<SignalMessage> {
        return fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}${this.seqId !== null ? `?SeqId=${this.seqId}` : ''}`, {
                cache: 'no-store'
            })
            .then((response) => {
                if (response.ok) {
                    this.seqId = Number(response.headers.get('httprelay-seqid')) + 1;
                    return response.json();
                } else {
                    throw new Error('invalid response from signal server' + response.statusText);
                }
            });
    }

    postToSignalServer(body: SignalMessage) {
        return fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}`, {
            credentials: 'include',
            method: 'POST',
            body: JSON.stringify(body)
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('invalid response from httprelay' + response.statusText);
                }
            });
    }

    /**
     * Listens for a message from the signalling server, httprelay.io.  Signals are used to establish connections
     * between webRTC peers.
     *
     * The messages are of the form {peerId} or {peerId, offer, recipientId}.  The first form is a broadcast "I'm
     * online, please talk to me" message.  The second form is a handshake between peers.
     * * "peerId" is the id of the sender of the message.
     * * "offer" is a webRTC offer.
     * * "recipientId" is the peerId to whom the offer is being made.
     * @return {Promise} A promise which continues to listen for future signalling messages.
     */
    listenForSignal(): Promise<any> {
        return this.getFromSignalServer()
            .then((signal) => {
                if (!this.shutdown && signal.peerId !== this.peerId && !this.connectedPeers[signal.peerId] && !signal.type) {
                    // A node I don't already have is out there.
                    if (signal.recipientId && signal.recipientId !== this.peerId) {
                        // It's talking to someone else - request an offer after a random delay
                        promiseSleep(250 * Math.random())
                            .then(() => (this.requestOffers()));
                    } else {
                        // It's either requesting offers or making me an offer - add the node.
                        this.addPeer(signal.peerId, !signal.recipientId);
                    }
                }
                if (!this.shutdown && signal.recipientId === this.peerId && signal.offer && !this.connectedPeers[signal.peerId].connected) {
                    // Received an offer from a peer we're not yet connected with.
                    if (this.connectedPeers[signal.peerId].initiatedByMe && signal.initiator) {
                        // Both ends attempted to initiate the connection.  Break the tie by giving it to the earlier peerId.
                        if (this.peerId > signal.peerId) {
                            // Make the later peerId start over as the non-initial peer.
                            this.connectedPeers[signal.peerId].peer && this.connectedPeers[signal.peerId].peer.destroy();
                            this.addPeer(signal.peerId, false);
                        } else {
                            // Make the earlier peerId discard the other peer's initial offer.
                            return;
                        }
                    }
                    // Accept the offer.
                    this.connectedPeers[signal.peerId].peer.signal(signal.offer);
                }
            })
            .catch((err) => {
                console.error(err);
                return promiseSleep(5000);
            })
            .then(() => {
                return this.shutdown ? undefined : this.listenForSignal();
            });
    }

    requestOffers() {
        return this.postToSignalServer({peerId: this.peerId});
    }

    sendOffer(peerId: string, offer: string, initiator: boolean, retries: number = 5): Promise<void> | void {
        if (retries < 0) {
            console.log('Giving up on making an offer to', peerId);
            delete(this.connectedPeers[peerId]);
        } else {
            return this.postToSignalServer({peerId: this.peerId, offer, recipientId: peerId, initiator})
                .then(() => (promiseSleep(500 + Math.random() * 1000)))
                .then(() => {
                    // If we're not connected after a second, re-send the offer.
                    if (this.connectedPeers[peerId] && !this.connectedPeers[peerId].connected) {
                        return this.sendOffer(peerId, offer, initiator, retries - 1);
                    }
                });
        }
    }

    addPeer(peerId: string, initiator: boolean) {
        const peer: Peer.Instance = new Peer({initiator, trickle: false});
        peer.on('signal', (offer) => {this.onSignal(peerId, offer, initiator)});
        peer.on('error', (error) => {this.onError(peerId, error)});
        peer.on('close', () => {this.onClose(peerId)});
        peer.on('connect', () => {this.onConnect(peerId)});
        // peer.on('data', (data) => {this.onData(peerId, data)});
        this.onEvents.forEach(({event, callback}) => {
            peer.on(event, (...args) => (callback(this, peerId, ...args)));
        });
        this.connectedPeers[peerId] = {peerId, peer, connected: false, initiatedByMe: initiator};
    }

    onSignal(peerId: string, offer: string, initiator: boolean) {
        return this.sendOffer(peerId, offer, initiator);
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

    // onData(peerId: string, data: string | Buffer) {
    // }

    private sendToRaw(message: string | object, recipients: string[], onSentMessage?: (recipients: string[], message: string | object) => void) {
        // JSON has no "undefined" value, so if JSON-stringifying, convert undefined values to null.
        const stringMessage: string = (typeof(message) === 'object') ?
            JSON.stringify(message, (k, v) => (v === undefined ? null : v)) : message;
        recipients.forEach((peerId) => {
                if (this.connectedPeers[peerId].connected) {
                    this.connectedPeers[peerId].peer.send(stringMessage);
                } else {
                    // Keep trying until peerId connects, or the connection is removed.
                    const intervalId = window.setInterval(() => {
                        if (this.connectedPeers[peerId]) {
                            if (this.connectedPeers[peerId].connected) {
                                this.connectedPeers[peerId].peer.send(stringMessage);
                            } else {
                                return;
                            }
                        }
                        window.clearInterval(intervalId);
                    }, 250);
                }
            });
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
        Object.keys(this.connectedPeers).forEach((peerId) => {
            this.connectedPeers[peerId] && this.connectedPeers[peerId].peer && this.connectedPeers[peerId].peer.destroy();
        });
        this.connectedPeers = {};
    }

    async destroy() {
        console.log('Shutting down peer-to-peer node', this.peerId);
        this.shutdown = true;
        await this.disconnectAll();
    }
}
