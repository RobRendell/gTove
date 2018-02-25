import Peer from 'peerjs';
import {without} from 'lodash';

const peerToPeerMiddleware = (getConnectIdFromStore, isActionForPeers) => store => next => {
    let peer, connectId, connectedPeers = [];
    return action => {
        // Dispatch the action locally first.
        const result = next(action);
        // Initialise peer-to-peer if necessary
        if (connectId !== getConnectIdFromStore(store.getState())) {
            if (peer) {
                peer.destroy();
            }
            connectId = getConnectIdFromStore(store.getState());
            peer = new Peer(connectId, {key: 'myapikey'});
            // on open, connection, call, close, disconnected, error
            peer.on('connection', (connection) => {
                connectedPeers.push(connection);
                console.log('Added new connection with ' + connection.label);
                connection.on('data', (data) => {
                    // Dispatch actions from peers
                    next(JSON.parse(data));
                });
                connection.on('disconnected', () => {
                    console.log('Lost connection with ' + connection.label);
                    connectedPeers = without(connectedPeers, connection);
                });
            });
        }
        // Now send action to any connected peers, if appropriate.
        if (isActionForPeers(action)) {
            connectedPeers.forEach((connection) => {
                connection.send(action);
            });
        }
        return result;
    };
};

export default peerToPeerMiddleware;