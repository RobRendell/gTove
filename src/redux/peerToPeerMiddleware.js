import {PeerNode} from '../util/peerNode';

class ReduxMiddlewarePeerNode extends PeerNode {

    constructor(signalChannelId, dispatch) {
        super(signalChannelId);
        this.dispatch = dispatch;
    }

    onData(peerId, data) {
        this.dispatch(JSON.parse(data));
    }
}

const peerToPeerMiddleware = ({getSignalChannelId, getThrottleKey}) => store => next => {

    let peerNode;

    return action => {
        // Dispatch the action locally first.
        const result = next(action);
        // Initialise peer-to-peer if necessary
        if (!peerNode) {
            const signalChannelId = getSignalChannelId(store.getState());
            if (signalChannelId) {
                peerNode = new ReduxMiddlewarePeerNode(signalChannelId, store.dispatch);
            }
        }
        // Now send action to any connected peers, if appropriate.
        const throttleKey = getThrottleKey(action);
        if (peerNode && !action.fromPeerId && throttleKey) {
            peerNode.sendTo({...action, fromPeerId: peerNode.peerId}, {throttleKey});
        }
        return result;
    };
};

export default peerToPeerMiddleware;