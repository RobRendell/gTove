import {FunctionComponent, useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import DriveFolderComponent from './driveFolderComponent';
import googleAPI from '../util/storage/providers/google/googleAPI';
import {discardStoreAction, getLoggedInUserFromStore} from '../redux/mainReducer';
import VirtualGamingTabletop from '../presentation/virtualGamingTabletop';
import {setLoggedInUserAction} from '../redux/loggedInUserReducer';
import offlineAPI from '../util/storage/providers/offline/offlineAPI';
import OfflineFolderComponent from './offlineFolderComponent';
import PromiseModalDialog, {PromiseModalDialogType} from './promiseModalDialog';
import PromiseModalContextBridge from '../context/promiseModalContextBridge';
import {setTabletopIdAction} from '../redux/locationReducer';
import GoogleSignInButton from '../presentation/googleSignInButton';
import InputButton from '../presentation/inputButton';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {appVersion} from '../util/appVersion';
import ErrorBoundaryContainer from '../presentation/errorBoundaryComponent';
import Spinner from '../presentation/spinner';

const AuthenticatedContainer: FunctionComponent = () => {
    const loggedInUser = useSelector(getLoggedInUserFromStore);
    const [initialised, setInitialised] = useState(false);
    const [driveLoadError, setDriveLoadError] = useState(false);
    const [offline, setOffline] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const promiseModal = useRef<PromiseModalDialogType | undefined>();
    const setPromiseModal = useCallback((modal) => {promiseModal.current = modal}, []);
    const dispatch = useDispatch();
    const signInHandler = useCallback(async (signedIn: boolean) => {
        setInitialised(true);
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
                setDriveLoadError(true);
            });
        } catch (e) {
            console.error(e);
            setDriveLoadError(true);
        }
        return () => {
            dispatch(setTabletopIdAction());
        };
    }, [signInHandler, dispatch]);
    return (
        <div className='fullHeight'>
            <PromiseModalContextBridge value={promiseModal.current}>
                {
                    loggedInUser ? (
                        offline ? (
                            <OfflineFolderComponent>
                                <ErrorBoundaryContainer>
                                    <VirtualGamingTabletop/>
                                </ErrorBoundaryContainer>
                            </OfflineFolderComponent>
                        ) : (
                            <DriveFolderComponent>
                                <ErrorBoundaryContainer>
                                    <VirtualGamingTabletop/>
                                </ErrorBoundaryContainer>
                            </DriveFolderComponent>
                        )
                    ) : (
                        <div className='normalMargin'>
                            <h1>gTove - a virtual gaming tabletop</h1>
                            <p>Current version: {appVersion.numCommits}</p>
                            {
                                process.env.REACT_APP_FIREBASE_EMULATOR !== 'true' ? null : (
                                    <p><b>Using Firebase emulator!</b></p>
                                )
                            }
                            <p>This project is a lightweight web application to simulate a virtual tabletop.  Multiple
                                maps and standee-style miniatures can be placed on the tabletop, and everyone connected
                                to the same tabletop can see them and move the miniatures around.  Google Drive is used
                                to store shared resources such as the images for miniatures and maps, and data for
                                scenarios.</p>
                            <p>More information (including a roadmap of planned features) here:&nbsp;
                                <a target='_blank' rel='noopener noreferrer' href='https://github.com/RobRendell/gtove'>
                                    https://github.com/RobRendell/gtove
                                </a></p>
                            {
                                driveLoadError ? (
                                    <p>An error occurred trying to connect to Google Drive.</p>
                                ) : (
                                    <div>
                                        <p>The app needs permission to create files in your Google Drive, and to
                                            read and modify the files it creates.</p>
                                        {
                                            !signingIn ? (
                                                <GoogleSignInButton disabled={!initialised} onClick={() => {
                                                    setOffline(false);
                                                    setSigningIn(true);
                                                    googleAPI.signInToFileAPI()
                                                }}/>
                                            ) : (
                                                <Spinner size={32} />
                                            )
                                        }
                                    </div>
                                )
                            }
                            <p>You can {driveLoadError ? 'still' : 'alternatively'} connect in "offline mode",
                                which doesn't require access to your Google Drive.  Offline mode stores everything in
                                memory, multiple devices can't view the same tabletop, and any work you do is lost when
                                the browser tab closes or you sign out.  It is thus mainly useful only for demoing the
                                app.</p>
                            <InputButton type='button' onChange={async () => {
                                setOffline(true);
                                dispatch(setCreateInitialStructureAction(true));
                                offlineAPI.initialiseFileAPI(signInHandler, () => {});
                                const user = await offlineAPI.getLoggedInUserInfo();
                                dispatch(setLoggedInUserAction(user))
                            }}>
                                Work Offline
                            </InputButton>
                        </div>
                    )
                }
            </PromiseModalContextBridge>
            <PromiseModalDialog setPromiseComponent={setPromiseModal}/>
        </div>
    );
};

export default AuthenticatedContainer;