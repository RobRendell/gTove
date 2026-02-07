import {FunctionComponent, useCallback, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import PromiseModalContextBridge from '../context/promiseModalContextBridge';
import ErrorBoundaryContainer from '../presentation/errorBoundaryComponent';
import VirtualGamingTabletop from '../presentation/virtualGamingTabletop';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {setLoggedInUserAction} from '../redux/loggedInUserReducer';
import {getLoggedInUserFromStore} from '../redux/mainReducer';
import googleAPI from '../util/storage/providers/google/googleAPI';
import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import localFileSystemAPI from '../util/storage/providers/local/localFileSystemAPI';
import LocalFolderComponent from './localFolderComponent';
import DriveFolderComponent from './driveFolderComponent';
import OfflineFolderComponent from './offlineFolderComponent';
import PromiseModalDialog, {PromiseModalDialogType} from './promiseModalDialog';
import StorageOptionsPanel from '../presentation/storageOptionsPanel';

type StorageMode = 'drive' | 'local' | 'offline' | null;


const AuthenticatedContainer: FunctionComponent = () => {
    const loggedInUser = useSelector(getLoggedInUserFromStore);
    const [storageMode, setStorageMode] = useState<StorageMode>(null);
    const [signingIn, setSigningIn] = useState(false);
    const [signInError, setSignInError] = useState<string | null>(null);
    const promiseModal = useRef<PromiseModalDialogType | undefined>();
    const setPromiseModal = useCallback((modal) => {promiseModal.current = modal}, []);
    const dispatch = useDispatch();
    
    // Check for local storage support (no initialization needed)
    const localStorageSupported = 'showDirectoryPicker' in window;
    
    const handleGoogleSignIn = useCallback(async () => {
        setSigningIn(true);
        setSignInError(null);
        googleAPI.initialiseFileAPI(
            async (signedIn) => {
                if (signedIn) {
                    setStorageMode('drive');
                    const user = await googleAPI.getLoggedInUserInfo();
                    dispatch(setLoggedInUserAction(user));
                } else {
                    // User needs to click sign-in button
                    googleAPI.signInToFileAPI();
                }
            },
            (error) => {
                setSigningIn(false);
                setSignInError(`Google Drive error: ${error.message}`);
            }
        );
    }, [dispatch]);
    
    const handleLocalSignIn = useCallback(async () => {
        setSigningIn(true);
        setSignInError(null);
        localFileSystemAPI.initialiseFileAPI(
            async (signedIn) => {
                if (signedIn) {
                    setStorageMode('local');
                    const user = await localFileSystemAPI.getLoggedInUserInfo();
                    dispatch(setLoggedInUserAction(user));
                } else {
                    // User needs to pick a folder
                    localFileSystemAPI.signInToFileAPI();
                }
            },
            (error) => {
                setSigningIn(false);
                setSignInError(`Local storage error: ${error.message}`);
            }
        );
    }, [dispatch]);
    
    const handleOfflineSignIn = useCallback(async () => {
        setStorageMode('offline');
        dispatch(setCreateInitialStructureAction(true));
        offlineAPI.initialiseFileAPI(() => {}, () => {});
        const user = await offlineAPI.getLoggedInUserInfo();
        dispatch(setLoggedInUserAction(user));
    }, [dispatch]);
    
    const renderFolderComponent = () => {
        switch (storageMode) {
            case 'local':
                return (
                    <LocalFolderComponent>
                        <ErrorBoundaryContainer>
                            <VirtualGamingTabletop/>
                        </ErrorBoundaryContainer>
                    </LocalFolderComponent>
                );
            case 'offline':
                return (
                    <OfflineFolderComponent>
                        <ErrorBoundaryContainer>
                            <VirtualGamingTabletop/>
                        </ErrorBoundaryContainer>
                    </OfflineFolderComponent>
                );
            case 'drive':
            default:
                return (
                    <DriveFolderComponent>
                        <ErrorBoundaryContainer>
                            <VirtualGamingTabletop/>
                        </ErrorBoundaryContainer>
                    </DriveFolderComponent>
                );
        }
    };
    
    return (
        <div className='fullHeight'>
            <PromiseModalContextBridge value={promiseModal.current}>
                {
                    loggedInUser ? renderFolderComponent() : (
                        <StorageOptionsPanel
                            initialised={true}
                            signingIn={signingIn}
                            driveLoadError={!!signInError}
                            localStorageSupported={localStorageSupported}
                            onGoogleSignIn={handleGoogleSignIn}
                            onLocalSignIn={handleLocalSignIn}
                            onOfflineSignIn={handleOfflineSignIn}
                        />
                    )
                }
            </PromiseModalContextBridge>
            <PromiseModalDialog setPromiseComponent={setPromiseModal}/>
        </div>
    );
};

export default AuthenticatedContainer;
