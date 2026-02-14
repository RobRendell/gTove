import {useGranularEffect} from 'granular-hooks';
import {FunctionComponent, PropsWithChildren, useCallback, useContext, useRef, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';

import FileAPIContextBridge from '../context/fileAPIContextBridge';
import {PromiseModalContextObject} from '../context/promiseModalContextBridge';
import InputButton from '../presentation/inputButton';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {addRootFilesAction} from '../redux/fileIndexReducer';
import {getAllFilesFromStore, getBundleIdFromStore, getTabletopIdFromStore} from '../redux/mainReducer';
import * as constants from '../util/constants';
import DriveTextureLoader from '../util/storage/providers/google/driveTextureLoader';
import googleAPI from '../util/storage/providers/google/googleAPI';
import {FileMetadata, RootDirAppProperties} from '../util/storage/storageContract';

const DriveFolderComponent: FunctionComponent<PropsWithChildren> = ({children}) => {
    const files = useSelector(getAllFilesFromStore);
    const tabletopId = useSelector(getTabletopIdFromStore);
    const bundleId = useSelector(getBundleIdFromStore);
    const textureLoaderRef = useRef(new DriveTextureLoader());
    const [loading, setLoading] = useState(': Loading...');
    const [migrating, setMigrating] = useState('');

    const store = useStore();
    const dispatch = useDispatch();
    
    const promiseModal = useContext(PromiseModalContextObject);

    const migrateDriveData = useCallback(async () => {
        const files = getAllFilesFromStore(store.getState());
        const rootId = files.roots[constants.FOLDER_ROOT];
        const rootMetadata = files.fileMetadata[rootId] as FileMetadata<RootDirAppProperties, void>;
        if (!rootId || !rootMetadata) {
            throw new Error('Invoked migration with no folders in Drive');
        }
        const dataVersion = (rootMetadata.appProperties && +rootMetadata.appProperties.dataVersion) || 1;
        let migrated = true;
        setMigrating('...');
        switch (dataVersion) {
            // @ts-ignore falls through
            case 1:
                if (!promiseModal?.isAvailable()) {
                    migrated = false;
                } else {
                    await promiseModal({
                        children: (
                            <div>
                                <h2>Unsupported old data detected</h2>
                                <p>
                                    The location that gTove stored its metadata changed in April 2020. Automatic
                                    migration of this old metadata is no longer supported.
                                </p>
                                <p>
                                    All your maps and minis in Drive are still usable in gTove, but the metadata
                                    containing your grids and mini layout data has been lost. You will need to manually
                                    create the map grid layouts and mini image framing again (by clicking ... on the
                                    image and selecting "Edit").
                                </p>
                                <p>
                                    The affected maps and minis will be marked as "New", as if they had just been
                                    uploaded.
                                </p>
                            </div>
                        )
                    });
                }
            // falls through
            default:
                break;
        }
        setMigrating('Finishing migration.');
        if (migrated && dataVersion !== constants.DATA_VERSION) {
            await googleAPI.uploadFileMetadata({id: rootId, appProperties: {rootFolder: 'true', dataVersion: constants.DATA_VERSION.toString()}});
        }
        setMigrating('');
    }, [promiseModal, store]);

    const verifyUserDriveContents = useCallback(async (parents: string[]) => {
        const files = getAllFilesFromStore(store.getState());
        const missingFolders = constants.topLevelFolders.filter((folderName) => (!files.roots[folderName]));
        if (missingFolders.length) {
            debugger;
            let newFolders: FileMetadata[] = [];
            for (let folderName of missingFolders) {
                setLoading(`: Creating ${folderName} folder...`);
                newFolders.push(await googleAPI.createFolder(folderName, {parents}));
            }
            dispatch(addRootFilesAction(newFolders));
        }
        await migrateDriveData();
    }, [dispatch, migrateDriveData, store]);

    const createInitialStructure = useCallback(async () => {
        dispatch(setCreateInitialStructureAction(true));
        setLoading('...');
        const metadata = await googleAPI.createFolder(constants.FOLDER_ROOT, {appProperties: {rootFolder: 'true', dataVersion: constants.DATA_VERSION.toString()}});
        dispatch(addRootFilesAction([metadata]));
        await verifyUserDriveContents([metadata.id]);
        setLoading('');
    }, [dispatch, verifyUserDriveContents]);

    useGranularEffect(() => {
        let isCurrent = true;
        const initialise = async () => {
            await googleAPI.loadRootFiles((files: FileMetadata[]) => {dispatch(addRootFilesAction(files))});
            const files = getAllFilesFromStore(store.getState());
            const rootId = files.roots[constants.FOLDER_ROOT];
            if (rootId && isCurrent) {
                await verifyUserDriveContents([rootId]);
            }
            setLoading('');
        };
        void initialise();
        return () => {
            isCurrent = false;
        }
    }, [], [dispatch, store, verifyUserDriveContents]);

    return migrating ? (
        <div>
            <p>gTove is migrating your existing data.  Please wait...</p>
            <p>{migrating}</p>
        </div>
    ) : loading ? (
        <div>
            Waiting on Google Drive{loading}
        </div>
    ) : ((files && Object.keys(files.roots).length > 0) || (tabletopId && tabletopId !== bundleId)) ? (
        <FileAPIContextBridge fileAPI={googleAPI} textureLoader={textureLoaderRef.current}>
            {children}
        </FileAPIContextBridge>
    ) : (
        <div>
            <p>
                gTove saves its data in a folder structure created in your Google Drive. Click the button below
                to create these folders. After they are created, you can rename the top-level folder and move it
                elsewhere in your Drive without breaking anything (but don't move or rename the files and
                folders inside).
            </p>
            <InputButton type='button' onChange={() => {
                void createInitialStructure();
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

export default DriveFolderComponent;