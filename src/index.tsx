import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './container/app';
import * as serviceWorker from './util/serviceWorker';
import buildStore from './redux/buildStore';
import {serviceWorkerSetUpdateAction} from './redux/serviceWorkerReducer';

const store = buildStore();

ReactDOM.render(<App store={store}/>, document.getElementById('root') as HTMLElement);

serviceWorker.register({
    onUpdate: (registration: ServiceWorkerRegistration) => {
        store.dispatch(serviceWorkerSetUpdateAction(registration));
    }
});
