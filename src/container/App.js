import React, {Component} from 'react';
import {createStore} from 'redux';
import {Provider} from 'react-redux';

import mainReducer from '../redux/mainReducer';
import AuthenticatedContainer from './AuthenticatedContainer';

const store = createStore(mainReducer, window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__());

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
