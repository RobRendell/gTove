import {Component, PropsWithChildren} from 'react'
import {connect} from 'react-redux';

import FileAPIProvider from '../context/fileAPIProvider';
import {addRootFilesAction} from '../redux/fileIndexReducer';
import {FileIndexReducerType} from '../redux/fileIndexReducerTypes';
import {getAllFilesFromStore, getTabletopIdFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import * as constants from '../util/constants';
import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import OfflineTextureLoader from '../util/storage/providers/offline/offlineTextureLoader';

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
            <FileAPIProvider fileAPI={offlineAPI} textureLoader={this.textureLoader}>
                {this.props.children}
            </FileAPIProvider>
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