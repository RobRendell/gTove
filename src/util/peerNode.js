import * as Peer from 'simple-peer';
import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';

import {promiseSleep} from './promiseSleep';

/**
 * A node in a peer-to-peer network.  Uses httprelay.io to do signalling and webRTC (via simple-peer) for the actual
 * communication.  Builds a totally connected network topology - each node in the network has a direct peer-to-peer
 * connection to each other node.
 */
export class PeerNode {

    static SIGNAL_URL = 'https://httprelay.io/mcast/';

    constructor(signalChannelId, throttleWait = 250) {
        this.signalChannelId = signalChannelId;
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
                    throw new Error('invalid response from signal server', response);
                }
            });
    }

    postToSignalServer(body) {
        return fetch(`${PeerNode.SIGNAL_URL}${this.signalChannelId}`, {
            credentials: 'include',
            method: 'POST',
            body: JSON.stringify(body)
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('invalid response from httprelay', response);
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
    listenForSignal() {
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

    sendOffer(peerId, offer, retries = 5) {
        if (retries < 0) {
            console.log('Giving up on making an offer to', peerId);
            delete(this.connectedPeers[peerId]);
        } else {
            return this.postToSignalServer({peerId: this.peerId, offer, recipientId: peerId})
                .then(() => (promiseSleep(1000)))
                .then(() => {
                    // If we're not connected after a second, re-send the offer.
                    if (this.connectedPeers[peerId] && !this.connectedPeers[peerId].connected) {
                        return this.sendOffer(peerId, offer, retries - 1);
                    }
                });
        }
    }

    addPeer(peerId, initiator) {
        const peer = new Peer({initiator, trickle: false});
        peer.on('signal', (offer) => {this.onSignal(peerId, offer)});
        peer.on('error', (error) => {this.onError(peerId, error)});
        peer.on('close', () => {this.onClose(peerId)});
        peer.on('connect', () => {this.onConnect(peerId)});
        peer.on('data', (data) => {this.onData(peerId, data)});
        this.connectedPeers[peerId] = {peerId, peer, connected: false};
    }

    onSignal(peerId, offer) {
        return this.sendOffer(peerId, offer);
    }

    onError(peerId, error) {
        console.error('Error from', peerId, error);
        delete(this.connectedPeers[peerId]);
    }

    onClose(peerId) {
        console.log('Lost connection with', peerId);
        delete(this.connectedPeers[peerId]);
    }

    onConnect(peerId) {
        console.log('Established connection with', peerId);
        this.connectedPeers[peerId].connected = true;
    }

    onData(peerId, data) {
    }

    sendMessageRaw(peer, message) {
        peer.send(message);
    }

    sendMessage(throttleKey, peer, message) {
        if (throttleKey) {
            this.memoizedThrottle(throttleKey, this.sendMessageRaw)(peer, message);
        } else {
            this.sendMessageRaw(peer, message);
        }
    }

    sendTo(message, options = {}) {
        const {only = null, except = null, throttleKey = null} = options;
        if (typeof(message) === 'object') {
            message = JSON.stringify(message);
        }
        (only || Object.keys(this.connectedPeers))
            .filter((peerId) => (!except || except.indexOf(peerId) < 0))
            .forEach((peerId) => {
                if (this.connectedPeers[peerId].connected) {
                    this.sendMessage(throttleKey, this.connectedPeers[peerId].peer, message);
                }
            })
    }
}
