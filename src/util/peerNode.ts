import * as Peer from 'simple-peer';
import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';

import {promiseSleep} from './promiseSleep';

type PeerNodeCallback = (peerNode: PeerNode, peerId: string, ...args: any[]) => void;

export interface PeerNodeOptions {
    onEvents?: {event: string, callback: PeerNodeCallback}[];
    throttleWait?: number;
}

interface ConnectedPeer {
    peerId: string;
    peer: Peer.Instance;
    connected: boolean;
}

interface SendToOptions {
    only?: string[];
    except?: string[];
    throttleKey?: string;
}

/**
 * A node in a peer-to-peer network.  Uses httprelay.io to do signalling and webRTC (via simple-peer) for the actual
 * communication.  Builds a totally connected network topology - each node in the network has a direct peer-to-peer
 * connection to each other node.
 */
export class PeerNode {

    static SIGNAL_URL = 'https://httprelay.io/mcast/';

    public peerId: string;

    private signalChannelId: string;
    private onEvents: {event: string, callback: PeerNodeCallback}[];
    private connectedPeers: {[key: string]: ConnectedPeer};
    private memoizedThrottle: (key: string, func: Function) => Function;

    /**
     * @param signalChannelId The unique string used to identify the multi-cast channel on httprelay.io.  All PeerNodes
     * with the same signalChannelId will signal each other and connect.
     * @param onEvents An array of objects with keys event and callback.  Each peer-to-peer connection will invoke the
     * callbacks when they get the corresponding events.  The first two parameters to the callback are this PeerNode
     * instance and the peerId of the connection, and the subsequent parameters vary for different events.
     * @param throttleWait The number of milliseconds to throttle messages with the same throttleKey (see sendTo).
     */
    constructor(signalChannelId: string, onEvents: {event: string, callback: PeerNodeCallback}[], throttleWait: number = 250) {
        this.signalChannelId = signalChannelId;
        this.onEvents = onEvents;
        this.connectedPeers = {};
        this.peerId = v4();
        console.log('Created peerNode', this.peerId);
        // Create a memoized throttle function wrapper.  Calls with the same (truthy) throttleKey will be throttled so
        // the function is called at most once each throttleWait milliseconds.  This is used to wrap the send function,
        // so things like dragging minis doesn't flood the connection - since each position update supersedes the
        // previous one, we don't need to send every intermediate value.
        this.memoizedThrottle = memoize((throttleKey, func) => (throttle(func, throttleWait)));
        this.init();
    }

    init() {
        // Request offers from anyone already online, then start listening.
        return this.requestOffers()
            .then(() => (this.listenForSignal()));
    }

    getFromSignalServer() {
        return fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}`, {
            credentials: 'include'
        })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('invalid response from signal server' + response.statusText);
                }
            });
    }

    postToSignalServer(body: object) {
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
                if (signal.peerId !== this.peerId && !this.connectedPeers[signal.peerId]) {
                    // A node I don't already have is out there.
                    if (signal.recipientId && signal.recipientId !== this.peerId) {
                        // It's talking to someone else - request an offer after a short delay
                        promiseSleep(100)
                            .then(() => (this.requestOffers()));
                    } else {
                        // It's either requesting offers or making me an offer - add the node.
                        this.addPeer(signal.peerId, !signal.recipientId);
                    }
                }
                if (signal.recipientId === this.peerId && !this.connectedPeers[signal.peerId].connected) {
                    // Received an offer - accept it.
                    this.connectedPeers[signal.peerId].peer.signal(signal.offer);
                }
            })
            .catch((err) => {
                console.error(err);
            })
            .then(() => {
                return this.listenForSignal();
            });
    }

    requestOffers() {
        return this.postToSignalServer({peerId: this.peerId});
    }

    sendOffer(peerId: string, offer: string, retries: number = 5): Promise<void> | void {
        if (retries < 0) {
            console.log('Giving up on making an offer to', peerId);
            delete(this.connectedPeers[peerId]);
        } else {
            return this.postToSignalServer({peerId: this.peerId, offer, recipientId: peerId})
                .then(() => (promiseSleep(500 + Math.random() * 1000)))
                .then(() => {
                    // If we're not connected after a second, re-send the offer.
                    if (this.connectedPeers[peerId] && !this.connectedPeers[peerId].connected) {
                        return this.sendOffer(peerId, offer, retries - 1);
                    }
                });
        }
    }

    addPeer(peerId: string, initiator: boolean) {
        const peer: Peer.Instance = new Peer({initiator, trickle: false});
        peer.on('signal', (offer) => {this.onSignal(peerId, offer)});
        peer.on('error', (error) => {this.onError(peerId, error)});
        peer.on('close', () => {this.onClose(peerId)});
        peer.on('connect', () => {this.onConnect(peerId)});
        // peer.on('data', (data) => {this.onData(peerId, data)});
        this.onEvents.forEach(({event, callback}) => {
            peer.on(event, (...args) => (callback(this, peerId, ...args)));
        });
        this.connectedPeers[peerId] = {peerId, peer, connected: false};
    }

    onSignal(peerId: string, offer: string) {
        return this.sendOffer(peerId, offer);
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

    sendMessageRaw(peer: Peer.Instance, message: string) {
        peer.send(message);
    }

    sendMessage(throttleKey: string | undefined, peer: Peer.Instance, message: string) {
        if (throttleKey) {
            this.memoizedThrottle(throttleKey, this.sendMessageRaw)(peer, message);
        } else {
            this.sendMessageRaw(peer, message);
        }
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
     */
    sendTo(message: string | object, {only, except, throttleKey}: SendToOptions = {}) {
        const stringMessage: string = (typeof(message) === 'object') ? JSON.stringify(message) : message;
        (only || Object.keys(this.connectedPeers))
            .filter((peerId) => (!except || except.indexOf(peerId) < 0))
            .forEach((peerId) => {
                if (this.connectedPeers[peerId].connected) {
                    this.sendMessage(throttleKey, this.connectedPeers[peerId].peer, stringMessage);
                }
            })
    }

    disconnectAll() {
        Object.keys(this.connectedPeers).forEach((peerId) => {
            this.connectedPeers[peerId].peer.destroy();
        });
        this.connectedPeers = {};
    }
}
