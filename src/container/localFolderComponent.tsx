import {Component, PropsWithChildren} from 'react';
import {connect} from 'react-redux';

import localFileSystemAPI from '../util/storage/providers/local/localFileSystemAPI';
import {getAllFilesFromStore, getTabletopIdFromStore, GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducer';
import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import LocalTextureLoader from '../util/storage/providers/local/localTextureLoader';
import FileAPIContextBridge from '../context/fileAPIContextBridge';

interface LocalFolderComponentProps extends GtoveDispatchProp {
    files: FileIndexReducerType;
    tabletopId: string;
}

interface LocalFolderComponentState {
    loading: boolean;
    error?: string;
}

/**
 * Component that manages the local file system storage provider.
 * Wraps children with the FileAPI and TextureLoader contexts for local storage.
 */
class LocalFolderComponent extends Component<PropsWithChildren<LocalFolderComponentProps>, LocalFolderComponentState> {

    private textureLoader: LocalTextureLoader;

    constructor(props: LocalFolderComponentProps) {
        super(props);
        this.textureLoader = new LocalTextureLoader();
        this.state = {
            loading: true
        };
    }

    async componentDidMount() {
        try {
            // Load existing root files from the local file system
            await localFileSystemAPI.loadRootFiles((files) => {
                if (files.length > 0) {
                    this.props.dispatch(addRootFilesAction(files));
                }
            });
            this.setState({loading: false});
        } catch (error: any) {
            console.error('Error loading local files:', error);
            this.setState({loading: false, error: error.message});
        }
    }

    render() {
        if (this.state.error) {
            return (
                <div className='normalMargin'>
                    <p>Error loading local storage: {this.state.error}</p>
                </div>
            );
        }
        
        if (this.state.loading) {
            return (
                <div className='normalMargin'>
                    <p>Loading from local storage...</p>
                </div>
            );
        }
        
        return (
            <FileAPIContextBridge fileAPI={localFileSystemAPI} textureLoader={this.textureLoader}>
                {this.props.children}
            </FileAPIContextBridge>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store)
    };
}

export default connect(mapStoreToProps)(LocalFolderComponent);
