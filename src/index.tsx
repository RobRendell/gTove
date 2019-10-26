import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './container/app';
import registerServiceWorker from './util/registerServiceWorker';
import buildStore from './redux/buildStore';

const store = buildStore();

ReactDOM.render(<App store={store}/>, document.getElementById('root') as HTMLElement);
registerServiceWorker();
