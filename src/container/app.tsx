import * as React from 'react';
import {Provider} from 'react-redux';

import buildStore from '../redux/mainReducer';
import AuthenticatedContainer from './authenticatedContainer';

import './app.css';

class App extends React.Component<any, any> {

    public render() {
        return (
            <Provider store={buildStore()}>
                <AuthenticatedContainer/>
            </Provider>
        );
    }
}

export default App;
