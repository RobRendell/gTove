import {AnyAction, Dispatch, MiddlewareAPI} from 'redux';

import {Firebase} from '../util/firebase';
import {setScenarioAction} from './scenarioReducer';

import fbConfig from '../firebase-config';

interface FirebaseMiddleware {
    syncToClient: (setScenarioAction: object, firebaseRef: Promise<any>) => Promise<void>;
}

const firebaseMiddleware = <Store>({syncToClient}: FirebaseMiddleware) => {

    let state: any;
    let firebase: Firebase | null;
    let tabletopListener: object;
    let tabletopId: string | null;
    let scenario: object;

    return (api: MiddlewareAPI<Store>) => (next: Dispatch<Store>) => (action: AnyAction) => {

        // Dispatch action locally
        const result = next(action);
        state = api.getState();

        // Check Firebase activation status
        if (!state.firebase.enabled)
            return result;

        // Init firebase
        if (!firebase)
            firebase = new Firebase(fbConfig);

        // Retrieve current tabletop and scenario
        tabletopId = state.location.payload.tabletopId;
        scenario = state.scenario;

        // If no table is loaded, return dispatched
        if (!tabletopId)
            return result;

        // Add a listener to current tabletop Firebase reference
        // Refreshes tabletop for all connected clients when data
        // is updated in Firebase (set-last-common[...] action below)
        if (!tabletopListener)
            tabletopListener = firebase.initTabletopDataListener(tabletopId, (data: object, firebase: Firebase) => {
                syncToClient(setScenarioAction, firebase.readTabletopData(tabletopId));
            });

        // Watch for set-last-common[...] action and subsequently update
        // Firebase with tabletop scenario data whenever action is dispatched.
        // This appears to be the common dispatched action on tabletop updates
        // requiring multi-client update, but may change based on recommendation from dev.
        switch (result.type) {
            case 'set-last-common-scenario-action':
                firebase.saveTabletopScenario(tabletopId, scenario);
                break;
            default:
                return result;
        }
        return result;
    };
};

export default firebaseMiddleware;