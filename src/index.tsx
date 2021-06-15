import * as ReactDOM from 'react-dom';

import App from './container/app';
import * as serviceWorker from './util/serviceWorker';
import buildStore from './redux/buildStore';
import {serviceWorkerSetRegistrationAction, serviceWorkerSetUpdateAction} from './redux/serviceWorkerReducer';

const store = buildStore();

ReactDOM.render(
    <App store={store}/>,
    document.getElementById('root') as HTMLElement);

serviceWorker.register({
    onRegistration: (registration: ServiceWorkerRegistration) => {
        store.dispatch(serviceWorkerSetRegistrationAction(registration));
    },
    onUpdate: () => {
        store.dispatch(serviceWorkerSetUpdateAction(true));
    }
});
