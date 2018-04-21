import {Component} from 'react'
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import * as offlineUtils from '../util/offlineUtils';
import {getAllFilesFromStore, getTabletopIdFromStore} from '../redux/mainReducer';
import {addFilesAction} from '../redux/fileIndexReducer';
import * as constants from '../util/constants';
import OfflineTextureLoader from '../util/OfflineTextureLoader';

class OfflineFolderComponent extends Component {

    static childContextTypes = {
        fileAPI: PropTypes.object,
        textureLoader: PropTypes.object
    };

    constructor(props) {
        super(props);
        this.textureLoader = new OfflineTextureLoader();
        this.state = {
            loading: true
        };
    }

    componentWillMount() {
        if (!this.props.files || Object.keys(this.props.files.roots).length === 0) {
            return offlineUtils.createFolder(constants.FOLDER_ROOT)
                .then((rootMetadata) => {
                    const parents = [rootMetadata.id];
                    return Promise.all([
                        offlineUtils.createFolder(constants.FOLDER_MAP, {parents}),
                        offlineUtils.createFolder(constants.FOLDER_MINI, {parents}),
                        offlineUtils.createFolder(constants.FOLDER_SCENARIO, {parents}),
                        offlineUtils.createFolder(constants.FOLDER_TEMPLATE, {parents}),
                        offlineUtils.createFolder(constants.FOLDER_TABLETOP, {parents}),
                        offlineUtils.createFolder(constants.FOLDER_GM_DATA, {parents})
                    ])
                    .then((folderList) => {
                            this.props.dispatch(addFilesAction([rootMetadata, ...folderList]));
                        })
                    })
                .then(() => {
                    this.setState({loading: false});
                });
        }
    }

    getChildContext() {
        return {
            fileAPI: offlineUtils,
            textureLoader: this.textureLoader
        };
    }

    render() {
        return this.state.loading ? null : this.props.children;
    }
}

function mapStoreToProps(store) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store)
    }
}

export default connect(mapStoreToProps)(OfflineFolderComponent);