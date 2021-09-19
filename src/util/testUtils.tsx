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
        getState: () => ({ ...mockState } as ReduxStoreType),
        [Symbol.observable]: sinon.stub()
    }
}
