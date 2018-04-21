import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {PeerNode, PeerNodeOptions} from '../util/peerNode';

interface PeerToPeerMiddlewareOptions<T> {
    getSignalChannelId: (state: T) => string | null;
    shouldDisconnect: (state: T) => boolean;
    getThrottleKey: (action: AnyAction) => string | undefined;
    peerNodeOptions: PeerNodeOptions;
}

const peerToPeerMiddleware = <Store>({getSignalChannelId, getThrottleKey, shouldDisconnect, peerNodeOptions = {}}: PeerToPeerMiddlewareOptions<Store>) => {

    let peerNode: PeerNode | null;

    return (api: MiddlewareAPI<Store>) => (next: Dispatch<Store>) => (action: AnyAction) => {
        // Dispatch the action locally first.
        const result = next(action);
        // Initialise peer-to-peer if necessary
        if (!peerNode) {
            const signalChannelId = getSignalChannelId(api.getState());
            if (signalChannelId) {
                peerNode = new PeerNode(signalChannelId, [
                    ...(peerNodeOptions.onEvents || []),
                    {event: 'data', callback: (peerNode, peerId, data) => (api.dispatch(JSON.parse(data)))}
                ], peerNodeOptions.throttleWait);
            }
        } else if (shouldDisconnect(api.getState())) {
            peerNode.disconnectAll();
            peerNode = null;
        }
        // Now send action to any connected peers, if appropriate.
        const throttleKey = getThrottleKey(action);
        if (peerNode && !action.fromPeerId && throttleKey && typeof(action) === 'object') {
            peerNode.sendTo({...action, fromPeerId: peerNode.peerId}, {throttleKey});
        }
        return result;
    };
};

export default peerToPeerMiddleware;