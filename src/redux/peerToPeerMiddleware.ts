import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {PeerNode, PeerNodeOptions} from '../util/peerNode';

interface PeerToPeerMiddlewareOptions<T> {
    getSignalChannelId: (state: T) => string | null;
    shouldDisconnect: (state: T) => boolean;
    getThrottleKey: (action: AnyAction) => string | undefined;
    peerNodeOptions: PeerNodeOptions;
    onSentMessage?: (store: T, recipients: string[], message: object | string) => void;
}

const peerToPeerMiddleware = <Store>({getSignalChannelId, getThrottleKey, shouldDisconnect, peerNodeOptions = {}, onSentMessage}: PeerToPeerMiddlewareOptions<Store>) => {

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
            }
        } else if (shouldDisconnect(newState)) {
            peerNode.disconnectAll();
            peerNode = null;
        }
        // Now send action to any connected peers, if appropriate.
        const throttleKey = getThrottleKey(action);
        if (peerNode && !action.fromPeerId && throttleKey && typeof(action) === 'object') {
            // JSON has no "undefined" value - convert undefined values to null.
            const message = JSON.stringify({...action, fromPeerId: peerNode.peerId}, (k, v) => (v === undefined ? null : v));
            peerNode.sendTo(message, {throttleKey, onSentMessage: onSentMessage ? (recipients) => {
                onSentMessage(newState, recipients, message);
            } : undefined});
        }
        return result;
    };
};

export default peerToPeerMiddleware;