import {v4} from 'uuid';
import {memoize, throttle} from 'lodash';
import {serverTimestamp, Unsubscribe} from 'firebase/database';
import {getAuth} from 'firebase/auth';
import {toast} from 'react-toastify';

import {CommsNode, CommsNodeOptions, SendToOptions} from './commsNode';
import {firebaseApp} from './storage/providers/google/googleAPI';
import {
    child,
    get,
    getDatabase,
    onChildAdded,
    onChildRemoved,
    push,
    ref,
    remove,
    runTransaction,
    set,
    TypedDatabase,
    TypedDatabaseReference
} from './typedFirebase';
import {TabletopValidationActionTypes} from '../redux/tabletopValidationReducer';

export interface GToveFirebaseDB {
    tabletop: {
        [tabletopId: string] : {
            gm?: string;
            users?: {
                [clientId: string]: {
                    userId: string;
                    heartbeatTimestamp: number;
                }
            };
            actions?: {
                [id: string]: {
                    json: string;
                    fromClientId: string;
                }
            };
            gmActions?: {
                [id: string]: {
                    json: string;
                    fromClientId: string;
                }
            };
        }
    }
}

interface CleanUpQueue {
    ids: string[];
    lastIndex?: number;
}

export class FirebaseNode extends CommsNode {

    private readonly memoizedThrottle: (key: string, func: (...args: any[]) => any) => (...args: any[]) => any;
    private readonly realTimeDB: TypedDatabase<GToveFirebaseDB>;
    private readonly channelId: string;
    private readonly isGM: boolean;

    private cleanUpQueuePlayer?: CleanUpQueue;
    private cleanUpQueueGM?: CleanUpQueue;
    private cleanUpPromiseChain?: Promise<void>;

    private unsubscribe: (Unsubscribe | undefined)[] = [];
    private heartbeatCallback: number | undefined = undefined;

    /**
     * @param channelId The unique string used to identify the tabletop being shared.  All FirebaseNodes with the same
     * channelId will signal each other and connect.
     * @param isGM True if this user is the GM.
     * @param commsNodeOptions The options this node is initialised with
     */
    constructor(channelId: string, isGM: boolean, commsNodeOptions: CommsNodeOptions) {
        super();
        this.peerId = v4();
        this.channelId = channelId;
        this.isGM = isGM;
        this.userId = getAuth().currentUser!.uid!;
        this.options = commsNodeOptions;
        if (isGM) {
            this.cleanUpQueuePlayer = {ids: []};
            this.cleanUpQueueGM = {ids: []};
        }
        const throttleWait = commsNodeOptions.throttleWait || 250;
        // Create a memoized throttle function wrapper.  Calls with the same (truthy) throttleKey will be throttled so
        // the function is called at most once each throttleWait milliseconds.  This is used to wrap the send function,
        // so things like dragging minis doesn't flood the connection - since each position update supersedes the
        // previous one, we don't need to send every intermediate value.
        this.memoizedThrottle = memoize((throttleKey, func) => (throttle(func, throttleWait)));
        this.sendToRaw = this.sendToRaw.bind(this);
        this.realTimeDB = getDatabase<GToveFirebaseDB>(firebaseApp);
    }

    async init(): Promise<void> {
        if (this.isGM) {
            const gmRef = ref(this.realTimeDB, `tabletop/${this.channelId}/gm`);
            if (!(await get(gmRef)).exists()) {
                await set(gmRef, this.userId);
            }
        }
        const usersRef = ref(this.realTimeDB, `tabletop/${this.channelId}/users`);
        await set(child(usersRef, this.peerId), {
            userId: this.userId,
            heartbeatTimestamp: serverTimestamp() as any // placeholder value to auto-populate the current timestamp
        });
        this.unsubscribe = [
            onChildAdded(usersRef, async (snapshot) => {
                const otherPeerId = snapshot.key!;
                if (otherPeerId !== this.peerId) {
                    console.log('Establishing connection with', otherPeerId);
                    await this.options.onEvents?.connect?.(this, otherPeerId);
                    if (this.isGM) {
                        const {heartbeatTimestamp} = snapshot.val();
                        // Use our own heartbeatTimestamp to determine if other connections are stale or not, rather than
                        // Date.now(), to avoid issues with clock skew between the Firebase server and our client.
                        const myHeartbeatTimestamp = (
                            await get(ref(this.realTimeDB, `tabletop/${this.channelId}/users/${this.peerId}/heartbeatTimestamp`))
                        ).val()!;
                        if (heartbeatTimestamp < myHeartbeatTimestamp - 2 * FirebaseNode.HEARTBEAT_INTERVAL_MS) {
                            console.log('Removing stale connection for', otherPeerId)
                            // Connection is stale, so delete it
                            await remove(snapshot.ref);
                        }
                    }
                }
            }),
            onChildRemoved(usersRef, async (snapshot) => {
                const otherPeerId = snapshot.key!;
                if (otherPeerId === this.peerId) {
                    // We were apparently timed out, possibly while the tab was suspended in the background. Reconnect,
                    // but do it in a timeout so our onChildRemoved callback concludes first.
                    setTimeout(async () => {
                        console.log('Detected that our user node was deleted, reconnecting', this.peerId)
                        toast('Reconnecting...');
                        // Add our node again.
                        await set(child(usersRef, this.peerId), {
                            userId: this.userId,
                            heartbeatTimestamp: serverTimestamp() as any // placeholder value to auto-populate the current timestamp
                        });
                        // Also re-send our details to other clients, as they will have cleared them.
                        const allUsers = await get(usersRef);
                        for (const otherPeerId in allUsers.val()) {
                            if (otherPeerId !== this.peerId) {
                                await this.options.onEvents?.connect?.(this, otherPeerId);
                            }
                        }
                    }, 1);
                } else {
                    console.log('Connection timed out, disconnecting from', otherPeerId)
                    await this.options.onEvents?.close?.(this, otherPeerId);
                }
            }),
            onChildAdded(ref(this.realTimeDB, `tabletop/${this.channelId}/actions`), ((snapshot) => {
                const {json, fromClientId} = snapshot.val();
                if (fromClientId !== this.peerId) {
                    this.options.onEvents?.data?.(this, fromClientId, json);
                }
                if (snapshot.key && this.cleanUpQueuePlayer) {
                    this.cleanUpQueuePlayer.ids.push(snapshot.key);
                    if (json.includes(`"type":"${TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_ID_ACTION}"`)) {
                        this.cleanUpQueuePlayer.lastIndex = this.cleanUpQueuePlayer.ids.length - 1;
                    }
                }
            })),
            !this.isGM
                ? undefined
                : onChildAdded(ref(this.realTimeDB, `tabletop/${this.channelId}/gmActions`), ((snapshot) => {
                    const {json, fromClientId} = snapshot.val();
                    if (fromClientId !== this.peerId) {
                        this.options.onEvents?.data?.(this, fromClientId, json);
                    }
                    if (snapshot.key && this.cleanUpQueueGM) {
                        this.cleanUpQueueGM.ids.push(snapshot.key);
                        if (json.includes(`"type":"${TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_ID_ACTION}"`)) {
                            this.cleanUpQueueGM.lastIndex = this.cleanUpQueueGM.ids.length - 1;
                        }
                    }
            }))
        ];
        this.startHeartbeat();
        console.log(`Created Firebase communication node with id ${this.peerId}`);
    }

    startHeartbeat() {
        if (this.heartbeatCallback === undefined) {
            this.heartbeatCallback =
                window.setInterval(this.heartbeat.bind(this), CommsNode.HEARTBEAT_INTERVAL_MS);
        }
    }

    private async sendToRaw(message: object, gmOnly: boolean, onSentMessage?: (recipients: string[], message: string | object) => void): Promise<void> {
        // JSON has no "undefined" value, so if JSON-stringifying, convert undefined values to null.
        const json: string = (typeof(message) === 'object') ?
            JSON.stringify(message, (k, v) => (v === undefined ? null : v)) : message;
        if (gmOnly) {
            await push(ref(this.realTimeDB, `tabletop/${this.channelId}/gmActions`), {json, fromClientId: this.peerId});
        } else {
            await push(ref(this.realTimeDB, `tabletop/${this.channelId}/actions`), {json, fromClientId: this.peerId});
        }
        onSentMessage?.([], message);
    }

    async sendTo(message: object, {throttleKey, onSentMessage}: SendToOptions = {}): Promise<void> {
        if (this.isGM) {
            const actionType = (message as any)['type'] as string | undefined;
            // We can clean up actions from the RTDB that predate the saved tabletop.
            if (actionType === TabletopValidationActionTypes.SET_LAST_SAVED_HEAD_ACTION_ID_ACTION) {
                await this.cleanUpActions(ref(this.realTimeDB, `tabletop/${this.channelId}/gmActions`), this.cleanUpQueueGM);
            } else if (actionType === TabletopValidationActionTypes.SET_LAST_SAVED_PLAYER_HEAD_ACTION_ID_ACTION) {
                await this.cleanUpActions(ref(this.realTimeDB, `tabletop/${this.channelId}/actions`), this.cleanUpQueuePlayer);
            }
        }
        const gmOnly = (message as any)['gmOnly'] ?? false;
        if (throttleKey) {
            await this.memoizedThrottle(throttleKey, this.sendToRaw)(message, gmOnly, onSentMessage);
        } else {
            await this.sendToRaw(message, gmOnly, onSentMessage);
        }
    }

    async close(peerId: string, reason?: string): Promise<void> {
        console.log('Lost connection with', peerId, reason);
    }

    async isPeerIdValid(peerId: string): Promise<boolean> {
        const userRef = ref(this.realTimeDB, `tabletop/${this.channelId}/users/${peerId}`)
        const snapshot = await get(userRef);
        return snapshot.exists();
    }

    async destroy(): Promise<void> {
        console.log('Shutting down Firebase node', this.peerId);
        await remove(ref(this.realTimeDB, `tabletop/${this.channelId}/users/${this.peerId}`));
        if (this.heartbeatCallback !== undefined) {
            clearInterval(this.heartbeatCallback);
            this.heartbeatCallback = undefined;
        }
        this.options.onEvents?.close?.(this, this.peerId);
        this.unsubscribe.forEach((callback) => (callback?.()));
    }

    async disconnectAll(): Promise<void> {
        await this.destroy();
    }

    async heartbeat() {
        await runTransaction(
            ref(this.realTimeDB, `tabletop/${this.channelId}/users/${this.peerId}/heartbeatTimestamp`),
            (currentValue) => (
                // Only set my heartbeat if it exists.
                currentValue === null ? undefined : serverTimestamp() as any
            )
        );
        if (this.isGM) {
            // Time out peers whose heartbeat has stopped.
            const allUsers = (
                await get(ref(this.realTimeDB, `tabletop/${this.channelId}/users`))
            ).val();
            if (allUsers?.[this.peerId]) {
                // Calculate the cutoff timestamp using the server-set timestamp we just set on our own heartbeat, to
                // avoid issues with clock skew between clients and the server.
                const cutoff = allUsers[this.peerId].heartbeatTimestamp - 2 * FirebaseNode.HEARTBEAT_INTERVAL_MS;
                // Remove any peers whose heartbeat hasn't been updated in several intervals.
                await Promise.all(Object.keys(allUsers)
                    .filter((peerId) => (allUsers[peerId].heartbeatTimestamp < cutoff))
                    .map((peerId) => (remove(ref(this.realTimeDB, `tabletop/${this.channelId}/users/${peerId}`))))
                );
            }
        }
    }

    /**
     * The network hub has saved the tabletop, so delete actions which are older than the last time the tabletop was
     * saved.
     */
    async cleanUpActions(
        firebaseRef: TypedDatabaseReference<{[id: string]: {json: string; fromClientId: string}}, GToveFirebaseDB>,
        cleanUpQueue?: CleanUpQueue,
    ) {
        if (cleanUpQueue?.lastIndex !== undefined) {
            const toDeleteIds = cleanUpQueue.ids.slice(0, cleanUpQueue.lastIndex);
            cleanUpQueue.ids = cleanUpQueue.ids.slice(cleanUpQueue.lastIndex);
            cleanUpQueue.lastIndex = undefined;
            // Batch up the deletion of the ids.
            if (!this.cleanUpPromiseChain) {
                this.cleanUpPromiseChain = Promise.resolve();
            }
            const batchSize = 50;
            for (let batch = 0; batch < toDeleteIds.length; batch += batchSize) {
                this.cleanUpPromiseChain = this.cleanUpPromiseChain
                    .then(async () => {
                        await Promise.all(
                            toDeleteIds.slice(batch, batch + batchSize)
                                .map((id) => (
                                    remove(child(firebaseRef, id))
                                ))
                        );
                    });
            }
            const promiseChainBefore = this.cleanUpPromiseChain;
            await this.cleanUpPromiseChain;
            if (this.cleanUpPromiseChain === promiseChainBefore) {
                this.cleanUpPromiseChain = undefined;
            }
        }
    }
}
