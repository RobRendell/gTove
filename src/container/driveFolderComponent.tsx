import {Component, PropsWithChildren} from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {addRootFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {
    getAllFilesFromStore,
    getBundleIdFromStore,
    getTabletopIdFromStore,
    GtoveDispatchProp,
    ReduxStoreType
} from '../redux/mainReducer';
import googleAPI from '../util/storage/providers/google/googleAPI';
import * as constants from '../util/constants';
import DriveTextureLoader from '../util/storage/providers/google/driveTextureLoader';
import {
    FileMetadata,
    RootDirAppProperties,
    TabletopObjectProperties
} from '../util/storage/storageContract';
import { isFileShortcut } from '../util/storage/storageUtils';
import FileAPIContextBridge from '../context/fileAPIContextBridge';
import InputButton from '../presentation/inputButton';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {promiseSleep} from '../util/promiseSleep';

interface DriveFolderComponentProps extends GtoveDispatchProp{
    files: FileIndexReducerType;
    tabletopId: string;
    bundleId: string | null;
}

interface DriveFolderComponentState {
    loading: string;
    migrating: string;
}

class DriveFolderComponent extends Component<PropsWithChildren<DriveFolderComponentProps>, DriveFolderComponentState> {

    static DATA_VERSION = 2;

    static contextTypes = {
        promiseModal: PropTypes.func
    };

    context: PromiseModalContext;

    private textureLoader: DriveTextureLoader;

    constructor(props: DriveFolderComponentProps) {
        super(props);
        this.state = {
            loading: ': Loading...',
            migrating: ''
        };
        this.textureLoader = new DriveTextureLoader();
    }

    async componentDidMount() {
        await googleAPI.loadRootFiles((files: FileMetadata[]) => {this.props.dispatch(addRootFilesAction(files))});
        const rootId = this.props.files.roots[constants.FOLDER_ROOT];
        if (rootId) {
            const rootMetadata = this.props.files.fileMetadata[rootId] as FileMetadata<RootDirAppProperties, void>;
            const dataVersion = (rootMetadata.appProperties && +rootMetadata.appProperties.dataVersion) || 1;
            await this.verifyUserDriveContents([rootId], dataVersion);
        }
        this.setState({loading: ''});
    }

    private async recursivelyAddFilesInFolder(folder: string, fileId: string, result: FileMetadata[]) {
        this.setState({migrating: 'Scanning ' + folder});
        let filesInFolder: FileMetadata[] = [];
        await googleAPI.loadFilesInFolder(fileId, (result) => {filesInFolder = result});
        if (filesInFolder.length > 0) {
            for (let file of filesInFolder) {
                const isFolder = (file.mimeType === constants.MIME_TYPE_DRIVE_FOLDER);
                if (isFolder) {
                    await this.recursivelyAddFilesInFolder(folder + '/' + file.name, file.id, result);
                } else {
                    result.push(file);
                }
            }
        }
    }

    private async migrateAppPropertiesToProperties(): Promise<boolean> {
        const folderFiles: {[folder: string]: FileMetadata[]} = {};
        let migrateCount = 0;
        const folderList = [constants.FOLDER_MAP, constants.FOLDER_MINI, constants.FOLDER_TEMPLATE];
        // Recursively search the different folders
        for (let folder of folderList) {
            folderFiles[folder] = [];
            await this.recursivelyAddFilesInFolder(folder, this.props.files.roots[folder], folderFiles[folder]);
            migrateCount += folderFiles[folder].length;
        }
        if (migrateCount > 0) {
            if (!this.context.promiseModal?.isAvailable()) {
                return false;
            }
            const proceedAnswer = 'Migrate my data!';
            const answer = await this.context.promiseModal({
                children: (
                    <div>
                        <h2>gTove Data Migration</h2>
                        <p>
                            The location that gTove stores its metadata has changed!  Your Drive
                            has {migrateCount} files which need to be updated to the new format.  This may take
                            some time (a few seconds for each file).
                        </p>
                        <p>
                            This migration is part of the change which allows gTove to reduce the permissions it needs...
                            you no longer need to give the app read access to your entire Drive! This improvement is
                            hopefully worth the inconvenience of the migration.
                        </p>
                        <p>
                            You can migrate your data now, or skip this operation.  Note that until your old files are
                            migrated, they will appear as if you just uploaded or created them... the will not appear on
                            your tabletops, and will be marked as "NEW" in the file browsers.
                        </p>
                        <p>
                            Any new maps, minis or templates you upload or create from now on will use the new format,
                            and can be used as normal, even if you do not migrate your old data now.
                        </p>
                    </div>
                ),
                options: [proceedAnswer, 'Skip migration for now']
            });
            if (answer !== proceedAnswer) {
                return false;
            }
            let count = 0;
            for (let folder of folderList) {
                const oldFiles = folderFiles[folder];
                oldFiles.sort((f1, f2) => (f1.name < f2.name ? -1 : f1.name > f2.name ? 1 : 0));
                for (let file of oldFiles) {
                    ++count;
                    if (file.appProperties || (file.properties && !(file.properties as TabletopObjectProperties).rootFolder)) {
                        // Only migrate files which need migrating
                        this.setState({migrating: `Migrating ${count} of ${migrateCount} - ${folder}: ${file.name}`});
                        file.properties = {...file.appProperties, ...file.properties, rootFolder: folder} as any;
                        if (file.appProperties) {
                            file.appProperties = Object.keys(file.appProperties as any).reduce((clean, key) => {
                                (clean as any)[key] = null;
                                return clean;
                            }, {}) as any;
                        }
                        if (isFileShortcut(file) && file.properties!.ownedMetadataId) {
                            file.id = file.properties!.ownedMetadataId;
                            // @ts-ignore deleting non-optional field of DriveFileShortcut
                            delete(file.properties.ownedMetadataId);
                        }
                        await googleAPI.uploadFileMetadata(file);
                    } else {
                        this.setState({migrating: `Skipping ${count} of ${migrateCount} - ${folder}: ${file.name}`});
                        await promiseSleep(10);
                    }
                }
            }
        }
        return true;
    }

    async migrateDriveData(rootId: string, dataVersion: number) {
        let migrated = true;
        this.setState({migrating: '...'});
        switch (dataVersion) {
            // @ts-ignore falls through
            case 1:
                migrated = migrated && await this.migrateAppPropertiesToProperties();
                // falls through
            default:
                break;
        }
        this.setState({migrating: ''});
        if (migrated && dataVersion !== DriveFolderComponent.DATA_VERSION) {
            await googleAPI.uploadFileMetadata({id: rootId, appProperties: {rootFolder: 'true', dataVersion: DriveFolderComponent.DATA_VERSION.toString()}});
        }
    }

    async verifyUserDriveContents(parents: string[], dataVersion: number) {
        const missingFolders = constants.topLevelFolders.filter((folderName) => (!this.props.files.roots[folderName]));
        let newFolders: FileMetadata[] = [];
        for (let folderName of missingFolders) {
            this.setState({loading: `: Creating ${folderName} folder...`});
            newFolders.push(await googleAPI.createFolder(folderName, {parents}));
        }
        this.props.dispatch(addRootFilesAction(newFolders));
        // Check if we need to migrate their existing data.
        await this.migrateDriveData(parents[0], dataVersion);
    }

    async createInitialStructure() {
        this.props.dispatch(setCreateInitialStructureAction(true));
        this.setState({loading: '...'});
        const metadata = await googleAPI.createFolder(constants.FOLDER_ROOT, {appProperties: {rootFolder: 'true', dataVersion: DriveFolderComponent.DATA_VERSION.toString()}});
        this.props.dispatch(addRootFilesAction([metadata]));
        await this.verifyUserDriveContents([metadata.id], DriveFolderComponent.DATA_VERSION);
        this.setState({loading: ''});
    }

    render() {
        if (this.state.migrating) {
            return (
                <div>
                    <p>gTove is migrating your existing data.  Please wait...</p>
                    <p>{this.state.migrating}</p>
                </div>
            );
        } else if (this.state.loading) {
            return (
                <div>
                    Waiting on Google Drive{this.state.loading}
                </div>
            );
        } else if ((this.props.files && Object.keys(this.props.files.roots).length > 0) || (this.props.tabletopId && this.props.tabletopId !== this.props.bundleId)) {
            return (
                <FileAPIContextBridge fileAPI={googleAPI} textureLoader={this.textureLoader}>
                    {this.props.children}
                </FileAPIContextBridge>
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