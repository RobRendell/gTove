import * as React from 'react'
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {Dispatch} from 'redux';

import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, getBundleIdFromStore, getTabletopIdFromStore, ReduxStoreType} from '../redux/mainReducer';
import googleAPI from '../util/googleAPI';
import * as constants from '../util/constants';
import DriveTextureLoader, {TextureLoaderContext} from '../util/driveTextureLoader';
import {DriveMetadata} from '../util/googleDriveUtils';
import {FileAPIContext} from '../util/fileUtils';

interface DriveFolderComponentProps {
    dispatch: Dispatch<ReduxStoreType>;
    files: FileIndexReducerType;
    tabletopId: string;
    bundleId: string | null;
}

interface DriveFolderComponentState {
    loading: boolean;
}

class DriveFolderComponent extends React.Component<DriveFolderComponentProps, DriveFolderComponentState> {

    static topLevelFolders = [
        constants.FOLDER_MAP,
        constants.FOLDER_MINI,
        constants.FOLDER_SCENARIO,
        constants.FOLDER_TEMPLATE,
        constants.FOLDER_TABLETOP,
        constants.FOLDER_GM_DATA,
        constants.FOLDER_BUNDLE
    ];

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
            .then(() => (
                this.props.files.roots[constants.FOLDER_ROOT] ?
                    this.verifyTopLevelFolders([this.props.files.roots[constants.FOLDER_ROOT]]) : Promise.resolve()
            ))
            .then(() => {
                this.setState({loading: false});
            });
    }

    verifyTopLevelFolders(parents: string[]) {
        const missingFolders = DriveFolderComponent.topLevelFolders.filter((folderName) => (!this.props.files.roots[folderName]));
        return Promise.all(missingFolders.map((folderName) => (googleAPI.createFolder(folderName, {parents}))))
            .then((newFolders) => {
                this.props.dispatch(addRootFilesAction(newFolders));
            })
    }

    createInitialStructure() {
        this.setState({loading: true});
        return googleAPI.createFolder(constants.FOLDER_ROOT, {appProperties: {rootFolder: true}})
            .then((metadata) => {
                this.props.dispatch(addRootFilesAction([metadata]));
                return this.verifyTopLevelFolders([metadata.id]);
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
        } else if ((this.props.files && Object.keys(this.props.files.roots).length > 0) || (this.props.tabletopId && this.props.tabletopId !== this.props.bundleId)) {
            return (
                this.props.children
            );
        } else {
            return (
                <div>
                    <p>
                        gTove saves its data in a folder structure created in your Google Drive. Click the button below
                        to create these folders. After they are created, you can rename the top-level folder and move it
                        elsewhere in your Drive without breaking anything (but don't move or rename the folders inside).
                    </p>
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
        tabletopId: getTabletopIdFromStore(store),
        bundleId: getBundleIdFromStore(store)
    }
}

export default connect(mapStoreToProps)(DriveFolderComponent);