import * as ReactDOM from 'react-dom';

import App from './container/app';
import * as serviceWorker from './util/serviceWorker';
import buildStore from './redux/buildStore';
import {serviceWorkerSetUpdateAction} from './redux/serviceWorkerReducer';
import {serviceWorkerStore} from './util/serviceWorkerStore';

const store = buildStore();

ReactDOM.render(
    <App store={store}/>,
    document.getElementById('root') as HTMLElement);

serviceWorker.register({
    onRegistration: (registration: ServiceWorkerRegistration) => {
        serviceWorkerStore.registration = registration;
    },
    onUpdate: () => {
        store.dispatch(serviceWorkerSetUpdateAction(true));
    }
});
