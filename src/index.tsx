import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './container/app';
import registerServiceWorker from './util/registerServiceWorker';

ReactDOM.render(<App />, document.getElementById('root') as HTMLElement);
registerServiceWorker();
