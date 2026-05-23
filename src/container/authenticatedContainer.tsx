import {
    ComponentType,
    Dispatch,
    FunctionComponent,
    PropsWithChildren,
    SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {v4} from 'uuid';

import CameraParametersProvider from '../context/cameraParametersProvider';
import PromiseModalProvider from '../context/promiseModalProvider';
import ToastProvider from '../context/toastProvider';
import ErrorBoundaryDisplayComponent from '../presentation/errorBoundaryDisplayComponent';
import GTove from '../presentation/gTove';
import StorageOptionsPanel, {ApiStorageState} from '../presentation/storageOptionsPanel';
import {setCommsNodeClass} from '../redux/communicationMiddleware';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {setTabletopIdAction} from '../redux/locationReducer';
import {setLoggedInUserAction} from '../redux/loggedInUserReducer';
import {getLoggedInUserFromStore} from '../redux/mainReducer';
import {setMyPeerIdAction} from '../redux/myPeerIdReducer';
import {FirebaseNode} from '../util/firebaseNode';
import googleAPI from '../util/storage/providers/google/googleAPI';
import localFileSystemAPI from '../util/storage/providers/local/localFileSystemAPI';
import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import {FileAPI} from '../util/storage/storageContract';
import DriveFolderComponent from './driveFolderComponent';
import ErrorBoundaryContainer from './errorBoundaryContainer';
import LocalFolderComponent from './localFolderComponent';
import OfflineFolderComponent from './offlineFolderComponent';

type StorageMode = 'drive' | 'local' | 'offline';

const storageModeComponents: {[value in StorageMode]: ComponentType<PropsWithChildren>} = {
    local: LocalFolderComponent,
    drive: DriveFolderComponent,
    offline: OfflineFolderComponent
}

const AuthenticatedContainer: FunctionComponent = () => {
    const loggedInUser = useSelector(getLoggedInUserFromStore);
    const dispatch = useDispatch();

    const storageModeRef = useRef<StorageMode | null>(null);

    const [googleAPIState, setGoogleAPIState] = useState<ApiStorageState>('uninitialised');
    const [localAPIState, setLocalAPIState] = useState<ApiStorageState>('uninitialised');

    useEffect(() => {
        // Always use FirebaseNode for now
        setCommsNodeClass(FirebaseNode);
        return () => {
            setCommsNodeClass(null);
        }
    }, []);

    // Common API initialise function to reduce boilerplate
    const initialiseFileAPI = useCallback(async (
        api: FileAPI,
        mode: StorageMode,
        setAPIState: Dispatch<SetStateAction<ApiStorageState>>,
        onSignIn?: (signedIn: boolean) => Promise<void>
    ) => {
        await api.initialiseFileAPI(
            () => {
                setAPIState('initialised');
            },
            async (signedIn) => {
                if (storageModeRef.current === null || storageModeRef.current === mode) {
                    if (signedIn) {
                        storageModeRef.current = mode;
                        setAPIState('signingIn');
                        const user = await api.getLoggedInUserInfo();
                        dispatch(setLoggedInUserAction(user));
                    } else {
                        storageModeRef.current = null;
                        setAPIState('initialised');
                        dispatch(setLoggedInUserAction(null));
                        dispatch(setTabletopIdAction());
                    }
                    await onSignIn?.(signedIn)
                }
            },
            (error) => {
                setAPIState('error');
                console.error(`${mode} error:`, error);
            }
        );
    }, [dispatch]);
    
    const handleLocalSignIn = useCallback(() => {
        storageModeRef.current = 'local';
        setLocalAPIState('signingIn');
        localFileSystemAPI.signInToFileAPI();
    }, []);
    
    const handleGoogleSignIn = useCallback(() => {
        storageModeRef.current = 'drive';
        setGoogleAPIState('signingIn');
        googleAPI.signInToFileAPI();
    }, []);

    const handleOfflineSignIn = useCallback(async () => {
        storageModeRef.current = 'offline';
        dispatch(setCreateInitialStructureAction(true));
        const user = await offlineAPI.getLoggedInUserInfo();
        dispatch(setLoggedInUserAction(user));
    }, [dispatch]);

    useEffect(() => {
        // Initialise the real FileAPIs when the component mounts
        void initialiseFileAPI(localFileSystemAPI, 'local', setLocalAPIState, async (signedIn) => {
            if (signedIn) {
                // todo for now just generate a new peer id for local storage, later use some actual comms
                dispatch(setMyPeerIdAction(v4()));
            }
        });
        void initialiseFileAPI(googleAPI, 'drive', setGoogleAPIState);
    }, [dispatch, initialiseFileAPI]);

    // Not memoised, since a) it depends on a ref, and b) the values are stable.
    const StorageComponent = !storageModeRef.current ? null : storageModeComponents[storageModeRef.current];

    return (
        <div className='fullHeight'>
            <PromiseModalProvider>
                <ToastProvider>
                    <CameraParametersProvider>
                    {
                        (loggedInUser && StorageComponent) ? (
                            <StorageComponent>
                                <ErrorBoundaryContainer errorDisplay={ErrorBoundaryDisplayComponent}>
                                    <GTove/>
                                </ErrorBoundaryContainer>
                            </StorageComponent>
                        ) : (
                            <StorageOptionsPanel
                                googleAPIState={googleAPIState}
                                onGoogleSignIn={handleGoogleSignIn}
                                localAPIState={localAPIState}
                                onLocalSignIn={handleLocalSignIn}
                                onOfflineSignIn={handleOfflineSignIn}/>
                        )
                    }
                    </CameraParametersProvider>
                </ToastProvider>
            </PromiseModalProvider>
        </div>
    );
};

export default AuthenticatedContainer;
