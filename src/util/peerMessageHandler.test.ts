import chai from 'chai';
import {Store} from 'redux';
import sinon from 'sinon';

import {ReduxStoreType} from '../redux/mainReducerTypes';
import {CommsNode} from './commsNode';
import peerMessageHandler from './peerMessageHandler';

describe('peerMessageHandler', () => {

    const myPeerId = 'my-peer-id';
    const theirPeerId = 'their-peer-id';

    let storeState: ReduxStoreType;
    let mockStoreDispatch: sinon.SinonStub;
    let mockStore: Store<ReduxStoreType>;
    let mockCommsNodeSendTo: sinon.SinonStub;
    let mockCommsNode: CommsNode;

    beforeEach(() => {
        storeState = {tabletop: {gm: 'gm email'}, connectedUsers: {users: {}}, loggedInUser: {user: {emailAddress: 'user email'}}, undoableState: {}} as any;
        mockStoreDispatch = sinon.stub();
        mockStore = {getState: () => (storeState), dispatch: mockStoreDispatch} as any;
        mockCommsNodeSendTo = sinon.stub();
        mockCommsNode = {sendTo: mockCommsNodeSendTo, peerId: myPeerId, options: {}} as any;
    });

    describe('with Redux action', () => {

        const reduxActionType = 'a redux action';

        it('should dispatch non-scenario action', async () => {
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify({type: reduxActionType}));
            chai.assert.equal(mockStoreDispatch.callCount, 1, 'should have dispatched an action');
            chai.assert.equal(mockStoreDispatch.getCall(0).args[0].type, reduxActionType);
        });

    });

});