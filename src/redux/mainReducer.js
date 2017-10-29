import {combineReducers} from 'redux';

import googleAPIReducer from './googleAPIReducer';

const mainReducer = combineReducers({
    gAPI: googleAPIReducer
});

export default mainReducer;