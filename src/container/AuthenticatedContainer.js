import React, {Component} from 'react';

import DriveFolderComponent from './DriveFolderComponent';
import {initialiseGoogleAPI, signInToGoogleAPI} from '../util/googleAPIUtils';

class AuthenticatedContainer extends Component {

    constructor(props) {
        super(props);
        this.state = {initialised: false, signedIn: false};
    }

    componentDidMount() {
        initialiseGoogleAPI((signedIn) => {
            this.setState({
                initialised: true,
                signedIn
            });
        });
    }

    render() {
        return (
            <div>
                {
                    this.state.signedIn ? (
                        <DriveFolderComponent/>
                    ) : (
                        <div>
                            <button disabled={!this.state.initialised} onClick={() => {
                                signInToGoogleAPI();
                            }}>Sign in to Google
                            </button>
                        </div>
                    )
                }
            </div>
        );
    }
}

export default AuthenticatedContainer;