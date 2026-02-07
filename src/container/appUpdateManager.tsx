import {useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useRegisterSW} from 'virtual:pwa-register/react';

import {
    appUpdateClearUpdatePromptAction,
    appUpdateSetErrorAction,
    appUpdateSetUpdateAvailableAction
} from '../redux/appUpdateReducer';
import {getAppUpdateFromStore} from '../redux/mainReducer';

// The vite-plugin-pwa plugin registers a service worker to update the app in the background. This component acts as a
// bridge between it and Redux.
export function AppUpdateManager() {

    const dispatch = useDispatch();
    const registrationRef = useRef<undefined | ServiceWorkerRegistration>(undefined);

    const {updateServiceWorker, needRefresh: [needRefresh]} = useRegisterSW({
        onRegisteredSW(_url, registration) {
            registrationRef.current = registration;
            // Check for updates every 30 minutes
            if (registration) {
                setInterval(() => registration.update(), 30 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            dispatch(appUpdateSetErrorAction(error));
        }
    });

    useEffect(() => {
        dispatch(appUpdateSetUpdateAvailableAction(needRefresh));
    }, [dispatch, needRefresh]);

    const {forceUpdate, lastCheckedForUpdate} = useSelector(getAppUpdateFromStore);

    useEffect(() => {
        if (forceUpdate) {
            // This will force the whole page to reload, so no need to reset the forceUpdate flag.
            void updateServiceWorker(true);
            // But do hide the dialog
            dispatch(appUpdateClearUpdatePromptAction());
        }
    }, [dispatch, forceUpdate, updateServiceWorker]);

    useEffect(() => {
        // Whenever the lastChecked timestamp changes, trigger an update.
        void registrationRef.current?.update();
    }, [lastCheckedForUpdate]);

    return null;
}