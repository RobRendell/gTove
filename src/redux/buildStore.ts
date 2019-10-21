import {AnyAction, applyMiddleware, createStore, Middleware, Store} from 'redux';
import mainReducer, {
    getConnectedUsersFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore, reduxFirstEnhancer, reduxFirstMiddleware,
    ReduxStoreType
} from './mainReducer';
import {isScenarioAction} from '../util/types';
import {ScenarioReducerActionType, updateHeadActionIdsAction} from './scenarioReducer';
import {setLastCommonScenarioAction} from './tabletopValidationReducer';
import peerToPeerMiddleware from './peerToPeerMiddleware';
import {addConnectedUserAction, removeConnectedUserAction, updateSignalErrorAction} from './connectedUserReducer';
import peerMessageHandler from '../util/peerMessageHandler';
import {composeWithDevTools} from 'redux-devtools-extension';
import thunk from 'redux-thunk';
import {appVersion} from '../util/appVersion';

export default function buildStore(): Store<ReduxStoreType> {

    let store: Store<ReduxStoreType>;

    const onSentMessage = (recipients: string[], action: any) => {
        if (isScenarioAction(action)) {
            store.dispatch(updateHeadActionIdsAction(action));
            store.dispatch(setLastCommonScenarioAction(getScenarioFromStore(store.getState()), action as ScenarioReducerActionType))
        }
    };

    const gTovePeerToPeerMiddleware = peerToPeerMiddleware<ReduxStoreType>({
        getCommsChannel: (state) => ({
            commsChannelId: getLoggedInUserFromStore(state) && getTabletopFromStore(state).gm && getTabletopIdFromStore(state),
            commsStyle: getTabletopFromStore(state).commsStyle
        }),
        peerNodeOptions: {
            onEvents: {
                signal: async (peerNode, peerId, offer) => {
                    store.dispatch(addConnectedUserAction(peerId, {
                        displayName: '...',
                        emailAddress: '',
                        permissionId: 0x333333,
                        icon: offer.type === 'offer' ? 'call_made' : 'call_received'
                    }, appVersion, 0, 0, {groupCamera: {}, layout: {}}));
                },
                connect: async (peerNode, peerId) => {
                    const state = store.getState();
                    const loggedInUser = getLoggedInUserFromStore(state);
                    const deviceLayout = getDeviceLayoutFromStore(state);
                    if (loggedInUser) {
                        await peerNode.sendTo(addConnectedUserAction(peerNode.peerId, loggedInUser, appVersion,
                            window.innerWidth, window.innerHeight, deviceLayout), {only: [peerId]});
                    }
                },
                data: async (peerNode, peerId, data) => peerMessageHandler(store, peerNode, peerId, data),
                close: async (peerNode, peerId) => {
                    store.dispatch(removeConnectedUserAction(peerId));
                },
                signalError: async (_peerNode, error) => {
                    store.dispatch(updateSignalErrorAction(error !== ''));
                }
            }
        },
        getSendToOptions: (action: AnyAction) => {
            if (action.peerKey) {
                const throttleKey = `${action.type}.${action.peerKey}`;
                if (action.gmOnly) {
                    const connectedUsers = getConnectedUsersFromStore(store.getState());
                    const gmClientPeerIds = Object.keys(connectedUsers)
                        .filter((peerId) => (connectedUsers[peerId].verifiedGM));
                    return {throttleKey, onSentMessage, only: gmClientPeerIds};
                } else {
                    return {throttleKey, onSentMessage};
                }
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
                gTovePeerToPeerMiddleware as Middleware
            ),
            reduxFirstEnhancer
        )
    );

    if (module['hot']) {
        // Enable Webpack hot module replacement for reducers
        module['hot'].accept('./mainReducer', () => {
            store.replaceReducer(require('./mainReducer').default);
        });
    }

    return store;

}