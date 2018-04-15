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
                        <div>
                            <h1>gTove - a virtual gaming tabletop</h1>
                            <p>This project is a lightweight web application to simulate a virtual tabletop.  Multiple
                                maps and standee-style miniatures can be placed on the tabletop, and everyone connected
                                to the same tabletop can see them and move the miniatures around.  Google Drive is used
                                to store shared resources such as the images for miniatures and maps, and data for
                                scenarios.</p>
                            <p>More information (including a roadmap of planned features) here:&nbsp;
                                <a target='_blank' rel='noopener noreferrer' href='https://github.com/RobRendell/gtove'>
                                    https://github.com/RobRendell/gtove
                                </a></p>
                            {
                                this.state.offline ? (
                                    <p>An error occurred trying to connect to Google Drive.</p>
                                ) : (
                                    <div>
                                        <p>The app needs read-only access to your Google Drive files, in order to view
                                            maps and minis created by other people (such as the GM if you're a player.)
                                            It also needs permission to create/upload files in your Google Drive, and
                                            modify the files so created, which is how GMs can work with the app to
                                            create and update content.</p>
                                        <button disabled={!this.state.initialised} onClick={() => {signInToGoogleAPI()}}>
                                            Sign in to Google
                                        </button>
                                    </div>
                                )
                            }
                            <p>You can {this.state.offline ? 'still' : 'alternatively'} connect in "offline mode", which
                                doesn't require access to your Google Drive.  Offline mode stores everything in memory,
                                multiple devices can't view the same tabletop, and any work you do is lost when the
                                browser tab closes or you sign out.  It is thus mainly useful only for demoing the
                                app.</p>
                            <button onClick={() => {
                                this.setState({offline: true});
                                initialiseOfflineFileAPI(this.signInHandler);
                                this.props.dispatch(setLoggedInUserAction(AuthenticatedContainer.offlineUserInfo));
                            }}>
                                Work Offline
                            </button>
                        </div>
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