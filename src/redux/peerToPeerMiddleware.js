import {PeerNode} from '../util/peerNode';

const peerToPeerMiddleware = ({getSignalChannelId, getThrottleKey, shouldDisconnect, peerNodeOptions = {}}) => {

    let peerNode;

    return store => next => action => {
        // Dispatch the action locally first.
        const result = next(action);
        // Initialise peer-to-peer if necessary
        if (!peerNode) {
            const signalChannelId = getSignalChannelId(store.getState());
            if (signalChannelId) {
                peerNode = new PeerNode(signalChannelId, [
                    ...(peerNodeOptions.onEvents || []),
                    {event: 'data', callback: (peerNode, peerId, data) => (store.dispatch(JSON.parse(data)))}
                ], peerNodeOptions.throttleWait);
            }
        } else if (shouldDisconnect(store.getState())) {
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