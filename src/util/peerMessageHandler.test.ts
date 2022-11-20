import {Store} from 'redux';
import sinon from 'sinon';
import chai from 'chai';

import peerMessageHandler from './peerMessageHandler';
import {ReduxStoreType} from '../redux/mainReducer';
import {CommsNode} from './commsNode';
import {
    initialTabletopValidationType,
    TabletopValidationActionTypes,
    TabletopValidationType
} from '../redux/tabletopValidationReducer';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducer';

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

    const buildStoreWithTabletopValidation = (tabletopValidation: Partial<TabletopValidationType>) => ({
        ...storeState,
        undoableState: {
            ...storeState.undoableState,
            present: {
                ...storeState.undoableState.present,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    ...tabletopValidation
                }
            }
        }
    });

    describe('with Redux action', () => {

        const reduxActionType = 'a redux action';
        const actionId = 'action id';

        it('should dispatch non-scenario action', async () => {
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify({type: reduxActionType}));
            chai.assert.equal(mockStoreDispatch.callCount, 1, 'should have dispatched an action');
            chai.assert.equal(mockStoreDispatch.getCall(0).args[0].type, reduxActionType);
        });

        it('should dispatch scenario action with known headActionIds', async () => {
            const headActionIds = ['known action id'];
            storeState = buildStoreWithTabletopValidation({
                actionHistory: {
                    [headActionIds[0]]: {type: 'some action'}
                }
            });
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify({type: reduxActionType, actionId, headActionIds}));
            chai.assert.equal(mockStoreDispatch.callCount, 3, 'should have dispatched expected actions');
            chai.assert.equal(mockStoreDispatch.getCall(0).args[0].type, reduxActionType, 'should have dispatched provided action');
            chai.assert.equal(mockStoreDispatch.getCall(1).args[0].type, ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS, 'should have updated headActionIds');
            chai.assert.equal(mockStoreDispatch.getCall(2).args[0].type, TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION, 'should have updated headActionIds');
        });

        it('should wait for scenario action with unknown headActionIds and dispatch if unknown action arrives in the meantime', async () => {
            const unknownActionId = 'unknown action id';
            const headActionIds = [unknownActionId];
            storeState = buildStoreWithTabletopValidation({
                actionHistory: {
                    something: {type: 'some action'}
                }
            });
            const promise = peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify({type: reduxActionType, actionId, headActionIds}));
            storeState.undoableState.present.tabletopValidation.actionHistory[unknownActionId] = {type: 'later action'};
            await promise;
            chai.assert.equal(mockStoreDispatch.callCount, 3, 'should have dispatched expected actions');
            chai.assert.equal(mockStoreDispatch.getCall(0).args[0].type, reduxActionType, 'should have dispatched provided action');
            chai.assert.equal(mockStoreDispatch.getCall(1).args[0].type, ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS, 'should have updated headActionIds');
            chai.assert.equal(mockStoreDispatch.getCall(2).args[0].type, TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION, 'should have updated headActionIds');
        });

    });

});