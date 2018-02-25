import React, {Component} from 'react';
import {Provider} from 'react-redux';

import store from '../redux/mainReducer';
import AuthenticatedContainer from './AuthenticatedContainer';

import './App.css';

class App extends Component {

    render() {
        return (
            <Provider store={store}>
                <AuthenticatedContainer/>
            </Provider>
        );
    }
}

export default App;
