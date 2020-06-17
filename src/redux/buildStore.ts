import {AnyAction, applyMiddleware, createStore, Store} from 'redux';
import mainReducer, {
    getConnectedUsersFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    reduxFirstEnhancer,
    reduxFirstMiddleware,
    ReduxStoreType
} from './mainReducer';
import {isScenarioAction} from '../util/types';
import {ScenarioReducerActionType, updateHeadActionIdsAction} from './scenarioReducer';
import {setLastCommonScenarioAction} from './tabletopValidationReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import {
    addConnectedUserAction, ConnectedUserActionTypes,
    isAllowedUnverifiedAction,
    removeConnectedUserAction,
    updateSignalErrorAction
} from './connectedUserReducer';
import peerMessageHandler from '../util/peerMessageHandler';
import {composeWithDevTools} from 'redux-devtools-extension';
import thunk from 'redux-thunk';
import {appVersion} from '../util/appVersion';
import {addDebugLogAction} from './debugLogReducer';
import {getNetworkHubId, isTabletopLockedForPeer} from '../util/scenarioUtils';
import {CommsNode} from '../util/commsNode';

export default function buildStore(): Store<ReduxStoreType> {

    let store: Store<ReduxStoreType>;

    const onSentMessage = (recipients: string[], action: any) => {
        if (isScenarioAction(action)) {
            store.dispatch(updateHeadActionIdsAction(action));
            store.dispatch(setLastCommonScenarioAction(getScenarioFromStore(store.getState()), action as ScenarioReducerActionType))
        }
    };

    const gTovePeerToPeerMiddleware = peerToPeerMiddleware<ReduxStoreType>({
        getCommsChannel: (state) => {
            const loggedInUser = getLoggedInUserFromStore(state);
            return {
                commsChannelId: loggedInUser && getTabletopFromStore(state).gm && getTabletopIdFromStore(state),
                commsStyle: getTabletopFromStore(state).commsStyle,
                userId: loggedInUser ? loggedInUser.emailAddress : undefined
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
                signal: async (peerNode, peerId, offer) => {
                    store.dispatch(addDebugLogAction('signal', [`from peerId ${peerId}, offer type ${offer.type}`]));
                },
                connect: async (peerNode, peerId) => {
                    const state = store.getState();
                    const loggedInUser = getLoggedInUserFromStore(state)!;
                    const deviceLayout = getDeviceLayoutFromStore(state);
                    await peerNode.sendTo(addConnectedUserAction(peerNode.peerId, loggedInUser, appVersion,
                        window.innerWidth, window.innerHeight, deviceLayout), {only: [peerId]});
                },
                data: async (peerNode, peerId, data) => peerMessageHandler(store, peerNode, peerId, data),
                close: async (peerNode, peerId) => {
                    if (!peerNode.shutdown) {
                        store.dispatch(removeConnectedUserAction(peerId));
                    }
                },
                signalError: async (_peerNode, error) => {
                    const signalError = (error !== '');
                    if (getConnectedUsersFromStore(store.getState()).signalError !== signalError) {
                        store.dispatch(updateSignalErrorAction(signalError));
                    }
                }
            }
        },
        getSendToOptions: (peerNode: CommsNode, action: AnyAction) => {
            if (action.type === ConnectedUserActionTypes.SET_USER_ALLOWED && action.allowed === false) {
                // Kick the peer's connection
                peerNode.close(action.peerId, 'You cannot connect to that tabletop.');
            }
            if (action.peerKey) {
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
                const throttleKey = `${action.type}.${action.peerKey}`;
                return {throttleKey, onSentMessage, only};
            } else {
                return undefined;
            }
        }
    });

    store = createStore(mainReducer,
        composeWithDevTools(
            applyMiddleware(
                thunk,
                reduxFirstMiddleware,
                gTovePeerToPeerMiddleware
            ),
            reduxFirstEnhancer
        )
    );

    if (module.hot) {
        // Enable Webpack hot module replacement for reducers.
        module.hot.accept('./mainReducer', () => {
            store.replaceReducer(require('./mainReducer').default);
        });
    }

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