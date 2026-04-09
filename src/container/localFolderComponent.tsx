import {Component, PropsWithChildren} from 'react';
import {connect} from 'react-redux';

import localFileSystemAPI from '../util/storage/providers/local/localFileSystemAPI';
import {getAllFilesFromStore, getTabletopIdFromStore} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import {addRootFilesAction} from '../redux/fileIndexReducer';
import {FileIndexReducerType} from '../redux/fileIndexReducerTypes';
import LocalTextureLoader from '../util/storage/providers/local/localTextureLoader';
import FileAPIProvider from '../context/fileAPIProvider';

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
 * Provides a FileAPI and TextureLoader context for local storag as context for its children.
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
            <FileAPIProvider fileAPI={localFileSystemAPI} textureLoader={this.textureLoader}>
                {this.props.children}
            </FileAPIProvider>
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
