import React, {Component} from 'react';
import {Provider} from 'react-redux';

import buildStore from '../redux/mainReducer';
import AuthenticatedContainer from './AuthenticatedContainer';

import './App.css';

class App extends Component {

    render() {
        return (
            <Provider store={buildStore()}>
                <AuthenticatedContainer/>
            </Provider>
        );
    }
}

export default App;
