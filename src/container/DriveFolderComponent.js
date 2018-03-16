import React, {Component} from 'react'
import {connect} from 'react-redux';

import {addFilesAction, getAllFilesFromStore} from '../redux/fileIndexReducer';
import {
    createDriveFolder, loadVGTDriveFiles, signOutFromGoogleAPI
} from '../util/googleAPIUtils';
import * as constants from '../util/constants';
import {getTabletopIdFromStore} from '../redux/locationReducer';

class DriveFolderComponent extends Component {

    constructor(props) {
        super(props);
        this.onAddFiles = this.onAddFiles.bind(this);
        this.state = {
            loading: true
        };
    }

    onAddFiles(files, parent) {
        this.props.dispatch(addFilesAction(files, parent));
    }

    componentDidMount() {
        return loadVGTDriveFiles(this.onAddFiles)
            .then(() => {
                this.setState({loading: false});
            });
    }

    createInitialStructure() {
        this.setState({loading: true});
        return createDriveFolder(constants.FOLDER_ROOT, {appProperties: {rootFolder: true}})
            .then((result) => {
                const parents = [result.id];
                return Promise.all([
                    createDriveFolder(constants.FOLDER_MAP, {parents}),
                    createDriveFolder(constants.FOLDER_MINI, {parents}),
                    createDriveFolder(constants.FOLDER_SCENARIO, {parents}),
                    createDriveFolder(constants.FOLDER_TEMPLATE, {parents}),
                    createDriveFolder(constants.FOLDER_TABLETOP, {parents})
                ]);
            })
            .then(() => (loadVGTDriveFiles(this.onAddFiles)))
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
        } else if ((this.props.files && Object.keys(this.props.files.roots).length > 0) || this.props.tabletopId) {
            return (
                this.props.children
            );
        } else {
            return (
                <div>
                    <p>Virtual Gaming Tabletop saves its data in a folder created in your Google Drive. Click the button
                        to create this folder. After it is created, you can move it elsewhere in your Drive.</p>
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
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store)
    }
}

export default connect(mapStoreToProps)(DriveFolderComponent);