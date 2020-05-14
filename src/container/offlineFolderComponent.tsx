import {Component} from 'react'
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import offlineAPI from '../util/offlineAPI';
import {getAllFilesFromStore, getTabletopIdFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import * as constants from '../util/constants';
import OfflineTextureLoader from '../util/offlineTextureLoader';
import {FileAPIContext} from '../util/fileUtils';
import {TextureLoaderContext} from '../util/driveTextureLoader';

interface OfflineFolderComponentProps extends GtoveDispatchProp {
    files: FileIndexReducerType;
    tabletopId: string;
}

interface OfflineFolderComponentState {
    loading: boolean;
}

class OfflineFolderComponent extends Component<OfflineFolderComponentProps, OfflineFolderComponentState> {

    static childContextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object
    };

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

    getChildContext(): FileAPIContext & TextureLoaderContext {
        return {
            fileAPI: offlineAPI,
            textureLoader: this.textureLoader
        };
    }

    render() {
        return this.state.loading ? null : this.props.children;
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store)
    }
}

export default connect(mapStoreToProps)(OfflineFolderComponent);