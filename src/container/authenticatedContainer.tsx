import {FunctionComponent, useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import DriveFolderComponent from './driveFolderComponent';
import googleAPI from '../util/storage/providers/google/googleAPI';
import {discardStoreAction, getLoggedInUserFromStore} from '../redux/mainReducer';
import VirtualGamingTabletop from '../presentation/virtualGamingTabletop';
import {setLoggedInUserAction} from '../redux/loggedInUserReducer';
import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import localFileSystemAPI from '../util/storage/providers/local/localFileSystemAPI';
import OfflineFolderComponent from './offlineFolderComponent';
import LocalFolderComponent from './localFolderComponent';
import PromiseModalDialog, {PromiseModalDialogType} from './promiseModalDialog';
import PromiseModalContextBridge from '../context/promiseModalContextBridge';
import {setTabletopIdAction} from '../redux/locationReducer';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import ErrorBoundaryContainer from '../presentation/errorBoundaryComponent';
import StorageOptionsPanel from '../presentation/storageOptionsPanel';

type StorageMode = 'drive' | 'local' | 'offline' | null;

const AuthenticatedContainer: FunctionComponent = () => {
    const loggedInUser = useSelector(getLoggedInUserFromStore);
    const [initialised, setInitialised] = useState(false);
    const [driveLoadError, setDriveLoadError] = useState(false);
    const [storageMode, setStorageMode] = useState<StorageMode>(null);
    const [signingIn, setSigningIn] = useState(false);
    const [localStorageSupported, setLocalStorageSupported] = useState(false);
    const promiseModal = useRef<PromiseModalDialogType | undefined>();
    const setPromiseModal = useCallback((modal) => {promiseModal.current = modal}, []);
    const dispatch = useDispatch();
    
    const signInHandler = useCallback(async (signedIn: boolean, mode: StorageMode, api: typeof googleAPI) => {
        setInitialised(true);
        if (signedIn) {
            setSigningIn(true);
            setStorageMode(mode);
            const user = await api.getLoggedInUserInfo();
            dispatch(setLoggedInUserAction(user));
        } else {
            dispatch(discardStoreAction());
            setSigningIn(false);
            setStorageMode(null);
        }
    }, [dispatch]);
    
    const driveSignInHandler = useCallback((signedIn: boolean) => 
        signInHandler(signedIn, 'drive', googleAPI), [signInHandler]);
    
    const localSignInHandler = useCallback((signedIn: boolean) => 
        signInHandler(signedIn, 'local', localFileSystemAPI), [signInHandler]);
    
    useEffect(() => {
        setLocalStorageSupported('showDirectoryPicker' in window);
        try {
            googleAPI.initialiseFileAPI(driveSignInHandler, (e) => {
                console.error(e);
                setDriveLoadError(true);
            });
            if ('showDirectoryPicker' in window) {
                localFileSystemAPI.initialiseFileAPI(localSignInHandler, () => {});
            }
        } catch (e) {
            console.error(e);
            setDriveLoadError(true);
        }
        return () => {
            dispatch(setTabletopIdAction());
        };
    }, [driveSignInHandler, localSignInHandler, dispatch]);
    
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
                            initialised={initialised}
                            signingIn={signingIn}
                            driveLoadError={driveLoadError}
                            localStorageSupported={localStorageSupported}
                            onGoogleSignIn={() => {
                                setSigningIn(true);
                                googleAPI.signInToFileAPI();
                            }}
                            onLocalSignIn={() => {
                                setSigningIn(true);
                                localFileSystemAPI.signInToFileAPI();
                            }}
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
