import React, {Component} from 'react';
import classNames from 'classnames';
import {connect} from 'react-redux';
import {v4} from 'uuid';
import {throttle} from 'lodash';
import {toast, ToastContainer} from 'react-toastify';
import * as PropTypes from 'prop-types';

import MapViewComponent from './MapViewComponent';
import BrowseFilesComponent from '../container/BrowseFilesComponent';
import * as constants from '../util/constants';
import MapEditor from './MapEditor';
import MiniEditor from './MiniEditor';
import RenameFileEditor from './RenameFileEditor';
import settableScenarioReducer, {
    addMapAction, addMiniAction, getScenarioFromStore, removeMapAction, removeMiniAction,
    setScenarioAction, updateMapFogOfWarAction, updateMapGMOnlyAction, updateMiniGMOnlyAction
} from '../redux/scenarioReducer';
import {getTabletopIdFromStore, setTabletopIdAction} from '../redux/locationReducer';
import {addFilesAction, getAllFilesFromStore} from '../redux/fileIndexReducer';
import {getMissingScenarioDriveMetadata, jsonToScenario, scenarioToJson} from '../util/scenarioUtils';
import {getLoggedInUserFromStore} from '../redux/loggedInUserReducer';
import {getConnectedUsersFromStore} from '../redux/connectedUserReducer';

import './VirtualGamingTabletop.css';

class VirtualGamingTabletop extends Component {

    static GAMING_TABLETOP = 0;
    static MAP_SCREEN = 1;
    static MINIS_SCREEN = 2;
    static TABLETOP_SCREEN = 3;

    static contextTypes = {
        fileAPI: PropTypes.object
    };

    static stateButtons = [
        {label: 'Tabletops', state: VirtualGamingTabletop.TABLETOP_SCREEN},
        {label: 'Maps', state: VirtualGamingTabletop.MAP_SCREEN},
        {label: 'Minis', state: VirtualGamingTabletop.MINIS_SCREEN}
        // Scenarios
        // Templates
    ];

    constructor(props) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.saveScenarioToDrive = throttle(this.saveScenarioToDrive.bind(this), 5000);
        this.state = {
            panelOpen: false,
            avatarsOpen: false,
            currentPage: props.tabletopId ? VirtualGamingTabletop.GAMING_TABLETOP : VirtualGamingTabletop.TABLETOP_SCREEN,
            gmConnected: this.isGMConnected(props),
            fogOfWarMode: false
        };
        this.emptyScenario = settableScenarioReducer(undefined, {type: '@@init'});
    }

    isGMConnected(props) {
        // If I own the scenario, then the GM is connected.  Otherwise, check connectedUsers.
        return !props.scenario || !props.scenario.gm ||
            (props.loggedInUser && props.loggedInUser.emailAddress === props.scenario.gm) ||
            Object.keys(props.connectedUsers).reduce((result, peerId) => (
                result || props.connectedUsers[peerId].emailAddress === props.scenario.gm
            ), false);
    }

    loadTabletopFromDrive(metadataId) {
        this.props.dispatch(setScenarioAction(this.emptyScenario));
        return Promise.resolve()
            .then(() => {
                if (metadataId) {
                    console.log('attempting to load tabletop from id', metadataId);
                    return this.context.fileAPI.getJsonFileContents({id: metadataId})
                        .then((scenarioJson) => {
                            const publicMetadata = this.props.files.driveMetadata[metadataId];
                            if (publicMetadata) {
                                return this.context.fileAPI.getJsonFileContents({id: publicMetadata.appProperties.gmFile})
                                    .then((privateScenarioJson) => {
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
                return getMissingScenarioDriveMetadata(this.context.fileAPI, this.props.files.driveMetadata, scenarioJson)
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

    saveScenarioToDrive(metadataId, scenarioState) {
        // Only save if the metadataId is for a file we own
        if (this.props.loggedInUser && scenarioState.gm && metadataId && this.props.files.driveMetadata[metadataId]) {
            const [privateScenario, publicScenario] = scenarioToJson(scenarioState);
            return this.context.fileAPI.saveJsonToFile({id: this.props.files.driveMetadata[metadataId].appProperties.gmFile}, privateScenario)
                .then(() => (this.context.fileAPI.saveJsonToFile({id: metadataId}, publicScenario)))
                .catch((err) => {
                    if (this.props.loggedInUser) {
                        throw err;
                    }
                    // Else we've logged out in the mean time, so we expect the upload to fail.
                });
        }
    }

    componentWillReceiveProps(props) {
        if (!props.tabletopId) {
            this.setState({currentPage: VirtualGamingTabletop.TABLETOP_SCREEN});
        } else if (props.tabletopId !== this.props.tabletopId) {
            return this.loadTabletopFromDrive(props.tabletopId);
        }
        if (props.scenario !== this.props.scenario) {
            this.saveScenarioToDrive(props.tabletopId, props.scenario);
        }
        this.setState({gmConnected: this.isGMConnected(props)}, () => {
            if (this.state.gmConnected) {
                if (this.state.toastId) {
                    toast.dismiss(this.state.toastId);
                    this.setState({toastId: null});
                }
            } else if (!this.state.toastId || !toast.isActive(this.state.toastId)) {
                this.setState({
                    toastId: toast('View-only mode - no GM is connected.', {
                        position: toast.POSITION.BOTTOM_CENTER,
                        autoClose: false
                    })
                });
            }
        });
    }

    onBack() {
        this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
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

    renderMenu() {
        return (
            <div className={classNames('controlPanel', {
                open: this.state.panelOpen
            })}>
                <div className='material-icons' onClick={() => {
                    this.setState({panelOpen: false});
                }}>menu</div>
                <button onClick={() => {
                    this.props.dispatch(setScenarioAction(this.emptyScenario));
                }}>Clear Tabletop</button>
                <button onClick={() => {
                    this.setState({fogOfWarMode: !this.state.fogOfWarMode, panelOpen: false});
                }}>Fog of War Mode</button>
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

    renderAvatar(user) {
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
                    {this.renderAvatar(this.props.loggedInUser)}
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
        const userIsGM = (this.props.loggedInUser.emailAddress === this.props.scenario.gm);
        return (
            <div className='controlFrame'>
                {this.renderMenuButton()}
                {this.renderMenu()}
                {this.renderAvatars()}
                <div className='mainArea'>
                    <MapViewComponent
                        readOnly={!this.state.gmConnected}
                        transparentFog={userIsGM}
                        fogOfWarMode={this.state.fogOfWarMode}
                        selectMapOptions={[
                            {
                                label: 'Reveal',
                                title: 'Reveal this map to players',
                                onClick: (mapId) => {this.props.dispatch(updateMapGMOnlyAction(mapId, false))},
                                show: (mapId) => (userIsGM && this.props.scenario.maps[mapId].gmOnly)
                            },
                            {
                                label: 'Hide',
                                title: 'Hide this map from players',
                                onClick: (mapId) => {this.props.dispatch(updateMapGMOnlyAction(mapId, true))},
                                show: (mapId) => (userIsGM && !this.props.scenario.maps[mapId].gmOnly)
                            },
                            {
                                label: 'Remove',
                                title: 'Remove this map from the tabletop',
                                onClick: (mapId) => {this.props.dispatch(removeMapAction(mapId))},
                                show: () => (userIsGM)
                            },
                            {
                                label: 'Reposition',
                                title: 'Pan, zoom (elevate) and rotate this map on the tabletop.',
                                onClick: (mapId, point) => ({selected: {mapId, point}, menuSelected: null}),
                                show: () => (userIsGM)
                            }
                        ]}
                        selectMiniOptions={[
                            {
                                label: 'Reveal',
                                title: 'Reveal this mini to players',
                                onClick: (miniId) => {this.props.dispatch(updateMiniGMOnlyAction(miniId, false))},
                                show: (miniId) => (userIsGM && this.props.scenario.minis[miniId].gmOnly)
                            },
                            {
                                label: 'Hide',
                                title: 'Hide this mini from players',
                                onClick: (miniId) => {this.props.dispatch(updateMiniGMOnlyAction(miniId, true))},
                                show: (miniId) => (userIsGM && !this.props.scenario.minis[miniId].gmOnly)
                            },
                            {
                                label: 'Remove',
                                title: 'Remove this mini from the tabletop',
                                onClick: (miniId) => {this.props.dispatch(removeMiniAction(miniId))},
                                show: (miniId) => (userIsGM)
                            },
                            {
                                label: 'Scale',
                                title: 'Adjust this mini\'s scale',
                                onClick: (miniId, point) => ({selected: {miniId: miniId, point, scale: true}, menuSelected: null}),
                                show: (miniId) => (userIsGM)
                            }
                        ]}
                        fogOfWarOptions={[
                            {
                                label: 'Cover All',
                                title: 'Cover all maps with Fog of War.',
                                onClick: () => {
                                    Object.keys(this.props.scenario.maps).forEach((mapId) => {
                                        this.props.dispatch(updateMapFogOfWarAction(mapId, []));
                                    });
                                    return {menuSelected: null};
                                },
                                show: (miniId) => (userIsGM)
                            },
                            {
                                label: 'Uncover All',
                                title: 'Remove Fog of War from all maps.',
                                onClick: () => {
                                    Object.keys(this.props.scenario.maps).forEach((mapId) => {
                                        this.props.dispatch(updateMapFogOfWarAction(mapId, null));
                                    });
                                    return {menuSelected: null};
                                },
                                show: (miniId) => (userIsGM)
                            },
                            {
                                label: 'Finish',
                                title: 'Exit Fog of War Mode',
                                onClick: () => {
                                    this.setState({fogOfWarMode: false});
                                    return {menuSelected: null, fogOfWarRect: null};
                                },
                                show: (miniId) => (userIsGM)
                            }
                        ]}
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
                onPickFile={(metadata) => {
                    if (metadata.appProperties) {
                        const name = metadata.name.replace(/(\.[a-zA-Z]*)?$/, '');
                        this.props.dispatch(addMapAction(v4(), {metadata, name, gmOnly: false}));
                        this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
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
                onPickFile={(miniMetadata) => {
                    if (miniMetadata.appProperties) {
                        const name = miniMetadata.name.replace(/(\.[a-zA-Z]*)?$/, '');
                        this.props.dispatch(addMiniAction(v4(), miniMetadata, name));
                        this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
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
                onBack={this.props.tabletopId ? this.onBack : null}
                onNewFile={(parents) => {
                    // Create both the private file in the GM Data folder, and the new shared tabletop file
                    const myEmptyScenario = {
                        ...this.emptyScenario,
                        gm: this.props.loggedInUser.emailAddress
                    };
                    const name = 'New Tabletop';
                    return this.context.fileAPI.saveJsonToFile({name, parents: [this.props.files.roots[constants.FOLDER_GM_DATA]]}, myEmptyScenario)
                        .then((privateMetadata) => (
                            this.context.fileAPI.saveJsonToFile({name, parents, appProperties: {gmFile: privateMetadata.id}}, myEmptyScenario)
                        ))
                        .then((publicMetadata) => {
                            return this.context.fileAPI.makeFileReadableToAll(publicMetadata)
                                .then(() => (publicMetadata));
                        });
                }}
                onPickFile={(tabletopMetadata) => {
                    if (!this.props.tabletopId) {
                        this.props.dispatch(setTabletopIdAction(tabletopMetadata.id));
                    } else if (this.props.tabletopId !== tabletopMetadata.id) {
                        // pop out a new window/tab with the new tabletop
                        window.open('/' + tabletopMetadata.id, '_blank').focus();
                    }
                    this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
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
            case VirtualGamingTabletop.GAMING_TABLETOP:
                return this.renderControlPanelAndMap();
            case VirtualGamingTabletop.MAP_SCREEN:
                return this.renderMapScreen();
            case VirtualGamingTabletop.MINIS_SCREEN:
                return this.renderMinisScreen();
            case VirtualGamingTabletop.TABLETOP_SCREEN:
                return this.renderTabletopsScreen();
            default:
                return null;
        }
    }
}

function mapStoreToProps(store) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store),
        scenario: getScenarioFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store),
        connectedUsers: getConnectedUsersFromStore(store)
    }
}

export default connect(mapStoreToProps)(VirtualGamingTabletop);