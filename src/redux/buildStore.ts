import {AnyAction, applyMiddleware, createStore, Store} from 'redux';
import {composeWithDevTools} from 'redux-devtools-extension';
import createSagaMiddleware from 'redux-saga';
import thunk from 'redux-thunk';

import {appVersion} from '../util/appVersion';
import {CommsNode} from '../util/commsNode';
import peerMessageHandler from '../util/peerMessageHandler';
import {getNetworkHubId, isTabletopLockedForPeer} from '../util/scenarioUtils';
import {isScenarioAction} from '../util/types';
import communicationMiddleware from './communicationMiddleware';
import {addConnectedUserAction, isAllowedUnverifiedAction, removeConnectedUserAction} from './connectedUserReducer';
import {ConnectedUserActionTypes} from './connectedUserReducerTypes';
import {createFirebaseCleanupMiddleware} from './createFirebaseCleanupMiddleware';
import mainReducer, {
    getConnectedUsersFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    reduxFirstEnhancer,
    reduxFirstMiddleware
} from './mainReducer';
import {ReduxStoreType} from './mainReducerTypes';
import {updateHeadActionIdAction} from './scenarioReducer';
import {ScenarioReducerActionType} from './scenarioReducerTypes';
import scenarioSaga from './scenarioSaga';
import {setLastCommonScenarioAction} from './tabletopValidationReducer';

export default function buildStore(): Store<ReduxStoreType> {

    let store: Store<ReduxStoreType>;

    const onSentMessage = (_recipients: string[], action: any) => {
        if (isScenarioAction(action)) {
            store.dispatch(updateHeadActionIdAction(action));
            store.dispatch(setLastCommonScenarioAction(getScenarioFromStore(store.getState()), action as ScenarioReducerActionType))
        }
    };

    const commsMiddleware = communicationMiddleware<ReduxStoreType>({
        getCommsChannel: (state) => {
            const loggedInUser = getLoggedInUserFromStore(state);
            const tabletop = getTabletopFromStore(state);
            // Don't use Firebase communication for offline/local storage users
            if (!loggedInUser || loggedInUser.offline) {
                return {commsChannelId: null, isGM: undefined};
            }
            return {
                commsChannelId: getTabletopFromStore(state).gm && getTabletopIdFromStore(state),
                isGM: tabletop ? loggedInUser.emailAddress === tabletop.gm : undefined
            };
        },
        commsNodeOptions: {
            shouldDispatchLocally: (action, state, commsNode) => {
                const connectedUsers = getConnectedUsersFromStore(state);
                // Don't dispatch actions from unverified peers, unless the action type is allowed.
                if (action.fromPeerId && (!connectedUsers.users[action.fromPeerId] || !connectedUsers.users[action.fromPeerId].verifiedConnection) && !isAllowedUnverifiedAction(action)) {
                    return false;
                }
                // Don't dispatch scenario actions if tabletop is locked for whoever sent the action
                const tabletop = getTabletopFromStore(state);
                if (isScenarioAction(action) && isTabletopLockedForPeer(tabletop, connectedUsers.users, action.fromPeerId || (commsNode ? commsNode.peerId : null), true)) {
                    return false;
                }
                // Don't dispatch playersOnly actions to GM store, or gmOnly actions to player store.
                if (action.playersOnly || action.gmOnly) {
                    const user = getLoggedInUserFromStore(state);
                    return (user !== null && action.gmOnly === (user.emailAddress === tabletop.gm));
                }
                return true;
            },
            onEvents: {
                shouldConnect: (peerNode, peerId, userId) => {
                    const myUserId = peerNode.userId;
                    const gmUserId = getTabletopFromStore(store.getState()).gm;
                    // Players should connect to the GM; GMs should connect to everyone.
                    return (myUserId !== gmUserId && userId === gmUserId) || (myUserId === gmUserId && userId !== undefined);
                },
                connect: async (peerNode) => {
                    const state = store.getState();
                    const loggedInUser = getLoggedInUserFromStore(state)!;
                    const deviceLayout = getDeviceLayoutFromStore(state);
                    await peerNode.sendTo(addConnectedUserAction(peerNode.peerId, loggedInUser, appVersion,
                        window.innerWidth, window.innerHeight, deviceLayout));
                },
                data: async (peerNode, peerId, data) => peerMessageHandler(store, peerNode, peerId, data),
                close: async (peerNode, peerId) => {
                    if (!peerNode.shutdown) {
                        store.dispatch(removeConnectedUserAction(peerId));
                    }
                }
            }
        },
        getSendToOptions: (peerNode: CommsNode, action: AnyAction) => {
            if (action.type === ConnectedUserActionTypes.SET_USER_ALLOWED && action.allowed === false) {
                // Kick the peer's connection
                peerNode.close(action.peerId, 'You cannot connect to that tabletop.');
            }
            const peerKey = action.peerKey || action.meta?.peerKey;
            if (peerKey) {
                const state = store.getState();
                const connectedUsers = getConnectedUsersFromStore(state).users;
                const tabletop = getTabletopFromStore(state);
                if (isScenarioAction(action) && isTabletopLockedForPeer(tabletop, connectedUsers, action.fromPeerId || peerNode.peerId, true)) {
                    // Don't send scenario actions if tabletop is locked for the action's originator.
                    return undefined;
                }
                const networkHubId = getNetworkHubId(peerNode.userId, peerNode.peerId, tabletop.gm, connectedUsers);
                let only: string[] | undefined;
                if (networkHubId === peerNode.peerId) {
                    // Only send actions to verified connections
                    only = Object.keys(connectedUsers).filter((peerId) => (connectedUsers[peerId].verifiedConnection));
                    // Still dispatch actions with playersOnly === true to GMs, as they still need to update their
                    // playerHeadActionIds lists.  Trust their middleware not to dispatch it to their store.
                    if (action.gmOnly) {
                        only = only.filter((peerId) => (connectedUsers[peerId].verifiedGM));
                    }
                } else if (networkHubId) {
                    only = [networkHubId];
                }
                const throttleKey = `${action.type}.${peerKey}`;
                return {throttleKey, onSentMessage, only};
            } else {
                return undefined;
            }
        }
    });

    const firebaseCleanupMiddleware = createFirebaseCleanupMiddleware();

    const sagaMiddleware = createSagaMiddleware();

    store = createStore(mainReducer,
        composeWithDevTools(
            applyMiddleware(
                sagaMiddleware,
                thunk,
                reduxFirstMiddleware,
                commsMiddleware,
                firebaseCleanupMiddleware
            ),
            reduxFirstEnhancer
        )
    );

    sagaMiddleware.run(scenarioSaga);

    // for (let type of ['log', 'warn', 'error']) {
    //     const originalFunc = console[type];
    //     console[type] = function (...args: any[]) {
    //         originalFunc(...args);
    //         window.setTimeout(() => {
    //             store.dispatch(addDebugLogAction(type, args));
    //         }, 1);
    //     }
    // }

    return store;

}