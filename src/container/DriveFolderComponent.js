import React, {Component} from 'react'
import {connect} from 'react-redux';

import {addFilesAction, getAllFilesFromStore} from '../redux/fileIndexReducer';
import {
    createDriveFolder, getJsonFileContents, loadAccessibleDriveFiles, signOutFromGoogleAPI, uploadJsonToDriveFile
} from '../util/googleAPIUtils';
import * as constants from '../util/constants';
import {changeWorkspaceIdAction, getWorkspaceIdFromStore} from '../redux/locationReducer';
import {jsonToScenario, setScenarioAction} from '../redux/scenarioReducer';

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

    loadScenarioFromDrive(metadataId) {
        return getJsonFileContents({id: metadataId})
            .then((scenarioJson) => {
                const scenario = jsonToScenario(this.props.files.driveMetadata, scenarioJson);
                this.props.dispatch(setScenarioAction(scenario));
            });
    }

    componentDidMount() {
        return loadAccessibleDriveFiles(this.onAddFiles)
            .then(() => {
                if (this.props.files && Object.keys(this.props.files).length > 0) {
                    if (!this.props.workspaceId) {
                        this.props.dispatch(changeWorkspaceIdAction(this.props.files.roots[constants.FILE_CURR_SCENARIO]));
                    }
                    return this.loadScenarioFromDrive(this.props.workspaceId);
                }
            })
            .then(() => {
                this.setState({loading: false});
            });
    }

    createInitialStructure() {
        this.setState({loading: true});
        return createDriveFolder('Virtual Gaming Tabletop')
            .then((result) => {
                const parents = [result.id];
                return Promise.all([
                    createDriveFolder(constants.FOLDER_MAP, parents),
                    createDriveFolder(constants.FOLDER_MINI, parents),
                    createDriveFolder(constants.FOLDER_SCENARIO, parents),
                    createDriveFolder(constants.FOLDER_TEMPLATE, parents),
                    uploadJsonToDriveFile({name: constants.FILE_CURR_SCENARIO, parents}, {}),
                    uploadJsonToDriveFile({name: constants.FILE_CURR_SCENARIO_GM, parents}, {}),
                ]);
            })
            .then(() => (loadAccessibleDriveFiles(this.onAddFiles)))
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
        } else if ((this.props.files && Object.keys(this.props.files.roots).length > 0) || this.props.workspaceId) {
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
        workspaceId: getWorkspaceIdFromStore(store)
    }
}

export default connect(mapStoreToProps)(DriveFolderComponent);