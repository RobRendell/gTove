import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {PeerNode, PeerNodeOptions, SendToOptions} from '../util/peerNode';
import {setMyPeerIdAction} from './myPeerIdReducer';

interface PeerToPeerMiddlewareOptions<T> {
    getSignalChannelId: (state: T) => string | null;
    peerNodeOptions: PeerNodeOptions;
    getSendToOptions: (action: AnyAction) => undefined | Partial<SendToOptions>;
}

const peerToPeerMiddleware = <Store>({getSignalChannelId, peerNodeOptions = {}, getSendToOptions}: PeerToPeerMiddlewareOptions<Store>) => {

    let peerNode: PeerNode | null;

    return (api: MiddlewareAPI<Store>) => (next: Dispatch<Store>) => (action: AnyAction) => {
        // Dispatch the action locally first.
        const result = next(action);
        // Initialise peer-to-peer if necessary
        const newState = api.getState();
        const signalChannelId = getSignalChannelId(newState);
        if (!peerNode && signalChannelId) {
            peerNode = new PeerNode(signalChannelId, peerNodeOptions.onEvents || [], peerNodeOptions.throttleWait);
            next(setMyPeerIdAction(peerNode.peerId));
        } else if (peerNode && !signalChannelId) {
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