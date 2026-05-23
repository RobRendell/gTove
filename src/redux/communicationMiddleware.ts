import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {CommsNode, CommsNodeConstructor, CommsNodeOptions, SendToOptions} from '../util/commsNode';
import {removeAllConnectedUsersAction} from './connectedUserReducer';
import {setMyPeerIdAction} from './myPeerIdReducer';

let commsNodeClass: null | CommsNodeConstructor = null

export function setCommsNodeClass(ctor: null | CommsNodeConstructor) {
    commsNodeClass = ctor;
}

interface CommunicationMiddlewareOptions<T> {
    getCommsChannel: (state: T) => {commsChannelId: string | null, isGM?: boolean};
    commsNodeOptions: CommsNodeOptions;
    getSendToOptions: (commsNode: CommsNode, action: AnyAction) => undefined | Partial<SendToOptions>;
    onLocalAction?: (action: AnyAction) => void;
    shouldDispatchLocally?: (action: AnyAction, state: T) => boolean;
}

const communicationMiddleware = <StoreType>(
    {
        getCommsChannel,
        commsNodeOptions = {},
        getSendToOptions,
        onLocalAction,
    }: CommunicationMiddlewareOptions<StoreType>) => {

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
            if (commsChannelId && isGM !== undefined && commsNodeClass) {
                commsNode = new commsNodeClass(commsChannelId, isGM, commsNodeOptions);
                // Trigger async initialisation, but don't await the result.
                void commsNode.init();
                next(setMyPeerIdAction(commsNode.peerId));
            } else if (onLocalAction && !action.fromPeerId) {
                onLocalAction(action);
            }
        } else if (!commsChannelId || !commsNodeClass) {
            // Shut down the communication channel
            void commsNode.destroy();
            commsNode = null;
            next(removeAllConnectedUsersAction());
            next(setMyPeerIdAction(null));
        } else if (!action.fromPeerId && typeof(action) === 'object') {
            // Send action to any connected peers.
            const sendToOptions = getSendToOptions(commsNode, action);
            if (sendToOptions) {
                void commsNode.sendTo(action, sendToOptions);
            }
        }
        return result;
    };
};

export default communicationMiddleware;