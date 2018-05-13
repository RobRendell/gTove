import {Component} from 'react'
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import offlineAPI from '../util/offlineAPI';
import {getAllFilesFromStore, getTabletopIdFromStore, ReduxStoreType} from '../redux/mainReducer';
import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import * as constants from '../util/constants';
import OfflineTextureLoader from '../util/offlineTextureLoader';
import {Dispatch} from 'redux';
import {FileAPIContext} from '../util/fileUtils';
import {TextureLoaderContext} from '../util/driveTextureLoader';

interface OfflineFolderComponentProps {
    dispatch: Dispatch<ReduxStoreType>;
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

    componentWillMount() {
        if (!this.props.files || Object.keys(this.props.files.roots).length === 0) {
            offlineAPI.createFolder(constants.FOLDER_ROOT)
                .then((rootMetadata) => {
                    const parents = [rootMetadata.id];
                    return Promise.all([
                        offlineAPI.createFolder(constants.FOLDER_MAP, {parents}),
                        offlineAPI.createFolder(constants.FOLDER_MINI, {parents}),
                        offlineAPI.createFolder(constants.FOLDER_SCENARIO, {parents}),
                        offlineAPI.createFolder(constants.FOLDER_TEMPLATE, {parents}),
                        offlineAPI.createFolder(constants.FOLDER_TABLETOP, {parents}),
                        offlineAPI.createFolder(constants.FOLDER_GM_DATA, {parents})
                    ])
                    .then((folderList) => {
                            this.props.dispatch(addRootFilesAction([rootMetadata, ...folderList]));
                        })
                    })
                .then(() => {
                    this.setState({loading: false});
                });
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