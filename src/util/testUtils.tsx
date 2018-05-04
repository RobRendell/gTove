import * as React from 'react';
import {shallow} from 'enzyme';
import * as sinon from 'sinon';
import {Reducer, Store} from 'redux';

import {ReduxStoreType} from '../redux/mainReducer';

/**
 * Build a mock Redux store object.
 *
 * @param mockState The state of the Redux store, as returned by mockStore.getState()
 */
export function createMockStore(mockState: Partial<ReduxStoreType>): Store<ReduxStoreType> & {dispatch: sinon.SinonStub} {
    return {
        replaceReducer: (nextReducer: Reducer<ReduxStoreType>) => {},
        subscribe: () => () => {},
        dispatch: sinon.stub(),
        getState: () => ({ ...mockState } as ReduxStoreType)
    }
}

export function shallowConnectedComponent(store: Store<ReduxStoreType>, Component: React.ComponentType<any>, props: any = undefined) {
    let result = shallow(<Component store={store} {...props} />, {lifecycleExperimental: true});
    return result.dive();
}