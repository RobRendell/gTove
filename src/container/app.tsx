import * as React from 'react';
import {Provider} from 'react-redux';
import 'inobounce';
import {hot} from 'react-hot-loader/root';

import buildStore from '../redux/buildStore';
import AuthenticatedContainer from './authenticatedContainer';

import './app.scss';

class App extends React.Component<any, any> {

    public render() {
        return (
            <Provider store={buildStore()}>
                <AuthenticatedContainer/>
            </Provider>
        );
    }
}

export default process.env.NODE_ENV === 'development' ? hot(App) : App;
