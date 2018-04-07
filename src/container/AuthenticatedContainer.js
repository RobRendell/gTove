import React, {Component} from 'react';
import {connect} from 'react-redux';

import DriveFolderComponent from './DriveFolderComponent';
import {getLoggedInUserInfo, initialiseGoogleAPI, signInToGoogleAPI} from '../util/googleAPIUtils';
import {discardStoreAction} from '../redux/mainReducer';
import VirtualGamingTabletop from '../presentation/VirtualGamingTabletop';
import {getLoggedInUserFromStore, setLoggedInUserAction} from '../redux/loggedInUserReducer';
import {initialiseOfflineFileAPI} from '../util/offlineUtils';
import OfflineFolderComponent from './OfflineFolderComponent';

class AuthenticatedContainer extends Component {

    static offlineUserInfo = {
        displayName: 'Offline',
        offline: true,
        emailAddress: 'offline user',
        permissionId: 0x333333
    };

    constructor(props) {
        super(props);
        this.signInHandler = this.signInHandler.bind(this);
        this.state = {
            initialised: false,
            offline: false
        };
    }

    signInHandler(signedIn) {
        this.setState({
            initialised: true
        });
        if (signedIn) {
            return getLoggedInUserInfo()
                .then((user) => {
                    this.props.dispatch(setLoggedInUserAction(user));
                });
        } else {
            this.props.dispatch(discardStoreAction());
        }
    }

    componentDidMount() {
        try {
            initialiseGoogleAPI(this.signInHandler);
        } catch (e) {
            this.setState({offline: true});
        }
    }

    render() {
        return (
            <div className='fullHeight'>
                {
                    this.props.loggedInUser ? (
                        this.state.offline ? (
                            <OfflineFolderComponent>
                                <VirtualGamingTabletop/>
                            </OfflineFolderComponent>
                        ) : (
                            <DriveFolderComponent>
                                <VirtualGamingTabletop/>
                            </DriveFolderComponent>
                        )
                    ) : (
                        this.state.offline ? (
                            <div>
                                <p>An error occurred trying to connect to Google Drive.</p>
                                <button onClick={() => {
                                    initialiseOfflineFileAPI(this.signInHandler);
                                    this.props.dispatch(setLoggedInUserAction(AuthenticatedContainer.offlineUserInfo));
                                }}>
                                    Work Offline
                                </button>
                            </div>
                        ) : (
                            <div>
                                <button disabled={!this.state.initialised} onClick={() => {signInToGoogleAPI()}}>
                                    Sign in to Google
                                </button>
                            </div>
                        )
                    )
                }
            </div>
        );
    }
}

function mapStoreToProps(store) {
    return {
        loggedInUser: getLoggedInUserFromStore(store)
    }
}

export default connect(mapStoreToProps)(AuthenticatedContainer);