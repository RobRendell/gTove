import * as React from 'react';
import {Provider} from 'react-redux';
import {Store} from 'redux';
import 'inobounce';
import {hot} from 'react-hot-loader/root';

import {ReduxStoreType} from '../redux/mainReducer';
import AuthenticatedContainer from './authenticatedContainer';

import './app.scss';

interface AppProps {
    store: Store<ReduxStoreType>;
}

class App extends React.Component<AppProps> {

    public render() {
        return (
            <Provider store={this.props.store}>
                <AuthenticatedContainer/>
            </Provider>
        );
    }
}

export default process.env.NODE_ENV === 'development' ? hot(App) : App;
