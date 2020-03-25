import {AnyAction, Store} from 'redux';
import sinon from 'sinon';
import chai from 'chai';

import peerMessageHandler, {
    MessageTypeEnum,
    missingActionMessage,
    resendActionsMessage
} from './peerMessageHandler';
import {ReduxStoreType} from '../redux/mainReducer';
import {CommsNode} from './commsNode';
import tabletopValidationReducer, {
    initialTabletopValidationType,
    TabletopValidationActionTypes
} from '../redux/tabletopValidationReducer';
import {ScenarioReducerActionTypes} from '../redux/scenarioReducer';

describe('peerMessageHandler', () => {

    const myPeerId = 'my-peer-id';
    const theirPeerId = 'their-peer-id';

    const pendingActionId = 'received action';

    let storeState: ReduxStoreType;
    let mockStoreDispatch: sinon.SinonStub;
    let mockStore: Store<ReduxStoreType>;
    let mockCommsNodeSendTo: sinon.SinonStub;
    let mockCommsNode: CommsNode;

    beforeEach(() => {
        storeState = {tabletop: {gm: 'gm email'}, connectedUsers: {users: {}}, loggedInUser: {user: {emailAddress: 'user email'}}} as any;
        mockStoreDispatch = sinon.stub();
        mockStore = {getState: () => (storeState), dispatch: mockStoreDispatch} as any;
        mockCommsNodeSendTo = sinon.stub();
        mockCommsNode = {sendTo: mockCommsNodeSendTo, peerId: myPeerId} as any;
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
            storeState = {
                ...storeState,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    actionHistory: {
                        [headActionIds[0]]: {type: 'some action'}
                    }
                }
            };
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify({type: reduxActionType, actionId, headActionIds}));
            chai.assert.equal(mockStoreDispatch.callCount, 3, 'should have dispatched expected actions');
            chai.assert.equal(mockStoreDispatch.getCall(0).args[0].type, reduxActionType, 'should have dispatched provided action');
            chai.assert.equal(mockStoreDispatch.getCall(1).args[0].type, ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS, 'should have updated headActionIds');
            chai.assert.equal(mockStoreDispatch.getCall(2).args[0].type, TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION, 'should have updated headActionIds');
        });

        it('should wait for scenario action with unknown headActionIds and dispatch if unknown action arrives in the meantime', async () => {
            const unknownActionId = 'unknown action id';
            const headActionIds = [unknownActionId];
            storeState = {
                ...storeState,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    actionHistory: {
                        something: {type: 'some action'}
                    }
                }
            };
            const promise = peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify({type: reduxActionType, actionId, headActionIds}));
            storeState.tabletopValidation.actionHistory[unknownActionId] = {type: 'later action'};
            await promise;
            chai.assert.equal(mockStoreDispatch.callCount, 3, 'should have dispatched expected actions');
            chai.assert.equal(mockStoreDispatch.getCall(0).args[0].type, reduxActionType, 'should have dispatched provided action');
            chai.assert.equal(mockStoreDispatch.getCall(1).args[0].type, ScenarioReducerActionTypes.UPDATE_HEAD_ACTION_IDS, 'should have updated headActionIds');
            chai.assert.equal(mockStoreDispatch.getCall(2).args[0].type, TabletopValidationActionTypes.SET_LAST_COMMON_SCENARIO_ACTION, 'should have updated headActionIds');
        });

        it('should wait for scenario action with unknown headActionIds and request actions from peer after timeout', async () => {
            const unknownActionId = 'unknown action id';
            const headActionIds = [unknownActionId];
            storeState = {
                ...storeState,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    actionHistory: {
                        something: {type: 'some action'}
                    },
                    initialActionIds: {
                        loadedActionId: true
                    }
                }
            };
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify({type: reduxActionType, actionId, headActionIds}));
            chai.assert.equal(mockStoreDispatch.callCount, 1, 'should have dispatched expected actions');
            chai.assert.equal(mockStoreDispatch.getCall(0).args[0].type, TabletopValidationActionTypes.ADD_PENDING_ACTION_ACTION, 'should have added action to pending list');
            chai.assert.equal(mockCommsNodeSendTo.callCount, 1, 'should have sent a message');
            chai.assert.equal(mockCommsNodeSendTo.getCall(0).args[1].only, theirPeerId, 'message should be sent to peer who send action');
            const {message, missingActionIds, knownActionIds} = mockCommsNodeSendTo.getCall(0).args[0];
            chai.assert.equal(message, MessageTypeEnum.MISSING_ACTION_MESSAGE, 'should have reported missing actions');
            chai.assert.lengthOf(missingActionIds, 1);
            chai.assert.equal(missingActionIds[0], unknownActionId);
            chai.assert.lengthOf(knownActionIds, 2);
            chai.assert.equal(knownActionIds[0], 'something');
            chai.assert.equal(knownActionIds[1], 'loadedActionId');
        });

    });

    describe('with MissingActionMessage', () => {

        const missingActionId = 'missing action';
        const commonActionId = 'common action';

        it('should send ResendActionMessage with missing action if known', async () => {
            storeState = {
                ...storeState,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    actionHistory: {
                        [missingActionId]: {type: 'some action'},
                        [commonActionId]: {type: 'other thing'}
                    }
                }
            };
            const receivedMessage = missingActionMessage([missingActionId], [commonActionId], pendingActionId);
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify(receivedMessage));
            chai.assert.equal(mockCommsNodeSendTo.callCount, 1, 'should have sent a reply');
            chai.assert.equal(mockCommsNodeSendTo.getCall(0).args[1].only, theirPeerId, 'should have sent a reply to peer who sent message');
            const {message, missingActionIds, actions} = mockCommsNodeSendTo.getCall(0).args[0];
            chai.assert.equal(message, MessageTypeEnum.RESEND_ACTIONS_MESSAGE);
            chai.assert.lengthOf(missingActionIds, 1);
            chai.assert.equal(missingActionIds[0], missingActionId);
            chai.assert.isNotNull(actions);
            chai.assert.lengthOf(Object.keys(actions), 1);
            chai.assert.exists(actions[missingActionId]);
        });

        it('should send ResendActionMessage with all missing scenario actions if known', async () => {
            const actionId1 = 'action1';
            const actionId2 = 'action2';
            const actionId3 = 'action3';
            storeState = {
                ...storeState,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    actionHistory: {
                        [missingActionId]: {type: 'some action', actionId: missingActionId, headActionIds: [actionId1, actionId2]},
                        [actionId1]: {type: 'xyzzy', actionId: actionId1, headActionIds: [actionId2, commonActionId]},
                        [actionId2]: {type: 'plugh', actionId: actionId2, headActionIds: [actionId3]},
                        [actionId3]: {type: 'plover', actionId: actionId3, headActionIds: [commonActionId]},
                        [commonActionId]: {type: 'other thing'}
                    }
                }
            };
            const receivedMessage = missingActionMessage([missingActionId], [commonActionId], pendingActionId);
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify(receivedMessage));
            chai.assert.equal(mockCommsNodeSendTo.callCount, 1, 'should have sent a reply');
            chai.assert.equal(mockCommsNodeSendTo.getCall(0).args[1].only, theirPeerId, 'should have sent a reply to peer who sent message');
            const {message, missingActionIds, actions} = mockCommsNodeSendTo.getCall(0).args[0];
            chai.assert.equal(message, MessageTypeEnum.RESEND_ACTIONS_MESSAGE);
            chai.assert.lengthOf(missingActionIds, 1);
            chai.assert.equal(missingActionIds[0], missingActionId);
            chai.assert.isNotNull(actions);
            chai.assert.lengthOf(Object.keys(actions), 4);
            chai.assert.exists(actions[missingActionId]);
            chai.assert.exists(actions[actionId1]);
            chai.assert.exists(actions[actionId2]);
            chai.assert.exists(actions[actionId3]);
        });

        it('should send ResendActionMessage with null if any actions are unknown', async () => {
            const actionId1 = 'action1';
            const actionId2 = 'action2';
            const actionId3 = 'action3';
            storeState = {
                ...storeState,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    actionHistory: {
                        [missingActionId]: {type: 'some action', actionId: missingActionId, headActionIds: [actionId1, actionId2]},
                        [actionId1]: {type: 'xyzzy', actionId: actionId1, headActionIds: [actionId2, commonActionId]},
                        [actionId2]: {type: 'plugh', actionId: actionId2, headActionIds: [actionId3]},
                        [actionId3]: {type: 'plover', actionId: actionId3, headActionIds: ['unknown action Id']},
                        [commonActionId]: {type: 'other thing'}
                    }
                }
            };
            const receivedMessage = missingActionMessage([missingActionId], [commonActionId], pendingActionId);
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify(receivedMessage));
            chai.assert.equal(mockCommsNodeSendTo.callCount, 1, 'should have sent a reply');
            chai.assert.equal(mockCommsNodeSendTo.getCall(0).args[1].only, theirPeerId, 'should have sent a reply to peer who sent message');
            const {message, missingActionIds, actions} = mockCommsNodeSendTo.getCall(0).args[0];
            chai.assert.equal(message, MessageTypeEnum.RESEND_ACTIONS_MESSAGE);
            chai.assert.lengthOf(missingActionIds, 1);
            chai.assert.equal(missingActionIds[0], missingActionId);
            chai.assert.isNull(actions);
        });

    });

    describe('with ResendActionMessage', () => {

        const commonActionId = 'common action';
        const actionId1 = 'action1';
        const actionId2 = 'action2';
        const actionId3 = 'action3';

        it('should dispatch re-sent and pending actions in correct order', async () => {
            // This test requires a Redux dispatch function which updates tabletopValidation
            const spyDispatch = sinon.spy((action: AnyAction) => {
                storeState.tabletopValidation = tabletopValidationReducer(storeState.tabletopValidation, action as any);
            });
            mockStore.dispatch = spyDispatch;
            const pendingAction = {type: 'some action', actionId: pendingActionId, headActionIds: [actionId1, actionId2]};
            storeState = {
                ...storeState,
                tabletopValidation: {
                    ...initialTabletopValidationType,
                    actionHistory: {
                        [commonActionId]: {type: 'other thing'}
                    },
                    pendingActions: {
                        [pendingActionId]: pendingAction,
                        otherAction: {type: 'other missing action', actionId: 'otherAction', headActionIds: ['unrelated action']}
                    }
                }
            };
            const receivedMessage = resendActionsMessage([actionId1, actionId2], {
                [actionId1]: {type: 'xyzzy', actionId: actionId1, headActionIds: [actionId2, commonActionId]},
                [actionId2]: {type: 'plugh', actionId: actionId2, headActionIds: [actionId3]},
                [actionId3]: {type: 'plover', actionId: actionId3, headActionIds: [commonActionId]},
            }, pendingActionId);
            await peerMessageHandler(mockStore, mockCommsNode, theirPeerId, JSON.stringify(receivedMessage));
            chai.assert.equal(spyDispatch.callCount, 12, 'should have dispatched 3 actions per missing action');
            chai.assert.equal(spyDispatch.getCall(0).args[0].actionId, actionId3);
            chai.assert.equal(spyDispatch.getCall(3).args[0].actionId, actionId2);
            chai.assert.equal(spyDispatch.getCall(6).args[0].actionId, actionId1);
            chai.assert.equal(spyDispatch.getCall(9).args[0].actionId, pendingActionId);
        });

    });

});