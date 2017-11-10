import React from 'react';
import chai from 'chai';
import chaiEnzyme from 'chai-enzyme';
import * as sinon from 'sinon';

import * as googleApiUtilsExports from '../util/googleAPIUtils';
import AuthenticatedContainer from './AuthenticatedContainer';
import {createMockStore, shallowConnectedComponent} from '../util/testUtils';
import DriveFolderComponent from './DriveFolderComponent';
import {discardStoreAction} from '../redux/mainReducer';

describe('AuthenticatedContainer component', () => {

    chai.use(chaiEnzyme());

    let sandbox = sinon.sandbox.create();
    let signInHandler;

    beforeEach(() => {
        sandbox.stub(googleApiUtilsExports, 'initialiseGoogleAPI').callsFake((_signInHandler) => {
            signInHandler = _signInHandler;
        });
        sandbox.stub(googleApiUtilsExports, 'signInToGoogleAPI');
    });

    afterEach(() => {
        sandbox.restore();
        signInHandler = null;
    });

    it('should show button to log in to Google if not authenticated', () => {
        let store = createMockStore({});
        let component = shallowConnectedComponent(store, AuthenticatedContainer);
        chai.assert.equal(component.find('button').length, 1);
    });

    it('should render DriveFolderComponent once authenticated', () => {
        let store = createMockStore({});
        let component = shallowConnectedComponent(store, AuthenticatedContainer);
        signInHandler(true);
        chai.assert.equal(component.find('button').length, 0);
        chai.assert.equal(component.find(DriveFolderComponent).length, 1);
    });

    it('should dispatch action to discard store when switching to unauthenticated', () => {
        let store = createMockStore({});
        sandbox.stub(store, 'dispatch');
        shallowConnectedComponent(store, AuthenticatedContainer);
        signInHandler(false);
        chai.assert.equal(store.dispatch.callCount, 1);
        const referenceAction = discardStoreAction();
        chai.assert.equal(store.dispatch.getCall(0).args[0].type, referenceAction.type);
    })

});