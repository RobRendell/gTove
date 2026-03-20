import 'inobounce';
import './app.scss';

import {FunctionComponent} from 'react';
import HttpsRedirect from 'react-https-redirect';
import {Provider, ReactReduxContext} from 'react-redux';
import {Store} from 'redux';
import * as THREE from 'three';

import {ReduxStoreType} from '../redux/mainReducerTypes';
import {AppUpdateManager} from './appUpdateManager';
import AuthenticatedContainer from './authenticatedContainer';

interface AppProps {
    store: Store<ReduxStoreType>;
}

const App: FunctionComponent<AppProps> = ({store}) => {

    return (
        <HttpsRedirect>
            <Provider store={store} context={ReactReduxContext}>
                <AppUpdateManager />
                <AuthenticatedContainer/>
            </Provider>
        </HttpsRedirect>
    );
}

export default App;

// Force Three.js to stop automatically converting colors
if ('ColorManagement' in THREE) {
    (THREE as any).ColorManagement.enabled = false;
}