import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {CommsNode, CommsNodeOptions, SendToOptions} from '../util/commsNode';
import {FirebaseNode} from '../util/firebaseNode';
import {setMyPeerIdAction} from './myPeerIdReducer';
import {removeAllConnectedUsersAction} from './connectedUserReducer';

interface CommunicationMiddlewareOptions<T> {
    getCommsChannel: (state: T) => {commsChannelId: string | null, isGM?: boolean};
    commsNodeOptions: CommsNodeOptions;
    getSendToOptions: (commsNode: CommsNode, action: AnyAction) => undefined | Partial<SendToOptions>;
    shouldDispatchLocally?: (action: AnyAction, state: T) => boolean;
}

const communicationMiddleware = <StoreType>({getCommsChannel, commsNodeOptions = {}, getSendToOptions}: CommunicationMiddlewareOptions<StoreType>) => {

    let commsNode: CommsNode | null;

    // If the user closes the browser window, attempt to tell our peers that we're going.
    window.addEventListener('beforeunload', () => {
        commsNode && commsNode.destroy();
    });

    return (api: MiddlewareAPI<Dispatch, StoreType>) => (next: Dispatch<AnyAction>) => (action: AnyAction) => {
        let result;
        if (!commsNodeOptions.shouldDispatchLocally || commsNodeOptions.shouldDispatchLocally(action, api.getState(), commsNode)) {
            // Dispatch the action locally first, if appropriate.
            result = next(action);
        }
        // Initialise communication channel if necessary.
        const newState = api.getState();
        const {commsChannelId, isGM} = getCommsChannel(newState);
        if (!commsNode) {
            if (commsChannelId && isGM !== undefined) {
                commsNode = new FirebaseNode(commsChannelId, isGM, commsNodeOptions);
                // Trigger async initialisation, but don't await the result.
                commsNode.init();
                next(setMyPeerIdAction(commsNode.peerId));
            }
        } else if (!commsChannelId) {
            // Shut down the communication channel
            commsNode.destroy();
            commsNode = null;
            next(removeAllConnectedUsersAction());
            next(setMyPeerIdAction(null));
        } else if (!action.fromPeerId && typeof(action) === 'object') {
            // Send action to any connected peers.
            const sendToOptions = getSendToOptions(commsNode, action);
            if (sendToOptions) {
                commsNode.sendTo(action, sendToOptions);
            }

        }
        return result;
    };
};

export default communicationMiddleware;