import 'rc-tooltip/assets/bootstrap.css';

import {createRoot} from 'react-dom/client';

import App from './container/app';
import buildStore from './redux/buildStore';

const container = document.getElementById('root');
const root = createRoot(container!);

const store = buildStore();

root.render(
    <App store={store}/>
);
