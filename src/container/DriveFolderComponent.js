import React, {Component} from 'react'
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {addFilesAction, getAllFilesFromStore} from '../redux/fileIndexReducer';
import * as googleAPIUtils from '../util/googleAPIUtils';
import * as constants from '../util/constants';
import {getTabletopIdFromStore} from '../redux/locationReducer';
import DriveTextureLoader from '../util/DriveTextureLoader';

class DriveFolderComponent extends Component {

    static childContextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object
    };

    constructor(props) {
        super(props);
        this.onAddFiles = this.onAddFiles.bind(this);
        this.state = {
            loading: true
        };
        this.textureLoader = new DriveTextureLoader();
    }

    getChildContext() {
        return {
            fileAPI: googleAPIUtils,
            textureLoader: this.textureLoader
        };
    }

    onAddFiles(files, parent) {
        this.props.dispatch(addFilesAction(files, parent));
    }

    componentDidMount() {
        return googleAPIUtils.loadVGTFiles(this.onAddFiles)
            .then(() => {
                this.setState({loading: false});
            });
    }

    createInitialStructure() {
        this.setState({loading: true});
        return googleAPIUtils.createFolder(constants.FOLDER_ROOT, {appProperties: {rootFolder: true}})
            .then((result) => {
                const parents = [result.id];
                return Promise.all([
                    googleAPIUtils.createFolder(constants.FOLDER_MAP, {parents}),
                    googleAPIUtils.createFolder(constants.FOLDER_MINI, {parents}),
                    googleAPIUtils.createFolder(constants.FOLDER_SCENARIO, {parents}),
                    googleAPIUtils.createFolder(constants.FOLDER_TEMPLATE, {parents}),
                    googleAPIUtils.createFolder(constants.FOLDER_TABLETOP, {parents}),
                    googleAPIUtils.createFolder(constants.FOLDER_GM_DATA, {parents})
                ]);
            })
            .then(() => (googleAPIUtils.loadVGTFiles(this.onAddFiles)))
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
                    <p>gTove saves its data in a folder created in your Google Drive. Click the button below to create
                        this folder. After it is created, you can rename it and move it elsewhere in your Drive without
                        breaking anything (but don't rename the folders inside).</p>
                    <button onClick={() => {
                            this.createInitialStructure();
                    }}>
                        Create "{constants.FOLDER_ROOT}" folder in Drive
                    </button>
                    <button onClick={() => {
                        googleAPIUtils.signOutFromFileAPI();
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