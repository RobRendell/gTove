import {AnyAction, Dispatch, Middleware} from 'redux';

import {getDatabase, ref, remove} from '../util/typedFirebase';
import {firebaseApp} from '../util/storage/providers/google/googleAPI';
import {GToveFirebaseDB} from '../util/firebaseNode';
import {FileIndexActionTypes} from './fileIndexReducer';

/**
 * This middleware's functionality can't be incorporated into firebaseNode, since that only does things when we're on a
 * tabletop, and this middleware needs to clean up even if we're outside any tabletop.
 */
export const createFirebaseCleanupMiddleware: () => Middleware = () => {

    const realTimeDB = getDatabase<GToveFirebaseDB>(firebaseApp);

    return () => (next: Dispatch) => (action: AnyAction) => {
        if (action.type === FileIndexActionTypes.REMOVE_FILE_ACTION) {
            // Might have removed a tabletop, which needs to be cleaned up in Firebase
            const fileId = action.fileId;
            // Metadata IDs are globally unique, so we can safely treat the fileId as a tabletop id even if the
            // removed file wasn't a tabletop... the ref may not exist, but it won't be a valid tabletop by accident.
            const tabletopRef = ref(realTimeDB, `tabletop/${fileId}`);
            // Given how gigantic some tabletop objects have grown, we don't want to fetch a snapshot to check if it
            // exists, so just delete on spec.
            remove(tabletopRef)
                .catch(() => {
                    // If the tabletop doesn't exist (or we don't have permission to remove it from Firebase), just
                    // carry on.
                });
        }
        return next(action);
    };
}
