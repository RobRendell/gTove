import 'inobounce';
import './app.scss';

import {FunctionComponent} from 'react';
import HttpsRedirect from 'react-https-redirect';
import {Provider} from 'react-redux';
import {Store} from 'redux';

import {ReduxStoreType} from '../redux/mainReducerTypes';
import {AppUpdateManager} from './appUpdateManager';
import AuthenticatedContainer from './authenticatedContainer';

interface AppProps {
    store: Store<ReduxStoreType>;
}

const App: FunctionComponent<AppProps> = ({store}) => {

    return (
        <HttpsRedirect>
            <Provider store={store}>
                <AppUpdateManager />
                <AuthenticatedContainer/>
            </Provider>
        </HttpsRedirect>
    );
}

export default App;
