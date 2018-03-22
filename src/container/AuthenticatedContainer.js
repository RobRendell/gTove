import React, {Component} from 'react';
import {connect} from 'react-redux';

import DriveFolderComponent from './DriveFolderComponent';
import {getLoggedInUserInfo, initialiseGoogleAPI, signInToGoogleAPI} from '../util/googleAPIUtils';
import {discardStoreAction} from '../redux/mainReducer';
import VirtualGamingTabletop from '../presentation/VirtualGamingTabletop';
import {getLoggedInUserFromStore, setLoggedInUserAction} from '../redux/loggedInUserReducer';

class AuthenticatedContainer extends Component {

    constructor(props) {
        super(props);
        this.state = {
            initialised: false,
            offline: false
        };
    }

    componentDidMount() {
        try {
            initialiseGoogleAPI((signedIn) => {
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
            });
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
                            <VirtualGamingTabletop/>
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
                                    this.setState({signedIn: true});
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