import * as chai from 'chai';
import * as chaiEnzyme from 'chai-enzyme';
import * as sinon from 'sinon';

import googleApiExports from '../util/googleAPI';
import AuthenticatedContainer from './authenticatedContainer';
import {createMockStore, shallowConnectedComponent} from '../util/testUtils';
import DriveFolderComponent from './driveFolderComponent';
import {discardStoreAction} from '../redux/mainReducer';
import {setLoggedInUserAction} from '../redux/loggedInUserReducer';
import OfflineFolderComponent from './offlineFolderComponent';
import offlineAPI from '../util/offlineAPI';

describe('AuthenticatedContainer component', () => {

    chai.use(chaiEnzyme());

    let sandbox = sinon.sandbox.create();
    let signInHandler: (signedIn: boolean) => Promise<any>;

    afterEach(() => {
        sandbox.restore();
    });

    describe('when online', () => {

        beforeEach(() => {
            sandbox.stub(googleApiExports, 'initialiseFileAPI').callsFake((handler) => {
                signInHandler = handler;
            });
            sandbox.stub(googleApiExports, 'signInToFileAPI');
            sandbox.stub(googleApiExports, 'getLoggedInUserInfo').returns(Promise.resolve({user: true}));
        });

        it('should show button to log in to Google if not authenticated', () => {
            let store = createMockStore({});
            let component = shallowConnectedComponent(store, AuthenticatedContainer);
            chai.assert.equal(component.find('button').length, 1);
            chai.assert.equal(component.find('button').text(), 'Sign in to Google');
        });

        it('should dispatch action to set logged in user once authenticated', () => {
            let store = createMockStore({});
            shallowConnectedComponent(store, AuthenticatedContainer);
            return signInHandler(true)
                .then(() => {
                    chai.assert.equal(store.dispatch.callCount, 1);
                    const referenceAction = setLoggedInUserAction(null);
                    chai.assert.equal(store.dispatch.getCall(0).args[0].type, referenceAction.type);
                });
        });

        it('should render DriveFolderComponent once logged in user in store', () => {
            let store = createMockStore({loggedInUser: {displayName: 'Frank', emailAddress: 'a@b', permissionId: 22}});
            let component = shallowConnectedComponent(store, AuthenticatedContainer);
            chai.assert.equal(component.find('button').length, 0);
            chai.assert.equal(component.find(DriveFolderComponent).length, 1);
        });

        it('should dispatch action to discard store when switching to unauthenticated', () => {
            let store = createMockStore({});
            shallowConnectedComponent(store, AuthenticatedContainer);
            signInHandler(false);
            chai.assert.equal(store.dispatch.callCount, 1);
            const referenceAction = discardStoreAction();
            chai.assert.equal(store.dispatch.getCall(0).args[0].type, referenceAction.type);
        });

    });

    describe('when offline', () => {

        let mockOfflineInitialiseFileAPI: sinon.SinonStub;

        beforeEach(() => {
            sandbox.stub(googleApiExports, 'initialiseFileAPI').throws(new Error('no drive for you'));
            mockOfflineInitialiseFileAPI = sandbox.stub(offlineAPI, 'initialiseFileAPI');
        });

        it('should show work offline button', () => {
            let store = createMockStore({});
            let component = shallowConnectedComponent(store, AuthenticatedContainer);
            chai.assert.equal(component.find('button').length, 1);
            chai.assert.equal(component.find('button').text(), 'Work Offline');
        });

        it('should initialise offline API and set fake user when button clicked', () => {
            let store = createMockStore({});
            let component = shallowConnectedComponent(store, AuthenticatedContainer);
            chai.assert.equal(component.find('button').length, 1);
            component.find('button').simulate('click');
            chai.assert.equal(mockOfflineInitialiseFileAPI.callCount, 1);
            chai.assert.equal(store.dispatch.callCount, 1);
            const referenceAction = setLoggedInUserAction(null);
            chai.assert.equal(store.dispatch.getCall(0).args[0].type, referenceAction.type);
        });

        it('should render OfflineFolderComponent once fake user in store', () => {
            let store = createMockStore({loggedInUser: {displayName: 'Frank', emailAddress: 'a@b', permissionId: 22}});
            let component = shallowConnectedComponent(store, AuthenticatedContainer);
            chai.assert.equal(component.find('button').length, 0);
            chai.assert.equal(component.find(OfflineFolderComponent).length, 1);
        });

    });

});