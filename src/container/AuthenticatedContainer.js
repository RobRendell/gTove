import React, {Component} from 'react';
import {connect} from 'react-redux';

import DriveFolderComponent from './DriveFolderComponent';
import {initialiseGoogleAPI, signInToGoogleAPI} from '../util/googleAPIUtils';
import {discardStoreAction} from '../redux/mainReducer';

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
            if (!signedIn) {
                this.props.dispatch(discardStoreAction());
            }
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
                            <button disabled={!this.state.initialised} onClick={() => {signInToGoogleAPI()}}>
                                Sign in to Google
                            </button>
                        </div>
                    )
                }
            </div>
        );
    }
}

export default connect()(AuthenticatedContainer);