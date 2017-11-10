import React, {Component} from 'react'
import {connect} from 'react-redux';

import {addFilesAction, getAllFilesFromStore} from '../redux/fileIndexReducer';
import {createDriveFolder, loadAccessibleDriveFiles, signOutFromGoogleAPI} from '../util/googleAPIUtils';
import MapViewComponent from '../presentation/MapViewComponent';

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
        this.setState({loading: true});
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
                <MapViewComponent/>
            );
        } else {
            return (
                <div>
                    <p>Virtual Gaming Tabletop saves its data in a folder created in your Google Drive. Click the button
                        to create this folder. After it is created, you can move it (for instance into a folder).</p>
                    <button onClick={() => {
                            this.createInitialStructure();
                    }}>
                        Create "Virtual Gaming Tabletop" folder in Drive
                    </button>
                    <button onClick={() => {
                        signOutFromGoogleAPI();
                    }}>
                        Sign out
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