import {FunctionComponent, useEffect, useRef, useState} from 'react';
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
    const storageModeRef = useRef<StorageMode>(null);
    const gDriveSignInHandlerRef = useRef<(signedIn: boolean) => Promise<void>>(async () => {});

    const [storageLoadingError, setStorageLoadingError] = useState(false);
    const [gDriveInitialized, setGDriveInitialized] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const dispatch = useDispatch();

    gDriveSignInHandlerRef.current = async (signedIn: boolean) => {
        const mode = storageModeRef.current;
        if (signedIn && mode === 'drive') {
            const user = await googleAPI.getLoggedInUserInfo();
            dispatch(setLoggedInUserAction(user));
        } else if (mode === 'drive') {
            dispatch(setLoggedInUserAction(null));
            setSigningIn(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        let initFailed = false;
        void (async () => {
            try {
                await (googleAPI.initialiseFileAPI(
                    (signedIn) => void gDriveSignInHandlerRef.current(signedIn),
                    (e) => {
                        initFailed = true;
                        console.error(e);
                        setStorageLoadingError(true);
                    }
                ));
                if (!cancelled && !initFailed) {
                    setGDriveInitialized(true);
                }
            } catch (e) {
                console.error(e);
                setStorageLoadingError(true);
            }
        })();
        return () => {
            cancelled = true;
            dispatch(setTabletopIdAction());
        };
    }, [dispatch]);

    const handleGoogleSignIn = () => {
        storageModeRef.current = 'drive';
        setSigningIn(true);
        googleAPI.signInToFileAPI();
    };

    const handleLocalSignIn = async () => {
        setSigningIn(true);
        setStorageLoadingError(false);
        localFileSystemAPI.initialiseFileAPI(
            async (signedIn) => {
                if (signedIn) {
                    storageModeRef.current = 'local';
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
    };

    const handleOfflineSignIn = async () => {
        storageModeRef.current = 'offline';
        dispatch(setCreateInitialStructureAction(true));
        offlineAPI.initialiseFileAPI(
            (signedIn) => void gDriveSignInHandlerRef.current(signedIn),
            () => {}
        );
        const user = await offlineAPI.getLoggedInUserInfo();
        dispatch(setLoggedInUserAction(user));
    };

    const renderFolderComponent = () => {
        switch (storageModeRef.current) {
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
