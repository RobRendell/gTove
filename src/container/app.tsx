import {Component} from 'react';
import HttpsRedirect from 'react-https-redirect';
import {Provider} from 'react-redux';
import {Store} from 'redux';
import 'inobounce';

import {ReduxStoreType} from '../redux/mainReducer';
import AuthenticatedContainer from './authenticatedContainer';

import './app.scss';

interface AppProps {
    store: Store<ReduxStoreType>;
}

class App extends Component<AppProps> {

    public render() {
        return (
            <HttpsRedirect>
                <Provider store={this.props.store}>
                    <AuthenticatedContainer/>
                </Provider>
            </HttpsRedirect>
        );
    }
}

export default App;
