import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {CommsNode, CommsStyle, CommsNodeOptions, SendToOptions} from '../util/commsNode';
import {PeerNode} from '../util/peerNode';
import {McastNode} from '../util/mcastNode';
import {setMyPeerIdAction} from './myPeerIdReducer';
import {removeAllConnectedUsersAction} from './connectedUserReducer';

interface PeerToPeerMiddlewareOptions<T> {
    getCommsChannel: (state: T) => {commsChannelId: string | null, commsStyle: CommsStyle};
    peerNodeOptions: CommsNodeOptions;
    getSendToOptions: (action: AnyAction) => undefined | Partial<SendToOptions>;
}

const peerToPeerMiddleware = <Store>({getCommsChannel, peerNodeOptions = {}, getSendToOptions}: PeerToPeerMiddlewareOptions<Store>) => {

    let currentCommsStyle: CommsStyle | null;
    let commsNode: CommsNode | null;

    // If the user closes the browser window, attempt to tell our peers that we're going.
    window.addEventListener('beforeunload', () => {
        commsNode && commsNode.destroy();
    });

    return (api: MiddlewareAPI<Store>) => (next: Dispatch<Store>) => (action: AnyAction) => {
        // Dispatch the action locally first.
        const result = next(action);
        // Initialise communication channel if necessary.
        const newState = api.getState();
        const {commsChannelId, commsStyle} = getCommsChannel(newState);
        if (!commsNode && commsChannelId) {
            currentCommsStyle = commsStyle;
            switch (commsStyle) {
                case CommsStyle.PeerToPeer:
                    const peerNode = new PeerNode(commsChannelId, peerNodeOptions.onEvents || [], peerNodeOptions.throttleWait);
                    // Trigger async initialisation, but don't await on it.
                    peerNode.init();
                    commsNode = peerNode;
                    break;
                case CommsStyle.MultiCast:
                    commsNode = new McastNode(commsChannelId, peerNodeOptions.onEvents || [], peerNodeOptions.throttleWait);
                    break;
                default:
                    return result;
            }
            next(setMyPeerIdAction(commsNode.peerId));
        }
        // Send action to any connected peers, if appropriate.
        if (commsNode && !action.fromPeerId && typeof(action) === 'object') {
            const sendToOptions = getSendToOptions(action);
            if (sendToOptions) {
                commsNode.sendTo({...action, fromPeerId: commsNode.peerId}, sendToOptions);
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