import {Component, PropsWithChildren} from 'react'
import {connect} from 'react-redux';

import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import {getAllFilesFromStore, getTabletopIdFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import * as constants from '../util/constants';
import OfflineTextureLoader from '../util/storage/providers/offline/offlineTextureLoader';
import FileAPIContextBridge from '../context/fileAPIContextBridge';

interface OfflineFolderComponentProps extends GtoveDispatchProp {
    files: FileIndexReducerType;
    tabletopId: string;
}

interface OfflineFolderComponentState {
    loading: boolean;
}

class OfflineFolderComponent extends Component<PropsWithChildren<OfflineFolderComponentProps>, OfflineFolderComponentState> {

    private textureLoader: OfflineTextureLoader;

    constructor(props: OfflineFolderComponentProps) {
        super(props);
        this.textureLoader = new OfflineTextureLoader();
        this.state = {
            loading: true
        };
    }

    async componentDidMount() {
        if (!this.props.files || Object.keys(this.props.files.roots).length === 0) {
            const folderList = [];
            folderList.push(await offlineAPI.createFolder(constants.FOLDER_ROOT));
            const parents = [folderList[0].id];
            for (let rootFolder of constants.topLevelFolders) {
                folderList.push(await offlineAPI.createFolder(rootFolder, {parents}));
            }
            this.props.dispatch(addRootFilesAction(folderList));
            this.setState({loading: false});
        }
    }

    render() {
        return this.state.loading ? null : (
            <FileAPIContextBridge fileAPI={offlineAPI} textureLoader={this.textureLoader}>
                {this.props.children}
            </FileAPIContextBridge>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store)
    }
}

export default connect(mapStoreToProps)(OfflineFolderComponent);