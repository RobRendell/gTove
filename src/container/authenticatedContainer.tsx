import {FunctionComponent, useCallback, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {v4} from 'uuid';

import CameraParametersProvider from '../context/cameraParametersProvider';
import ErrorBoundaryContainer from '../presentation/errorBoundaryComponent';
import PromiseModalProvider from '../context/promiseModalProvider';
import ToastProvider from '../context/toastProvider';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {setTabletopIdAction} from '../redux/locationReducer';
import {setLoggedInUserAction} from '../redux/loggedInUserReducer';
import {getLoggedInUserFromStore} from '../redux/mainReducer';
import {setMyPeerIdAction} from '../redux/myPeerIdReducer';
import googleAPI from '../util/storage/providers/google/googleAPI';
import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import StorageOptionsPanel from '../presentation/storageOptionsPanel';
import localFileSystemAPI from '../util/storage/providers/local/localFileSystemAPI';
import LocalFolderComponent from './localFolderComponent';
import GTove from '../presentation/gTove';
import OfflineFolderComponent from './offlineFolderComponent';
import DriveFolderComponent from './driveFolderComponent';

type StorageMode = 'drive' | 'local' | 'offline' | null;
const localStorageSupported = 'showDirectoryPicker' in window;

const AuthenticatedContainer: FunctionComponent = () => {
    const loggedInUser = useSelector(getLoggedInUserFromStore);
    const [storageMode, setStorageMode] = useState<StorageMode>(null);
    const [storageLoadingError, setStorageLoadingError] = useState(false);
    const [gDriveInitialized, setGDriveInitialized] = useState(false);

    const [signingIn, setSigningIn] = useState(false);
    const dispatch = useDispatch();
    const gDriveSignInHandler = useCallback(async (signedIn: boolean) => {
        if (signedIn && storageMode == 'drive') {
            setGDriveInitialized(true);
            setSigningIn(true);
            const user = await googleAPI.getLoggedInUserInfo();
            dispatch(setLoggedInUserAction(user));
        } else if (storageMode === 'drive') {
            dispatch(setLoggedInUserAction(null));
            setSigningIn(false);
        }
    }, [dispatch]);
    useEffect(() => {
        try {
            googleAPI.initialiseFileAPI(gDriveSignInHandler, (e) => {
                console.error(e);
                setStorageLoadingError(true);
            });
        } catch (e) {
            console.error(e);
            setStorageLoadingError(true);
        }
        return () => {
            dispatch(setTabletopIdAction());
        };
    }, [gDriveSignInHandler, dispatch]);

    const handleGoogleSignIn = useCallback(() => {
        setSigningIn(true);
        googleAPI.signInToFileAPI();
        setStorageMode('drive');
    }, []);

    const handleLocalSignIn = useCallback(async () => {
        setSigningIn(true);
        setStorageLoadingError(false);
        localFileSystemAPI.initialiseFileAPI(
            async (signedIn) => {
                if (signedIn) {
                    setStorageMode('local');
                    const user = await localFileSystemAPI.getLoggedInUserInfo();
                    dispatch(setLoggedInUserAction(user));
                    // todo for now just generate a new peer id for local storage, later use some actual comms
                    dispatch(setMyPeerIdAction(v4()));
                } else {
                    localFileSystemAPI.signInToFileAPI();
                }
                setSigningIn(false);
            },
            (error) => {
                setSigningIn(false);
                setStorageLoadingError(true);
                console.error('Local storage error:', error);
            }
        );
    }, [dispatch]);

    const handleOfflineSignIn = useCallback(async () => {
        dispatch(setCreateInitialStructureAction(true));
        offlineAPI.initialiseFileAPI(gDriveSignInHandler, () => {});
        const user = await offlineAPI.getLoggedInUserInfo();
        dispatch(setLoggedInUserAction(user));
        setStorageMode('offline');
    }, [gDriveSignInHandler, dispatch]);
    
    const renderFolderComponent = () => {
        switch (storageMode) {
            case 'local':
                return (
                    <LocalFolderComponent>
                        <ErrorBoundaryContainer>
                            <GTove/>
                        </ErrorBoundaryContainer>
                    </LocalFolderComponent>
                );
            case 'drive':
            default:
                return (
                    <DriveFolderComponent>
                        <ErrorBoundaryContainer>
                            <GTove/>
                        </ErrorBoundaryContainer>
                    </DriveFolderComponent>
                );
            case 'offline':
                return (
                    <OfflineFolderComponent>
                        <ErrorBoundaryContainer>
                            <GTove/>
                        </ErrorBoundaryContainer>
                    </OfflineFolderComponent>
                );
        }
    };

    return (
        <div className='fullHeight'>
            <PromiseModalProvider>
                <ToastProvider>
                    <CameraParametersProvider>
                    {
                    loggedInUser ? renderFolderComponent() : (
                    <StorageOptionsPanel
                            gDriveInitialized={gDriveInitialized}
                            signingIn={signingIn}
                            driveLoadError={storageLoadingError}
                            localStorageSupported={localStorageSupported}
                            onGoogleSignIn={handleGoogleSignIn}
                            onLocalSignIn={handleLocalSignIn}
                            onOfflineSignIn={handleOfflineSignIn}/> 
                    )}
                    </CameraParametersProvider>
                </ToastProvider>
            </PromiseModalProvider>
        </div>
    );
};

export default AuthenticatedContainer;