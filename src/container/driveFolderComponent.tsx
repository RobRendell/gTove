import * as React from 'react'
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {AnyAction, Dispatch} from 'redux';

import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {
    getAllFilesFromStore,
    getBundleIdFromStore,
    getTabletopIdFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import googleAPI from '../util/googleAPI';
import * as constants from '../util/constants';
import DriveTextureLoader, {TextureLoaderContext} from '../util/driveTextureLoader';
import {DriveMetadata} from '../util/googleDriveUtils';
import {FileAPIContext} from '../util/fileUtils';
import InputButton from '../presentation/inputButton';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';

interface DriveFolderComponentProps {
    dispatch: Dispatch<AnyAction, ReduxStoreType>;
    files: FileIndexReducerType;
    tabletopId: string;
    bundleId: string | null;
}

interface DriveFolderComponentState {
    loading: string;
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
            loading: ': Loading...'
        };
        this.textureLoader = new DriveTextureLoader();
    }

    getChildContext(): FileAPIContext & TextureLoaderContext {
        return {
            fileAPI: googleAPI,
            textureLoader: this.textureLoader
        };
    }

    async componentDidMount() {
        await googleAPI.loadRootFiles((files: DriveMetadata[]) => {this.props.dispatch(addRootFilesAction(files))});
        if (this.props.files.roots[constants.FOLDER_ROOT]) {
            await this.verifyTopLevelFolders([this.props.files.roots[constants.FOLDER_ROOT]]);
        }
        this.setState({loading: ''});
    }

    async verifyTopLevelFolders(parents: string[]) {
        const missingFolders = DriveFolderComponent.topLevelFolders.filter((folderName) => (!this.props.files.roots[folderName]));
        let newFolders: DriveMetadata[] = [];
        for (let folderName of missingFolders) {
            this.setState({loading: `: Creating ${folderName} folder...`});
            newFolders.push(await googleAPI.createFolder(folderName, {parents}));
        }
        this.props.dispatch(addRootFilesAction(newFolders));
    }

    async createInitialStructure() {
        this.props.dispatch(setCreateInitialStructureAction(true));
        this.setState({loading: '...'});
        const metadata = await googleAPI.createFolder(constants.FOLDER_ROOT, {appProperties: {rootFolder: 'true'}});
        this.props.dispatch(addRootFilesAction([metadata]));
        await this.verifyTopLevelFolders([metadata.id]);
        this.setState({loading: ''});
    }

    render() {
        if (this.state.loading) {
            return (
                <div>
                    Waiting on Google Drive{this.state.loading}
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
                        elsewhere in your Drive without breaking anything (but don't move or rename the files and
                        folders inside).
                    </p>
                    <InputButton type='button' onChange={() => {
                            this.createInitialStructure();
                    }}>
                        Create "{constants.FOLDER_ROOT}" folder in Drive
                    </InputButton>
                    <InputButton type='button' onChange={() => {
                        googleAPI.signOutFromFileAPI();
                    }}>
                        Sign out
                    </InputButton>
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