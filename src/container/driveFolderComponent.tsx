import * as React from 'react'
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {Dispatch} from 'redux';

import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, getTabletopIdFromStore, ReduxStoreType} from '../redux/mainReducer';
import googleAPI from '../util/googleAPI';
import * as constants from '../util/constants';
import DriveTextureLoader, {TextureLoaderContext} from '../util/driveTextureLoader';
import {DriveMetadata} from '../@types/googleDrive';
import {FileAPIContext} from '../util/fileUtils';

interface DriveFolderComponentProps {
    dispatch: Dispatch<ReduxStoreType>;
    files: FileIndexReducerType;
    tabletopId: string;
}

interface DriveFolderComponentState {
    loading: boolean;
}

class DriveFolderComponent extends React.Component<DriveFolderComponentProps, DriveFolderComponentState> {

    static childContextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object
    };

    private textureLoader: DriveTextureLoader;

    constructor(props: DriveFolderComponentProps) {
        super(props);
        this.state = {
            loading: true
        };
        this.textureLoader = new DriveTextureLoader();
    }

    getChildContext(): FileAPIContext & TextureLoaderContext {
        return {
            fileAPI: googleAPI,
            textureLoader: this.textureLoader
        };
    }

    componentDidMount() {
        return googleAPI.loadRootFiles((files: DriveMetadata[]) => {this.props.dispatch(addRootFilesAction(files))})
            .then(() => {
                this.setState({loading: false});
            });
    }

    createInitialStructure() {
        this.setState({loading: true});
        return googleAPI.createFolder(constants.FOLDER_ROOT, {appProperties: {rootFolder: true}})
            .then((result) => {
                const parents = [result.id];
                return Promise.all([
                    googleAPI.createFolder(constants.FOLDER_MAP, {parents}),
                    googleAPI.createFolder(constants.FOLDER_MINI, {parents}),
                    googleAPI.createFolder(constants.FOLDER_SCENARIO, {parents}),
                    googleAPI.createFolder(constants.FOLDER_TEMPLATE, {parents}),
                    googleAPI.createFolder(constants.FOLDER_TABLETOP, {parents}),
                    googleAPI.createFolder(constants.FOLDER_GM_DATA, {parents})
                ]);
            })
            .then(() => (googleAPI.loadRootFiles((files: DriveMetadata[]) => {this.props.dispatch(addRootFilesAction(files))})))
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
                            return this.createInitialStructure();
                    }}>
                        Create "{constants.FOLDER_ROOT}" folder in Drive
                    </button>
                    <button onClick={() => {
                        googleAPI.signOutFromFileAPI();
                    }}>
                        Sign out
                    </button>
                </div>
            );
        }

    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store)
    }
}

export default connect(mapStoreToProps)(DriveFolderComponent);