import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {CommsNode, CommsStyle, CommsNodeOptions, SendToOptions} from '../util/commsNode';
import {PeerNode} from '../util/peerNode';
import {McastNode} from '../util/mcastNode';
import {setMyPeerIdAction} from './myPeerIdReducer';
import {removeAllConnectedUsersAction} from './connectedUserReducer';

interface PeerToPeerMiddlewareOptions<T> {
    getCommsChannel: (state: T) => {commsChannelId: string | null, commsStyle: CommsStyle, userId?: string};
    commsNodeOptions: CommsNodeOptions;
    getSendToOptions: (commsNode: CommsNode, action: AnyAction) => undefined | Partial<SendToOptions>;
    shouldDispatchLocally?: (action: AnyAction, state: T) => boolean;
}

const peerToPeerMiddleware = <Store>({getCommsChannel, commsNodeOptions = {}, getSendToOptions, shouldDispatchLocally}: PeerToPeerMiddlewareOptions<Store>) => {

    let currentCommsStyle: CommsStyle | null;
    let commsNode: CommsNode | null;

    // If the user closes the browser window, attempt to tell our peers that we're going.
    window.addEventListener('beforeunload', () => {
        commsNode && commsNode.destroy();
    });

    return (api: MiddlewareAPI<Dispatch<AnyAction>, Store>) => (next: Dispatch<AnyAction>) => (action: AnyAction) => {
        let result;
        if (!shouldDispatchLocally || shouldDispatchLocally(action, api.getState())) {
            // Dispatch the action locally first, if appropriate.
            result = next(action);
        }
        // Initialise communication channel if necessary.
        const newState = api.getState();
        const {commsChannelId, commsStyle, userId} = getCommsChannel(newState);
        if (!commsNode && commsChannelId && userId) {
            currentCommsStyle = commsStyle;
            switch (commsStyle) {
                case CommsStyle.PeerToPeer:
                    commsNode = new PeerNode(commsChannelId, userId, commsNodeOptions.onEvents || {}, commsNodeOptions.throttleWait);
                    break;
                case CommsStyle.MultiCast:
                    commsNode = new McastNode(commsChannelId, userId, commsNodeOptions.onEvents || {}, commsNodeOptions.throttleWait);
                    break;
                default:
                    return result;
            }
            // Trigger async initialisation, but don't await the result.
            commsNode.init();
            next(setMyPeerIdAction(commsNode.peerId));
        }
        // Send action to any connected peers, if appropriate.
        if (commsNode && !action.fromPeerId && typeof(action) === 'object') {
            const sendToOptions = getSendToOptions(commsNode, action);
            if (sendToOptions) {
                commsNode.sendTo(action, sendToOptions);
            }
        }
        // Shut down the communication channel if appropriate.
        if (commsNode && (!commsChannelId || commsStyle !== currentCommsStyle)) {
            commsNode.destroy();
            commsNode = null;
            next(removeAllConnectedUsersAction());
            next(setMyPeerIdAction(null));
        }
        return result;
    };
};

export default peerToPeerMiddleware;