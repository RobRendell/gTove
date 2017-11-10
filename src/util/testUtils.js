import React from 'react';
import {shallow} from 'enzyme';

/**
 * Build a mock Redux store object.
 *
 * @param mockState The state of the Redux store, as returned by mockStore.getState()
 */
export function createMockStore(mockState) {
    return {
        default: () => {},
        subscribe: () => {},
        dispatch: () => {},
        getState: () => ({ ...mockState })
    }
}

export function shallowConnectedComponent(store, Component, props = undefined) {
    let result = shallow(<Component store={store} {...props} />, {lifecycleExperimental: true});
    return result.dive();
}