import React, {Component} from 'react';

import DriveFolderComponent from './DriveFolderComponent';

class AuthenticatedContainer extends Component {

    // The API key has the following enabled: Google Drive API
    static API_KEY = 'AIzaSyDyeV-r65-Iv-iVSwSczguOBF_sRZY9wok';
    static CLIENT_ID = '467803009036-2jo3nhds25lc924suggdl3jman29vt0s.apps.googleusercontent.com';
    static DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
    // Authorization scopes required by the API; multiple scopes can be included, separated by spaces.
    static SCOPES = 'https://www.googleapis.com/auth/drive.file';

    constructor(props) {
        super(props);
        this.state = {initialised: false, signedIn: false};
    }

    componentDidMount() {
        // this is based on Google documentation:
        // https://developers.google.com/drive/v3/web/quickstart/js
        global.gapi.load('client:auth2', () => {
            global.gapi.client.init({
                apiKey: AuthenticatedContainer.API_KEY,
                clientId: AuthenticatedContainer.CLIENT_ID,
                discoveryDocs: AuthenticatedContainer.DISCOVERY_DOCS,
                scope: AuthenticatedContainer.SCOPES
            }).then(() => {
                // Listen for sign-in state changes.
                global.gapi.auth2.getAuthInstance().isSignedIn.listen((signedIn) => {
                    this.setState({signedIn});
                });
                // Handle the initial sign-in state.
                this.setState({
                    initialised: true,
                    signedIn: global.gapi.auth2.getAuthInstance().isSignedIn.get()
                });
            });
        });
    }

    render() {
        return (
            <div>
                {
                    this.state.signedIn ? (
                        <DriveFolderComponent onSignOut={() => {
                            global.gapi.auth2.getAuthInstance().signOut()
                        }}/>
                    ) : (
                        <div>
                            <button disabled={!this.state.initialised} onClick={() => {
                                global.gapi.auth2.getAuthInstance().signIn();
                            }}>Sign in to Google</button>
                        </div>
                    )
                }
            </div>
        );
    }
}

export default AuthenticatedContainer;