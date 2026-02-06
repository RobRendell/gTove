import {FunctionComponent, useContext, useState} from 'react';
import classNames from 'classnames';

import './avatarsComponent.scss';

import {appVersion} from '../util/appVersion';
import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import GoogleAvatar from './googleAvatar';
import Tooltip from './tooltip';
import Spinner from './spinner';
import InputButton from './inputButton';
import {VirtualGamingTabletopMode} from './virtualGamingTabletop';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {serviceWorkerStore} from '../util/serviceWorkerStore';
import {DriveUser} from '../util/storage/providers/google/googleDriveUtils';
import {FileAPIContextObject} from '../context/fileAPIContextBridge';
import {TabletopType} from '../util/scenarioUtils';

interface AvatarsComponentProps {
    connectedUsers: ConnectedUserReducerType;
    loggedInUser: DriveUser;
    myPeerId: MyPeerIdReducerType;
    gmConnected: boolean;
    savingTabletop: number;
    hasUnsavedChanges: boolean;
    setCurrentScreen: (state: VirtualGamingTabletopMode) => void;
    updateVersionNow: () => void;
    tabletop: TabletopType;
}

const AvatarsComponent: FunctionComponent<AvatarsComponentProps> = (props) => {
    const {
        connectedUsers, loggedInUser, myPeerId, gmConnected, savingTabletop, hasUnsavedChanges,
        setCurrentScreen, updateVersionNow, tabletop
    } = props;
    const otherUsers = Object.keys(connectedUsers.users).filter((peerId) => (peerId !== myPeerId));
    const anyMismatches = otherUsers.reduce<boolean>((any, peerId) => {
        const version = connectedUsers.users[peerId].version;
        return any || (version !== undefined && version.hash !== appVersion.hash)
    }, false);
    const updatePending = !!(serviceWorkerStore.registration?.waiting);
    const [avatarsOpen, setAvatarsOpen] = useState(false);
    const annotation = updatePending ? '!' : ((avatarsOpen || otherUsers.length === 0) ? (anyMismatches ? '!' : undefined) : otherUsers.length);
    const fileAPI = useContext(FileAPIContextObject);
    return (
        <OnClickOutsideWrapper onClickOutside={() => {setAvatarsOpen(false)}}>
            <div>
                <div className='loggedInAvatar' onClick={() => {
                    setAvatarsOpen(!avatarsOpen);
                }}>
                    <GoogleAvatar user={loggedInUser}
                                  annotation={annotation}
                                  annotationClassNames={classNames({mismatch: anyMismatches || updatePending, gmConnected})}
                                  annotationTooltip={anyMismatches ? 'Different versions of gTove!' : updatePending ? 'Update pending' : undefined}
                    />
                    {
                        (savingTabletop > 0) ? (
                            <Tooltip className='saving' tooltip='Saving changes to Drive'>
                                <Spinner/>
                            </Tooltip>
                        ) : hasUnsavedChanges ? (
                            <Tooltip className='saving' tooltip='Unsaved changes'>
                                <i className='material-icons pending'>sync</i>
                            </Tooltip>
                        ) : null
                    }
                </div>
                {
                    !avatarsOpen ? null : (
                        <div className='avatarPanel small'>
                            {
                                !updatePending ? null : (
                                    <>
                                        <span>
                                            <span className='annotation mismatch icon'>!</span>
                                            A newer version of gTove is available!
                                        </span>
                                        <InputButton type='button' onChange={updateVersionNow}>
                                            Update gTove now
                                        </InputButton>
                                        <hr/>
                                    </>
                                )
                            }
                            <InputButton type='button' onChange={() => {
                                setCurrentScreen(VirtualGamingTabletopMode.USER_PREFERENCES_SCREEN);
                                setAvatarsOpen(false);
                            }}>
                                Preferences
                            </InputButton>
                            <InputButton type='button' onChange={fileAPI.signOutFromFileAPI}>
                                Sign Out
                            </InputButton>
                            {
                                gmConnected ? null : (
                                    <p>The GM is not connected to this tabletop.  You can view the map and move the
                                        camera around, but cannot make changes.</p>
                                )
                            }
                            {
                                otherUsers.length === 0 ? null : (
                                    <p>Other users connected to this tabletop:</p>
                                )
                            }
                            {
                                otherUsers.length === 0 ? null : (
                                    otherUsers.sort().map((peerId) => {
                                        const connectedUser = connectedUsers.users[peerId];
                                        const user = connectedUser.user;
                                        const userIsGM = (user.emailAddress === tabletop.gm);
                                        const mismatch = connectedUser.version === undefined || connectedUser.version.hash !== appVersion.hash;
                                        return (
                                            <div key={peerId} className={classNames({userIsGM})}>
                                                <GoogleAvatar user={user}
                                                              annotation={mismatch ? '!' : undefined}
                                                              annotationClassNames={classNames({mismatch})}
                                                              annotationTooltip={mismatch ? 'Different version of gTove!' : undefined}
                                                />
                                                <Tooltip tooltip={user.displayName}>{user.displayName}</Tooltip>
                                            </div>
                                        )
                                    })
                                )
                            }
                            {
                                otherUsers.length === 0 ? null : (
                                    <div>
                                        <hr/>
                                        <InputButton type='button' onChange={() => {
                                            setCurrentScreen(VirtualGamingTabletopMode.DEVICE_LAYOUT_SCREEN);
                                            setAvatarsOpen(false);
                                        }}>
                                            Combine devices
                                        </InputButton>
                                    </div>
                                )
                            }
                            <div className='minor'>gTove version: {appVersion.numCommits}</div>
                        </div>
                    )
                }
            </div>
        </OnClickOutsideWrapper>
    );
}

export default AvatarsComponent;