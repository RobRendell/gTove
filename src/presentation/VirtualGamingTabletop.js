import React, {Component} from 'react';
import classNames from 'classnames';
import {connect} from 'react-redux';
import {v4} from 'uuid';
import {throttle} from 'lodash';

import MapViewComponent from './MapViewComponent';
import {
    getJsonFileContents, makeDriveFileReadableToAll, signOutFromGoogleAPI, uploadJsonToDriveFile
} from '../util/googleAPIUtils';
import BrowseFilesComponent from '../container/BrowseFilesComponent';
import * as constants from '../util/constants';
import MapEditor from './MapEditor';
import {
    addMapAction, addMiniAction, getScenarioFromStore, setScenarioAction
} from '../redux/scenarioReducer';
import {getTabletopIdFromStore, setTabletopIdAction} from '../redux/locationReducer';
import RenameFileEditor from './RenameFileEditor';
import {addFilesAction, getAllFilesFromStore} from '../redux/fileIndexReducer';
import settableScenarioReducer from '../redux/scenarioReducer';
import {getMissingScenarioDriveMetadata, jsonToScenario, scenarioToJson} from '../util/scenarioUtils';
import {getLoggedInUserFromStore} from '../redux/loggedInUserReducer';

import './VirtualGamingTabletop.css';

class VirtualGamingTabletop extends Component {

    static GAMING_TABLETOP = 0;
    static MAP_SCREEN = 1;
    static MINIS_SCREEN = 2;
    static TABLETOP_SCREEN = 3;

    static buttons = [
        {label: 'Tabletops', state: VirtualGamingTabletop.TABLETOP_SCREEN, enabled: (props) => (
            props.files.roots[constants.FOLDER_TABLETOP]
        )},
        {label: 'Maps', state: VirtualGamingTabletop.MAP_SCREEN, enabled: (props) => (
            props.files.roots[constants.FOLDER_MAP]
        )},
        {label: 'Minis', state: VirtualGamingTabletop.MINIS_SCREEN, enabled: (props) => (
            props.files.roots[constants.FOLDER_MINI]
        )}
        // Scenarios
        // Templates
    ];

    constructor(props) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.saveScenarioToDrive = throttle(this.saveScenarioToDrive.bind(this), 5000);
        this.state = {
            panelOpen: false,
            currentPage: props.tabletopId ? VirtualGamingTabletop.GAMING_TABLETOP : VirtualGamingTabletop.TABLETOP_SCREEN
        };
        this.emptyScenario = settableScenarioReducer(undefined, {type: '@@init'});
    }

    loadTabletopFromDrive(metadataId) {
        this.props.dispatch(setScenarioAction(this.emptyScenario));
        return Promise.resolve()
            .then(() => {
                if (metadataId) {
                    console.log('attempting to load tabletop from id', metadataId);
                    return getJsonFileContents({id: metadataId})
                } else {
                    return this.emptyScenario;
                }
            })
            .then((scenarioJson) => {
                return getMissingScenarioDriveMetadata(this.props.files.driveMetadata, scenarioJson)
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
        if (metadataId && this.props.files.driveMetadata[metadataId]) {
            const scenario = scenarioToJson(scenarioState);
            const driveMetadata = {id: metadataId};
            return uploadJsonToDriveFile(driveMetadata, scenario);
        }
    }

    componentWillReceiveProps(props) {
        if (!props.tabletopId) {
            this.setState({currentPage: VirtualGamingTabletop.TABLETOP_SCREEN});
        } else if (props.tabletopId !== this.props.tabletopId) {
            return this.loadTabletopFromDrive(props.tabletopId);
        }
        if (props.scenario !== this.props.scenario) {
            this.saveScenarioToDrive(this.props.tabletopId, props.scenario);
        }
    }


    onBack() {
        this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
    }

    renderControlPanelAndMap() {
        return (
            <div className='controlFrame'>
                {this.state.panelOpen ? null : (
                    <div className='menuControl material-icons' onClick={() => {
                        this.setState({panelOpen: true});
                    }}>menu</div>
                )}
                <div className={classNames('controlPanel', {
                    open: this.state.panelOpen
                })}>
                    <div className='material-icons' onClick={() => {
                        this.setState({panelOpen: false});
                    }}>menu
                    </div>
                    <button onClick={() => {
                        signOutFromGoogleAPI()
                    }}>Sign Out
                    </button>
                    {
                        VirtualGamingTabletop.buttons.map((buttonData) => (
                            <button
                                key={buttonData.label}
                                onClick={() => {
                                    this.setState({currentPage: buttonData.state, panelOpen: false});
                                }}
                                disabled={!buttonData.enabled(this.props)}
                            >{buttonData.label}</button>
                        ))
                    }
                </div>
                <div className='mainArea'>
                    <MapViewComponent/>
                </div>
            </div>
        );
    }

    render() {
        switch (this.state.currentPage) {
            case VirtualGamingTabletop.GAMING_TABLETOP:
                return this.renderControlPanelAndMap();
            case VirtualGamingTabletop.MAP_SCREEN:
                return <BrowseFilesComponent
                    topDirectory={constants.FOLDER_MAP}
                    onBack={this.onBack}
                    onPickFile={(mapMetadata) => {
                        if (mapMetadata.appProperties) {
                            this.props.dispatch(addMapAction(v4(), mapMetadata));
                            this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
                            return true;
                        } else {
                            return false;
                        }
                    }}
                    editorComponent={MapEditor}
                />;
            case VirtualGamingTabletop.MINIS_SCREEN:
                return <BrowseFilesComponent
                    topDirectory={constants.FOLDER_MINI}
                    onBack={this.onBack}
                    onPickFile={(miniMetadata) => {
                        if (miniMetadata.appProperties) {
                            this.props.dispatch(addMiniAction(v4(), miniMetadata));
                            this.setState({currentPage: VirtualGamingTabletop.GAMING_TABLETOP});
                            return true;
                        } else {
                            return false;
                        }
                    }}
                    editorComponent={MapEditor} // For now there's no difference
                />;
            case VirtualGamingTabletop.TABLETOP_SCREEN:
                return <BrowseFilesComponent
                    topDirectory={constants.FOLDER_TABLETOP}
                    onBack={this.props.tabletopId ? this.onBack : null}
                    onNewFile={(parents) => {
                        let driveMetadata;
                        return uploadJsonToDriveFile({name: 'New Tabletop', parents}, {...this.emptyScenario, gm: this.props.loggedInUser.emailAddress})
                            .then((metadata) => {
                                driveMetadata = metadata;
                                return makeDriveFileReadableToAll(metadata);
                            })
                            .then(() => (driveMetadata));
                    }}
                    onPickFile={(tabletopMetadata) => {
                        this.props.dispatch(setTabletopIdAction(tabletopMetadata.id));
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
                />;
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
        loggedInUser: getLoggedInUserFromStore(store)
    }
}

export default connect(mapStoreToProps)(VirtualGamingTabletop);