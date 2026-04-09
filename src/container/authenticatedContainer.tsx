import {FunctionComponent, useCallback, useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';

import CameraParametersProvider from '../context/cameraParametersProvider';
import PromiseModalProvider from '../context/promiseModalProvider';
import ToastProvider from '../context/toastProvider';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {setTabletopIdAction} from '../redux/locationReducer';
import {setLoggedInUserAction} from '../redux/loggedInUserReducer';
import {discardStoreAction} from '../redux/mainReducer';
import googleAPI from '../util/storage/providers/google/googleAPI';
import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import StorageOptionsPanel from '../presentation/storageOptionsPanel';
import localFileSystemAPI from '../util/storage/providers/local/localFileSystemAPI';

const localStorageSupported = 'showDirectoryPicker' in window;

const AuthenticatedContainer: FunctionComponent = () => {
    const [storageLoadingError, setStorageLoadingError] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const dispatch = useDispatch();
    const signInHandler = useCallback(async (signedIn: boolean) => {
        if (signedIn) {
            setSigningIn(true);
            const user = await googleAPI.getLoggedInUserInfo();
            dispatch(setLoggedInUserAction(user));
        } else {
            dispatch(discardStoreAction());
            setSigningIn(false);
        }
    }, [dispatch]);
    useEffect(() => {
        try {
            googleAPI.initialiseFileAPI(signInHandler, (e) => {
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
    }, [signInHandler, dispatch]);

    const handleGoogleSignIn = useCallback(() => {
        setSigningIn(true);
        googleAPI.signInToFileAPI();
    }, []);

    const handleLocalSignIn = useCallback(async () => {
        setSigningIn(true);
        localFileSystemAPI.initialiseFileAPI(
            async (signedIn) => {
                if (signedIn) {
                    const user = await localFileSystemAPI.getLoggedInUserInfo();
                    dispatch(setLoggedInUserAction(user));
                } else {
                    // User needs to give a folder
                    localFileSystemAPI.signInToFileAPI();
                }
            },
            (error) => {
                setSigningIn(false);
                setStorageLoadingError(true);
                console.error( 'Local storage error:', error);
            }
        );
    }, [dispatch]);
    

    const handleOfflineSignIn = async () =>{
        dispatch(setCreateInitialStructureAction(true));
        offlineAPI.initialiseFileAPI(signInHandler, () => {});
        const user = await offlineAPI.getLoggedInUserInfo();
        dispatch(setLoggedInUserAction(user));
    }
    
    return (
        <div className='fullHeight'>
            <PromiseModalProvider>
                <ToastProvider>
                    <CameraParametersProvider>
                    <StorageOptionsPanel
                            initialised={true}
                            signingIn={signingIn}
                            driveLoadError={storageLoadingError}
                            localStorageSupported={localStorageSupported}
                            onGoogleSignIn={handleGoogleSignIn}
                            onLocalSignIn={handleLocalSignIn}
                            onOfflineSignIn={handleOfflineSignIn}/> 
                    </CameraParametersProvider>
                </ToastProvider>
            </PromiseModalProvider>
        </div>
    );
};

export default AuthenticatedContainer;