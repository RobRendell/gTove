import './storageOptionsPanel.scss';

import {FunctionComponent} from 'react';

import {appVersion} from '../util/appVersion';
import GoogleSignInButton from './googleSignInButton';
import InputButton from './inputButton';
import Spinner from './spinner';

export type ApiStorageState = 'uninitialised' | 'initialised' | 'signingIn' | 'error';

interface StorageOptionsPanelProps {
    googleAPIState: ApiStorageState;
    onGoogleSignIn: () => void;
    localAPIState: ApiStorageState;
    onLocalSignIn: () => void;
    onOfflineSignIn: () => void;
}

/**
 * Panel that displays storage options for the user to choose from.
 */
const StorageOptionsPanel: FunctionComponent<StorageOptionsPanelProps> = ({
    googleAPIState,
    onGoogleSignIn,
    localAPIState,
    onLocalSignIn,
    onOfflineSignIn
}) => {
    return (
        <div className='normalMargin storageOptionsPanel'>
            <h1>gTove - a virtual gaming tabletop</h1>
            <p>Current version: {appVersion.numCommits}</p>
            <p>
                This project is a lightweight web application to simulate a virtual tabletop.  Multiple maps and
                standee-style miniatures can be placed on the tabletop, and everyone connected to the same tabletop can
                see them and move the miniatures around.
            </p>
            <p>More information (including a roadmap of planned features) here:&nbsp;
                <a target='_blank' rel='noopener noreferrer' href='https://github.com/RobRendell/gtove'>
                    https://github.com/RobRendell/gtove
                </a></p>
            
            <h2>Choose how to store your data</h2>

            <div className='storageOption local'>
                <h3>💾 Local Filesystem</h3>
                <p>
                    Store your maps, miniatures, and scenarios on this device. Does not currently support sharing
                    tabletops with other users/devices.
                </p>
                {
                    localAPIState === 'error' ? (
                        <p className='browserNote'>
                            Note: Local storage is not available in your browser. Use a Chromium-based browser such as
                            Chrome or Edge to use local file storage.
                        </p>
                    ) : localAPIState === 'signingIn' ? (
                        <Spinner size={32}/>
                    ) : (
                        <InputButton type='button' disabled={localAPIState !== 'initialised'} onChange={onLocalSignIn}>
                            Use local filesystem
                        </InputButton>
                    )
                }
            </div>
            
            <div className='storageOption'>
                <h3>☁️ Google Drive</h3>
                {
                    import.meta.env.VITE_FIREBASE_EMULATOR !== 'true' ? null : (
                        <p><b>Using Firebase emulator!</b></p>
                    )
                }
                <p>
                    Store your maps, miniatures and scenarios in your Google Drive. Requires a Google account,
                    and granting gTove permission to access your Drive.
                </p>
                {
                    googleAPIState === 'error' ? (
                        <p>An error occurred trying to connect to Google Drive.</p>
                    ) : googleAPIState === 'signingIn' ? (
                        <Spinner size={32}/>
                    ) : (
                        <>
                            <GoogleSignInButton disabled={googleAPIState === 'uninitialised'} onClick={onGoogleSignIn}/>
                        </>
                    )
                }
            </div>
            
            <div className='storageOption offline'>
                <h3>🔌 Offline Mode (for demos)</h3>
                <p>
                    Stores everything in memory. Other devices can't view the same tabletop, and any work you do is lost
                    when the browser tab closes or you sign out. It is thus mainly useful for demoing the app.
                </p>
                <InputButton type='button' onChange={onOfflineSignIn}>
                    Try Offline Demo
                </InputButton>
            </div>
            
        </div>
    );
};

export default StorageOptionsPanel;
