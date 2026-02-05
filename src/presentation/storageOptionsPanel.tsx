import {FunctionComponent} from 'react';

import GoogleSignInButton from './googleSignInButton';
import InputButton from './inputButton';
import Spinner from './spinner';
import {appVersion} from '../util/appVersion';

interface StorageOptionsPanelProps {
    initialised: boolean;
    signingIn: boolean;
    driveLoadError: boolean;
    localStorageSupported: boolean;
    onGoogleSignIn: () => void;
    onLocalSignIn: () => void;
    onOfflineSignIn: () => void;
}

/**
 * Panel that displays storage options for the user to choose from.
 */
const StorageOptionsPanel: FunctionComponent<StorageOptionsPanelProps> = ({
    initialised,
    signingIn,
    driveLoadError,
    localStorageSupported,
    onGoogleSignIn,
    onLocalSignIn,
    onOfflineSignIn
}) => {
    return (
        <div className='normalMargin'>
            <h1>gTove - a virtual gaming tabletop</h1>
            <p>Current version: {appVersion.numCommits}</p>
            {
                process.env.REACT_APP_FIREBASE_EMULATOR !== 'true' ? null : (
                    <p><b>Using Firebase emulator!</b></p>
                )
            }
            <p>This project is a lightweight web application to simulate a virtual tabletop. Multiple
                maps and standee-style miniatures can be placed on the tabletop, and everyone connected
                to the same tabletop can see them and move the miniatures around.</p>
            <p>More information (including a roadmap of planned features) here:&nbsp;
                <a target='_blank' rel='noopener noreferrer' href='https://github.com/RobRendell/gtove'>
                    https://github.com/RobRendell/gtove
                </a></p>
            
            <h2>Choose how to store your data</h2>
            
            {/* Local Storage Option - Primary recommendation */}
            {localStorageSupported && (
                <div style={{marginBottom: '1.5em', padding: '1em', border: '1px solid #4a4', borderRadius: '8px', backgroundColor: '#f0fff0'}}>
                    <h3 style={{marginTop: 0, color: '#2a2'}}>💾 Local Storage (Recommended)</h3>
                    <p>Store your maps, miniatures, and scenarios on your computer. Your data stays on your
                        device and persists between sessions. You have full ownership and can back up your
                        files anytime.</p>
                    {!signingIn ? (
                        <InputButton type='button' onChange={onLocalSignIn}>
                            Choose Local Folder
                        </InputButton>
                    ) : (
                        <Spinner size={32} />
                    )}
                </div>
            )}
            
            {/* Google Drive Option */}
            <div style={{marginBottom: '1.5em', padding: '1em', border: '1px solid #aaa', borderRadius: '8px'}}>
                <h3 style={{marginTop: 0}}>☁️ Google Drive</h3>
                {driveLoadError ? (
                    <p>An error occurred trying to connect to Google Drive.</p>
                ) : (
                    <>
                        <p>Store your data in Google Drive. Good for syncing across devices, but requires
                            a Google account and granting gTove permission to access your Drive.</p>
                        {!signingIn ? (
                            <GoogleSignInButton disabled={!initialised} onClick={onGoogleSignIn}/>
                        ) : (
                            <Spinner size={32} />
                        )}
                    </>
                )}
            </div>
            
            {/* Offline/Demo Mode */}
            <div style={{marginBottom: '1.5em', padding: '1em', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9'}}>
                <h3 style={{marginTop: 0, color: '#666'}}>🔌 Offline Mode (Demo Only)</h3>
                <p>Try gTove without any storage. Everything is kept in memory and <strong>lost when you
                    close the tab</strong>. Useful only for quickly testing the app.</p>
                <InputButton type='button' onChange={onOfflineSignIn}>
                    Try Offline Demo
                </InputButton>
            </div>
            
            {!localStorageSupported && (
                <p style={{color: '#888', fontSize: '0.9em'}}>
                    <em>Note: Local storage is not available in your browser. Use Chrome or Edge for
                        the best experience with local file storage.</em>
                </p>
            )}
        </div>
    );
};

export default StorageOptionsPanel;
