import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {PeerNode, PeerNodeOptions, SendToOptions} from '../util/peerNode';
import {setMyPeerIdAction} from './myPeerIdReducer';

interface PeerToPeerMiddlewareOptions<T> {
    getSignalChannelId: (state: T) => string | null;
    shouldDisconnect: (state: T) => boolean;
    peerNodeOptions: PeerNodeOptions;
    getSendToOptions: (action: AnyAction) => undefined | Partial<SendToOptions>;
}

const peerToPeerMiddleware = <Store>({getSignalChannelId, shouldDisconnect, peerNodeOptions = {}, getSendToOptions}: PeerToPeerMiddlewareOptions<Store>) => {

    let peerNode: PeerNode | null;

    return (api: MiddlewareAPI<Store>) => (next: Dispatch<Store>) => (action: AnyAction) => {
        // Dispatch the action locally first.
        const result = next(action);
        // Initialise peer-to-peer if necessary
        const newState = api.getState();
        if (!peerNode) {
            const signalChannelId = getSignalChannelId(newState);
            if (signalChannelId) {
                peerNode = new PeerNode(signalChannelId, peerNodeOptions.onEvents || [], peerNodeOptions.throttleWait);
                next(setMyPeerIdAction(peerNode.peerId));
            }
        } else if (shouldDisconnect(newState)) {
            peerNode.disconnectAll();
            next(setMyPeerIdAction(null));
            peerNode = null;
        }
        // Now send action to any connected peers, if appropriate.
        if (peerNode && !action.fromPeerId && typeof(action) === 'object') {
            const sendToOptions = getSendToOptions(action);
            if (sendToOptions) {
                peerNode.sendTo({...action, fromPeerId: peerNode.peerId}, sendToOptions);
            }
        }
        return result;
    };
};

export default peerToPeerMiddleware;