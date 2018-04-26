import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as classNames from 'classnames';
import {connect} from 'react-redux';
import {Dispatch} from 'redux';
import {v4} from 'uuid';
import {throttle} from 'lodash';
import {toast, ToastContainer} from 'react-toastify';

import TabletopViewComponent from './tabletopViewComponent';
import BrowseFilesComponent from '../container/browseFilesComponent';
import * as constants from '../util/constants';
import MapEditor from './mapEditor';
import MiniEditor from './miniEditor';
import RenameFileEditor from './renameFileEditor';
import settableScenarioReducer, {
    addMapAction,
    addMiniAction,
    setScenarioAction,
    updateSnapToGridAction
} from '../redux/scenarioReducer';
import {setTabletopIdAction} from '../redux/locationReducer';
import {addFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {
    getAllFilesFromStore,
    getConnectedUsersFromStore,
    getLoggedInUserFromStore,
    getScenarioFromStore,
    getTabletopIdFromStore, ReduxStoreType
} from '../redux/mainReducer';
import {getMissingScenarioDriveMetadata, jsonToScenario, scenarioToJson} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {ScenarioType} from '../@types/scenario';
import {
    DriveMetadata,
    DriveUser,
    MapAppProperties,
    MiniAppProperties,
    TabletopFileAppProperties
} from '../@types/googleDrive';
import {LoggedInUserReducerType} from '../redux/loggedInUserReducer';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {FileAPI} from '../util/fileUtils';

import './virtualGamingTabletop.css';

interface VirtualGamingTabletopProps {
    files: FileIndexReducerType;
    tabletopId: string;
    scenario: ScenarioType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    dispatch: Dispatch<ReduxStoreType>;
}

interface VirtualGamingTabletopState {
    panelOpen: boolean;
    avatarsOpen: boolean;
    currentPage: VirtualGamingTabletopMode;
    gmConnected: boolean;
    fogOfWarMode: boolean;
    playerView: boolean;
    noGMToastId?: number;
}

enum VirtualGamingTabletopMode {
    GAMING_TABLETOP,
    MAP_SCREEN,
    MINIS_SCREEN,
    TABLETOP_SCREEN
}

class VirtualGamingTabletop extends React.Component<VirtualGamingTabletopProps, VirtualGamingTabletopState> {

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    static stateButtons = [
        {label: 'Tabletops', state: VirtualGamingTabletopMode.TABLETOP_SCREEN},
        {label: 'Maps', state: VirtualGamingTabletopMode.MAP_SCREEN},
        {label: 'Minis', state: VirtualGamingTabletopMode.MINIS_SCREEN}
        // Scenarios
        // Templates
    ];

    private emptyScenario: ScenarioType;

    constructor(props: VirtualGamingTabletopProps) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.saveScenarioToDrive = throttle(this.saveScenarioToDrive.bind(this), 5000);
        this.state = {
            panelOpen: false,
            avatarsOpen: false,
            currentPage: props.tabletopId ? VirtualGamingTabletopMode.GAMING_TABLETOP : VirtualGamingTabletopMode.TABLETOP_SCREEN,
            gmConnected: this.isGMConnected(props),
            fogOfWarMode: false,
            playerView: false
        };
        this.emptyScenario = settableScenarioReducer(undefined as any, {type: '@@init'});
    }

    isGMConnected(props: VirtualGamingTabletopProps) {
        // If I own the scenario, then the GM is connected.  Otherwise, check connectedUsers.
        return !props.scenario || !props.scenario.gm ||
            (props.loggedInUser && props.loggedInUser.emailAddress === props.scenario.gm) ||
            Object.keys(props.connectedUsers).reduce((result, peerId) => (
                result || props.connectedUsers[peerId].emailAddress === props.scenario.gm
            ), false);
    }

    loadTabletopFromDrive(metadataId: string) {
        const fileAPI: FileAPI = this.context.fileAPI;
        return Promise.resolve()
            .then(() => {
                if (metadataId) {
                    console.log('attempting to load tabletop from id', metadataId);
                    return fileAPI.getJsonFileContents({id: metadataId})
                        .then((scenarioJson: any) => {
                            if (scenarioJson.gm === this.props.loggedInUser!.emailAddress) {
                                const publicMetadata = this.props.files.driveMetadata[metadataId];
                                return (publicMetadata ? Promise.resolve(publicMetadata) : fileAPI.getFullMetadata(metadataId).then((publicMetadata) => {
                                    this.props.dispatch(addFilesAction([publicMetadata]));
                                    return publicMetadata
                                }))
                                    .then((publicMetadata: DriveMetadata<TabletopFileAppProperties>) => (fileAPI.getJsonFileContents({id: publicMetadata.appProperties.gmFile})))
                                    .then((privateScenarioJson: any) => {
                                        return {...scenarioJson, ...privateScenarioJson};
                                    })
                            } else {
                                return scenarioJson;
                            }
                        });
                } else {
                    return this.emptyScenario;
                }
            })
            .then((scenarioJson) => {
                return getMissingScenarioDriveMetadata(fileAPI, this.props.files.driveMetadata, scenarioJson)
                    .then((missingMetadata) => {
                        this.props.dispatch(addFilesAction(missingMetadata));
                        const scenario = jsonToScenario(this.props.files.driveMetadata, scenarioJson);
                        this.props.dispatch(setScenarioAction(scenario));
                    });
            })
            .catch((err) => {
                // If the scenario file doesn't exist, drop off that tabletop
                console.error(err);
                alert('The link you used is no longer valid.  Switching to GM mode.');
                this.props.dispatch(setTabletopIdAction())
            });
    }

    componentDidMount() {
        return this.loadTabletopFromDrive(this.props.tabletopId);
    }

    saveScenarioToDrive(metadataId: string, scenarioState: ScenarioType) {
        // Only save if the metadataId is for a file we own
        const driveMetadata = metadataId && this.props.files.driveMetadata[metadataId] as DriveMetadata<TabletopFileAppProperties>;
        if (this.props.loggedInUser && scenarioState.gm === this.props.loggedInUser.emailAddress && metadataId && driveMetadata && driveMetadata.appProperties) {
            const [privateScenario, publicScenario] = scenarioToJson(scenarioState);
            return this.context.fileAPI.saveJsonToFile({id: driveMetadata.appProperties.gmFile}, privateScenario)
                .then(() => (this.context.fileAPI.saveJsonToFile({id: metadataId}, publicScenario)))
                .catch((err: Error) => {
                    if (this.props.loggedInUser) {
                        throw err;
                    }
                    // Else we've logged out in the mean time, so we expect the upload to fail.
                });
        }
    }

    componentWillReceiveProps(props: VirtualGamingTabletopProps) {
        if (!props.tabletopId) {
            this.setState({currentPage: VirtualGamingTabletopMode.TABLETOP_SCREEN});
        } else if (props.tabletopId !== this.props.tabletopId) {
            this.loadTabletopFromDrive(props.tabletopId);
        }
        if (props.scenario !== this.props.scenario) {
            this.saveScenarioToDrive(props.tabletopId, props.scenario);
        }
        this.setState({gmConnected: this.isGMConnected(props)}, () => {
            if (this.state.gmConnected) {
                if (this.state.noGMToastId) {
                    toast.dismiss(this.state.noGMToastId);
                    this.setState({noGMToastId: undefined});
                }
            } else if (!this.state.noGMToastId || !toast.isActive(this.state.noGMToastId)) {
                this.setState({
                    noGMToastId: toast('View-only mode - no GM is connected.', {
                        position: toast.POSITION.BOTTOM_CENTER,
                        autoClose: false
                    })
                });
            }
        });
    }

    onBack() {
        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
    }

    renderMenuButton() {
        return (
            this.state.panelOpen || !this.props.files.roots[constants.FOLDER_ROOT] ? null : (
                <div className='menuControl material-icons' onClick={() => {
                    this.setState({panelOpen: true});
                }}>menu</div>
            )
        );
    }

    renderGMOnlyMenu() {
        // Store in const in case it changes between now and when button onClick handler called.
        const loggedInUser = this.props.loggedInUser;
        return (!loggedInUser || loggedInUser.emailAddress !== this.props.scenario.gm) ? null : (
            <div>
                <button onClick={() => {
                    this.props.dispatch(setScenarioAction({...this.emptyScenario, gm: loggedInUser.emailAddress}, 'clear'));
                }}>Clear Tabletop</button>
                <InputButton selected={this.props.scenario.snapToGrid} onChange={() => {
                    this.props.dispatch(updateSnapToGridAction(!this.props.scenario.snapToGrid));
                }} text='Toggle Snap to Grid'/>
                <InputButton selected={this.state.fogOfWarMode} onChange={() => {
                    this.setState({fogOfWarMode: !this.state.fogOfWarMode, panelOpen: false});
                }} text='Toggle Fog of War Mode'/>
                <InputButton selected={this.state.playerView} onChange={() => {
                    this.setState({playerView: !this.state.playerView, panelOpen: false});
                }} text='Toggle Player View'/>
            </div>
        );
    }

    renderMenu() {
        return (
            <div className={classNames('controlPanel', {
                open: this.state.panelOpen
            })}>
                <div className='material-icons' onClick={() => {
                    this.setState({panelOpen: false});
                }}>menu</div>
                {this.renderGMOnlyMenu()}
                <hr/>
                {
                    VirtualGamingTabletop.stateButtons.map((buttonData) => (
                        <button
                            key={buttonData.label}
                            onClick={() => {
                                this.setState({currentPage: buttonData.state, panelOpen: false});
                            }}
                        >{buttonData.label}</button>
                    ))
                }
            </div>
        );
    }

    renderAvatar(user: DriveUser) {
        if (user.photoLink) {
            return (
                <img className='googleAvatar' src={user.photoLink} alt={user.displayName} title={user.displayName}/>);
        } else {
            const hexString = Number(user.permissionId).toString(16);
            const backgroundColor = '#' + hexString.substr(0, 6);
            const r = parseInt(hexString.substr(0, 2), 16);
            const g = parseInt(hexString.substr(2, 2), 16);
            const b = parseInt(hexString.substr(4, 2), 16);
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            const color = (yiq >= 128) ? 'black' : 'white';
            return (
                <div className='googleAvatar plain' style={{backgroundColor, color}}>
                    {user.displayName.substr(0, 1)}
                </div>
            );
        }
    }

    renderAvatars() {
        const connectedUsers = Object.keys(this.props.connectedUsers);
        return (
            <div>
                <div className='loggedInAvatar' onClick={() => {
                    this.setState({avatarsOpen: !this.state.avatarsOpen})
                }}>
                    {this.renderAvatar(this.props.loggedInUser!)}
                    {
                        this.state.avatarsOpen || connectedUsers.length === 0 ? null : (
                            <span className={classNames('connectedCount', {
                                gmConnected: this.state.gmConnected
                            })}>{connectedUsers.length}</span>
                        )
                    }
                </div>
                {
                    !this.state.avatarsOpen ? null : (
                        <div className='avatarPanel'>
                            <button onClick={() => {
                                this.context.fileAPI.signOutFromFileAPI()
                            }}>Sign Out
                            </button>
                            {
                                this.state.gmConnected ? null : (
                                    <p>The GM is not connected to this tabletop.  You can view the map and move the
                                        camera around, but cannot make changes.</p>
                                )
                            }
                            {
                                connectedUsers.length === 0 ? null : (
                                    <p>Other users connected to this tabletop:</p>
                                )
                            }
                            {
                                connectedUsers.length === 0 ? null : (
                                    connectedUsers.sort().map((peerId) => {
                                        const user = this.props.connectedUsers[peerId];
                                        const userIsGM = (user.emailAddress === this.props.scenario.gm);
                                        return (
                                            <div key={peerId} className={classNames({userIsGM})}>
                                                {this.renderAvatar(user)}
                                                <span title={user.displayName}>{user.displayName}</span>
                                            </div>
                                        )
                                    })
                                )
                            }
                        </div>
                    )
                }
            </div>
        );
    }

    renderControlPanelAndMap() {
        const userIsGM = (this.props.loggedInUser !== null && this.props.loggedInUser.emailAddress === this.props.scenario.gm);
        return (
            <div className='controlFrame'>
                {this.renderMenuButton()}
                {this.renderMenu()}
                {this.renderAvatars()}
                <div className='mainArea'>
                    <TabletopViewComponent
                        readOnly={!this.state.gmConnected}
                        transparentFog={userIsGM && !this.state.playerView}
                        fogOfWarMode={this.state.fogOfWarMode}
                        endFogOfWarMode={() => {
                            this.setState({fogOfWarMode: false});
                        }}
                        snapToGrid={this.props.scenario.snapToGrid}
                        userIsGM={userIsGM}
                        playerView={this.state.playerView}
                    />
                </div>
                <ToastContainer/>
            </div>
        );
    }

    renderMapScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_MAP}
                onBack={this.onBack}
                onPickFile={(metadata: DriveMetadata<MapAppProperties>) => {
                    if (metadata.appProperties) {
                        const name = metadata.name.replace(/(\.[a-zA-Z]*)?$/, '');
                        this.props.dispatch(addMapAction(v4(), {metadata, name, gmOnly: false}));
                        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                        return true;
                    } else {
                        return false;
                    }
                }}
                editorComponent={MapEditor}
            />
        );
    }

    renderMinisScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_MINI}
                onBack={this.onBack}
                onPickFile={(miniMetadata: DriveMetadata<MiniAppProperties>) => {
                    if (miniMetadata.appProperties) {
                        const name = miniMetadata.name.replace(/(\.[a-zA-Z]*)?$/, '');
                        this.props.dispatch(addMiniAction(v4(), miniMetadata, name));
                        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                        return true;
                    } else {
                        return false;
                    }
                }}
                editorComponent={MiniEditor}
            />
        );
    }

    renderTabletopsScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_TABLETOP}
                highlightMetadataId={this.props.tabletopId}
                onBack={this.props.tabletopId ? this.onBack : undefined}
                onNewFile={(parents) => {
                    // Create both the private file in the GM Data folder, and the new shared tabletop file
                    const myEmptyScenario = {
                        ...this.emptyScenario,
                        gm: this.props.loggedInUser!.emailAddress
                    };
                    const name = 'New Tabletop';
                    return this.context.fileAPI.saveJsonToFile({name, parents: [this.props.files.roots[constants.FOLDER_GM_DATA]]}, myEmptyScenario)
                        .then((privateMetadata: DriveMetadata) => (
                            this.context.fileAPI.saveJsonToFile({name, parents, appProperties: {gmFile: privateMetadata.id}}, myEmptyScenario)
                        ))
                        .then((publicMetadata: DriveMetadata) => {
                            return this.context.fileAPI.makeFileReadableToAll(publicMetadata)
                                .then(() => (publicMetadata));
                        });
                }}
                onPickFile={(tabletopMetadata) => {
                    if (!this.props.tabletopId) {
                        this.props.dispatch(setTabletopIdAction(tabletopMetadata.id));
                    } else if (this.props.tabletopId !== tabletopMetadata.id) {
                        // pop out a new window/tab with the new tabletop
                        const newWindow = window.open(tabletopMetadata.id, '_blank');
                        newWindow && newWindow.focus();
                    }
                    this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                    return true;
                }}
                editorComponent={RenameFileEditor}
                emptyMessage={
                    <div>
                        <p>The first thing you need to do is create one or more virtual Tabletops.</p>
                        <p>A Tabletop is a shared space that you and your players can view - everyone connected to
                            the same tabletop sees the same map and miniatures (although you as the GM may see
                            additional, hidden items).</p>
                        <p>You might want to create a Tabletop for each campaign that you GM, plus perhaps a
                            personal "working tabletop" where you can prepare scenarios out of sight of your
                            players.</p>
                    </div>
                }
            />
        );
    }

    render() {
        switch (this.state.currentPage) {
            case VirtualGamingTabletopMode.GAMING_TABLETOP:
                return this.renderControlPanelAndMap();
            case VirtualGamingTabletopMode.MAP_SCREEN:
                return this.renderMapScreen();
            case VirtualGamingTabletopMode.MINIS_SCREEN:
                return this.renderMinisScreen();
            case VirtualGamingTabletopMode.TABLETOP_SCREEN:
                return this.renderTabletopsScreen();
            default:
                return null;
        }
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store),
        scenario: getScenarioFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store),
        connectedUsers: getConnectedUsersFromStore(store)
    }
}

export default connect(mapStoreToProps)(VirtualGamingTabletop);