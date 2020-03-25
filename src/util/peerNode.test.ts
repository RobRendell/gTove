import sinon from 'sinon';
import chai from 'chai';
import Peer from 'simple-peer';
jest.mock('simple-peer');

import {PeerNode, SimplePeerOffer} from './peerNode';

describe('peerNode', () => {

    const sandbox = sinon.sandbox.create();

    let mockFetch: sinon.SinonStub;
    let peerNode: PeerNode;

    beforeEach(() => {
        mockFetch = sandbox.stub(window, 'fetch');
        peerNode = new PeerNode('channelId', 'userId', {});
    });

    afterEach(async () => {
        if (peerNode) {
            await peerNode.destroy();
        }
        sandbox.restore();
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    describe('requestOffers method', () => {

        it('should post a "requesting offers" message (i.e. a signal with just peerId) to signal server.', async () => {
            mockFetch.returns(Promise.resolve({ok: true}));
            await peerNode.requestOffers();
            chai.assert.equal(mockFetch.callCount, 1, 'should have called fetch once.');
            const body = JSON.parse(mockFetch.getCall(0).args[1].body);
            chai.assert.lengthOf(Object.keys(body), 2, 'body should have only two field.');
            chai.assert.equal(body.peerId, peerNode.peerId, 'signal should have peer\'s own peerId.');
            chai.assert.equal(body.userId, peerNode.userId, 'signal should have peer\'s own userId.');
        });

    });

    describe('handleSignal method', () => {

        const otherPeerId = 'some-other-peerId';

        let addPeerSpy: sinon.SinonSpy;

        beforeEach(() => {
           addPeerSpy = sandbox.spy(peerNode, 'addPeer');
        });

        it('should ignore signals from itself.', async () => {
            await peerNode.handleSignal({peerId: peerNode.peerId, userId: peerNode.userId});
            chai.assert.equal(addPeerSpy.callCount, 0, 'should not have added any peers.');
        });

        it('should respond to a "requesting offers" message from an unknown peer by adding the peer with self as initiator.', async () => {
            await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId'});
            chai.assert.equal(addPeerSpy.callCount, 1, 'should have called addPeer.');
            chai.assert.equal(addPeerSpy.getCall(0).args[0], otherPeerId, 'should have added other peer Id');
            chai.assert.isTrue(addPeerSpy.getCall(0).args[1], 'should have set initiator true');
        });

        it('should respond to a message from an unknown peer addressed to another peer by adding the peer with self as initiator.', async () => {
            await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId', recipientId: 'party of the second part'});
            chai.assert.equal(addPeerSpy.callCount, 1, 'should have called addPeer.');
            chai.assert.equal(addPeerSpy.getCall(0).args[0], otherPeerId, 'should have added other peer Id');
            chai.assert.isTrue(addPeerSpy.getCall(0).args[1], 'should have set initiator true');
        });

        describe('when signal is addressed to own peerId', () => {

            const offer: SimplePeerOffer = {sdp: 'an offer string', type: 'offer'};

            let signalStub: sinon.SinonStub;

            beforeEach(() => {
                signalStub = sandbox.stub(Peer.prototype, 'signal');
            });

            it('should switch the peer to relay in response to a message with no offer.', async () => {
                const mockEvent = 'mock-event';
                mockFetch.returns(Promise.resolve({ok: true, json: () => (Promise.resolve({type: mockEvent}))}));
                // Since the relay listens for messages in a promise until the peer closes down, we need to trigger a
                // shutdown when things run as expected.
                sandbox.stub(Peer.prototype, 'emit').callsFake(async (type: string) => {
                    if (type === mockEvent) {
                        await peerNode.destroyPeer(otherPeerId);
                    }
                });
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId', recipientId: peerNode.peerId});
                chai.assert.equal(Peer.prototype.emit.callCount, 3, 'should have called emit');
                chai.assert.equal(Peer.prototype.emit.getCall(0).args[0], 'connect', 'should have emitted connect event');
                chai.assert.equal(Peer.prototype.emit.getCall(1).args[0], mockEvent, 'should have emitted expected mock event');
                chai.assert.equal(Peer.prototype.emit.getCall(2).args[0], 'close', 'should have emitted close event');
                chai.assert.equal(mockFetch.callCount, 2, 'should have fetched from relay to get/send messages');
            });

            it('should accept a p2p offer initiated by the other end only.', async () => {
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId', recipientId: peerNode.peerId, offer});
                chai.assert.equal(signalStub.callCount, 1, 'should have signalled peer');
                chai.assert.equal(signalStub.getCall(0).args[0], offer, 'should have used the sent offer');
            });

            it('should accept a p2p offer initiated by me and replied to by the other end.', async () => {
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId'});
                const answer: SimplePeerOffer = {...offer, type: 'answer'};
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId', recipientId: peerNode.peerId, offer: answer});
                chai.assert.equal(signalStub.callCount, 1, 'should have signalled peer');
                chai.assert.equal(signalStub.getCall(0).args[0], answer, 'should have used the sent answer');
            });

            it('should accept a p2p offer initiated by both ends if other peerID is lexicographically lower.', async () => {
                const otherPeerId = '000 something lexicographically lower';
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId'});
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId', recipientId: peerNode.peerId, offer});
                chai.assert.equal(signalStub.callCount, 1, 'should have signalled peer');
                chai.assert.equal(signalStub.getCall(0).args[0], offer, 'should have used the sent offer');
            });

            it('should ignore an offer initiated by both ends if other peerID is lexicographically higher.', async () => {
                const otherPeerId = 'zzz something lexicographically higher';
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId'});
                await peerNode.handleSignal({peerId: otherPeerId, userId: 'otherUserId', recipientId: peerNode.peerId, offer});
                chai.assert.equal(signalStub.callCount, 0, 'should not have signalled peer');
            });

        });

    })

});