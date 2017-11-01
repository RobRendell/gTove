import React, {Component} from 'react'
import {connect} from 'react-redux';

import {addFilesAction, getAllFilesFromStore} from '../redux/fileIndexReducer';
import {createDriveFolder, loadAccessibleDriveFiles, signOutFromGoogleAPI} from '../util/googleAPIUtils';
import {discardStoreAction} from '../redux/mainReducer';

class DriveFolderComponent extends Component {

    constructor(props) {
        super(props);
        this.onAddFiles = this.onAddFiles.bind(this);
        this.state = {
            loading: true
        };
    }

    onAddFiles(files) {
        this.props.dispatch(addFilesAction(files));
    }

    componentDidMount() {
        loadAccessibleDriveFiles(this.onAddFiles)
            .then(() => {
                this.setState({loading: false});
            });
    }

    createInitialStructure() {
        return createDriveFolder('Virtual Gaming Tabletop')
            .then((response) => {
                const parents = [response.result.id];
                return Promise.all([
                    createDriveFolder('Maps', parents),
                    createDriveFolder('Minis', parents),
                    createDriveFolder('Scenarios', parents),
                    createDriveFolder('JSON Player', parents),
                    createDriveFolder('JSON GM', parents)
                ]);
            })
            .then(() => {
                loadAccessibleDriveFiles(this.onAddFiles);
            })
            .then(() => {
                this.setState({loading: false});
            });
    }

    render() {
        if (this.state.loading) {
            return (
                <div>
                    Loading from Google Drive...
                </div>
            );
        } else if (Object.keys(this.props.files).length > 0) {
            return (
                <div>
                    {
                        Object.keys(this.props.files).map((fileId) => (
                            <div key={fileId}>
                                {JSON.stringify(this.props.files[fileId])}
                            </div>
                        ))
                    }
                    <br/>
                    <button onClick={() => {
                        signOutFromGoogleAPI();
                        this.props.dispatch(discardStoreAction());
                    }}>Sign out
                    </button>
                </div>
            );
        } else {
            return (
                <div>
                    Virtual Gaming Tabletop saves its data in a folder created in your Google Drive. Click the button
                    to create this folder. After it is created, you can move it (for instance into a folder).
                    <br/>
                    <button onClick={() => {
                        this.setState({loading: true});
                        this.createInitialStructure();
                    }}>Create "Virtual Gaming Tabletop" folder in Drive
                    </button>
                    <br/>
                    <button onClick={() => {
                        signOutFromGoogleAPI();
                        this.props.dispatch(discardStoreAction());
                    }}>Sign out
                    </button>
                </div>
            );
        }

    }
}

function mapStoreToProps(store) {
    return {
        files: getAllFilesFromStore(store)
    }
}

export default connect(mapStoreToProps)(DriveFolderComponent);