import * as React from 'react';
import * as PropTypes from 'prop-types';
import * as classNames from 'classnames';
import {connect} from 'react-redux';
import {Dispatch} from 'redux';
import {isObject, throttle} from 'lodash';
import {toast, ToastContainer} from 'react-toastify';
import * as THREE from 'three';

import TabletopViewComponent from './tabletopViewComponent';
import BrowseFilesComponent from '../container/browseFilesComponent';
import * as constants from '../util/constants';
import MapEditor from './mapEditor';
import MiniEditor from './miniEditor';
import RenameFileEditor from './renameFileEditor';
import ScenarioFileEditor from './scenarioFileEditor';
import settableScenarioReducer, {
    addMapAction,
    addMiniAction,
    setScenarioAction,
    updateMiniNameAction,
    updateSnapToGridAction
} from '../redux/scenarioReducer';
import {setTabletopIdAction} from '../redux/locationReducer';
import {addFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {
    getAllFilesFromStore,
    getConnectedUsersFromStore,
    getLoggedInUserFromStore, getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopIdFromStore,
    getTabletopValidationFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import {scenarioToJson} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {ObjectVector3, ScenarioType} from '../@types/scenario';
import {
    DriveMetadata,
    DriveUser,
    MapAppProperties,
    MiniAppProperties,
    TabletopFileAppProperties
} from '../@types/googleDrive';
import {LoggedInUserReducerType} from '../redux/loggedInUserReducer';
import {ConnectedUserReducerType} from '../redux/connectedUserReducer';
import {FileAPI, FileAPIContext, splitFileName} from '../util/fileUtils';
import {buildVector3, vector3ToObject} from '../util/threeUtils';
import {PromiseModalContext} from '../container/authenticatedContainer';
import {promiseSleep} from '../util/promiseSleep';
import {confirmTabletopValidAction, TabletopValidationType} from '../redux/tabletopValidationReducer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';

import './virtualGamingTabletop.css';

interface VirtualGamingTabletopProps {
    files: FileIndexReducerType;
    tabletopId: string;
    scenario: ScenarioType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    tabletopValidation: TabletopValidationType;
    myPeerId: MyPeerIdReducerType;
    dispatch: Dispatch<ReduxStoreType>;
}

export interface VirtualGamingTabletopCameraState {
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
}

interface VirtualGamingTabletopState extends VirtualGamingTabletopCameraState {
    panelOpen: boolean;
    avatarsOpen: boolean;
    currentPage: VirtualGamingTabletopMode;
    gmConnected: boolean;
    fogOfWarMode: boolean;
    playerView: boolean;
    noGMToastId?: number;
    focusMapId?: string;
    folderStacks: {[root: string] : string[]}
}

enum VirtualGamingTabletopMode {
    GAMING_TABLETOP,
    MAP_SCREEN,
    MINIS_SCREEN,
    TABLETOP_SCREEN,
    SCENARIOS_SCREEN
}

class VirtualGamingTabletop extends React.Component<VirtualGamingTabletopProps, VirtualGamingTabletopState> {

    static SAVE_FREQUENCY_MS = 5000;

    static MAP_EPSILON = 0.01;
    static NEW_MAP_DELTA_Y = 6.0;

    static stateButtons = [
        {label: 'Tabletops', state: VirtualGamingTabletopMode.TABLETOP_SCREEN},
        {label: 'Maps', state: VirtualGamingTabletopMode.MAP_SCREEN},
        {label: 'Minis', state: VirtualGamingTabletopMode.MINIS_SCREEN},
        {label: 'Scenarios', state: VirtualGamingTabletopMode.SCENARIOS_SCREEN}
        // Templates
    ];

    static contextTypes = {
        fileAPI: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: FileAPIContext & PromiseModalContext;

    private emptyScenario: ScenarioType;

    constructor(props: VirtualGamingTabletopProps) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.setFocusMapId = this.setFocusMapId.bind(this);
        this.setCameraParameters = this.setCameraParameters.bind(this);
        this.saveScenarioToDrive = throttle(this.saveScenarioToDrive.bind(this), VirtualGamingTabletop.SAVE_FREQUENCY_MS);
        this.setFolderStack = this.setFolderStack.bind(this);
        this.findPositionForNewMini = this.findPositionForNewMini.bind(this);
        this.findUnusedMiniName = this.findUnusedMiniName.bind(this);
        this.state = {
            panelOpen: false,
            avatarsOpen: false,
            currentPage: props.tabletopId ? VirtualGamingTabletopMode.GAMING_TABLETOP : VirtualGamingTabletopMode.TABLETOP_SCREEN,
            gmConnected: this.isGMConnected(props),
            fogOfWarMode: false,
            playerView: false,
            ...this.getDefaultCameraFocus(props),
            folderStacks: [constants.FOLDER_TABLETOP, constants.FOLDER_MAP, constants.FOLDER_MINI, constants.FOLDER_SCENARIO]
                .reduce((result, root) => ({...result, [root]: [props.files.roots[root]]}), {})
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

    private loadPublicPrivateJson(metadataId: string): Promise<ScenarioType> {
        const fileAPI: FileAPI = this.context.fileAPI;
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
    }

    async waitForFileToChange(metadataId: string, loadedModifiedTimestamp?: number) {
        const originalModifiedTime = loadedModifiedTimestamp || await this.context.fileAPI.getFileModifiedTime(metadataId);
        let modifiedTime = originalModifiedTime;
        while (modifiedTime === originalModifiedTime) {
            await promiseSleep(VirtualGamingTabletop.SAVE_FREQUENCY_MS);
            modifiedTime = await this.context.fileAPI.getFileModifiedTime(metadataId);
        }
    }

    deepEqualWithMetadata(o1: object, o2: object): boolean {
        return Object.keys(o1).reduce((result, key) => (
            result && ((!o1 || !o2) ? o1 === o2 :
                (isObject(o1[key]) && isObject(o2[key])) ? (
                    (key === 'metadata') ? o1[key].id === o2[key].id : this.deepEqualWithMetadata(o1[key], o2[key])
                ) : (
                    o1[key] === o2[key]
                ))
        ), true);
    }

    waitForChangeAndVerifyTabletop(metadataId: string, lastActionId: string, loadedModifiedTimestamp?: number): Promise<void> {
        return this.waitForFileToChange(metadataId, loadedModifiedTimestamp)
            .then(() => (metadataId ? this.loadPublicPrivateJson(metadataId) : this.emptyScenario))
            .then((loadedScenario: ScenarioType) => {
                // Confirm that the data we loaded matches what we expect.
                const savedActionId = loadedScenario.lastActionId;
                if (savedActionId && this.props.tabletopValidation.scenarioIndexes !== null) {
                    const index = this.props.tabletopValidation.scenarioIndexes[savedActionId];
                    if (index !== undefined) {
                        const localScenario = this.props.tabletopValidation.scenarioHistory![index];
                        if (!this.deepEqualWithMetadata(localScenario, loadedScenario)) {
                            // We must have missed some actions in the original load - set our scenario from loaded and
                            // then re-dispatch all actions subsequent to when it was created locally.
                            console.log('Able to resync scenario - resetting and syncing.');
                            this.props.dispatch(setScenarioAction(loadedScenario));
                            this.props.tabletopValidation.scenarioActions!.slice(index + 1).forEach((action) => {
                                this.props.dispatch({...action, peerKey: undefined});
                            });
                        }
                        this.props.dispatch(confirmTabletopValidAction());
                        console.log('Client is now in sync with tabletop.');
                    } else {
                        if (lastActionId !== savedActionId) {
                            console.log('Loaded more recent data from Drive - resetting.');
                            this.props.dispatch(setScenarioAction(loadedScenario));
                        }
                        // Didn't find savedActionId in history, still waiting.
                        return this.waitForChangeAndVerifyTabletop(metadataId, savedActionId);
                    }
                }
                return undefined;
            });
    }

    loadTabletopFromDrive(metadataId: string) {
        let loadedModifiedTimestamp: undefined | number;
        let lastActionId: string;
        return Promise.resolve()
            .then(() => (metadataId ? this.context.fileAPI.getFileModifiedTime(metadataId) : Promise.resolve(undefined)))
            .then((timestamp) => {loadedModifiedTimestamp = timestamp})
            .then(() => (metadataId ? this.loadPublicPrivateJson(metadataId) : this.emptyScenario))
            .then((scenarioJson) => {
                lastActionId = scenarioJson.lastActionId;
                this.props.dispatch(setScenarioAction(scenarioJson));
            })
            .catch((err) => {
                // If the tabletop file doesn't exist, drop off that tabletop
                console.error(err);
                this.context.promiseModal && this.context.promiseModal({
                    children: 'The link you used is no longer valid.  Switching to GM mode.'
                })
                    .then(() => {
                        this.props.dispatch(setTabletopIdAction())
                    });
            })
            .then(() => (this.waitForChangeAndVerifyTabletop(metadataId, lastActionId, loadedModifiedTimestamp)));
    }

    componentDidMount() {
        return this.loadTabletopFromDrive(this.props.tabletopId);
    }

    saveScenarioToDrive(metadataId: string, scenarioState: ScenarioType, publicActionId?: string): any {
        // Only save if the metadataId is for a file we own
        const driveMetadata = metadataId && this.props.files.driveMetadata[metadataId] as DriveMetadata<TabletopFileAppProperties>;
        if (this.props.loggedInUser && scenarioState.gm === this.props.loggedInUser.emailAddress && metadataId && driveMetadata && driveMetadata.appProperties) {
            const [privateScenario, publicScenario] = scenarioToJson(scenarioState, publicActionId);
            return this.context.fileAPI.saveJsonToFile({id: metadataId}, publicScenario)
                .then(() => (this.context.fileAPI.saveJsonToFile({id: driveMetadata.appProperties.gmFile}, privateScenario)))
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
        if (this.props.tabletopValidation && this.props.tabletopValidation.lastCommonScenario && props.tabletopValidation && props.tabletopValidation.lastCommonScenario
                && props.tabletopValidation.lastCommonScenario.lastActionId !== this.props.tabletopValidation.lastCommonScenario.lastActionId) {
            this.saveScenarioToDrive(props.tabletopId, props.tabletopValidation.lastCommonScenario, props.tabletopValidation.lastPublicActionId);
        }
        this.setState({gmConnected: this.isGMConnected(props)}, () => {
            if (this.state.gmConnected) {
                if (this.state.noGMToastId) {
                    toast.dismiss(this.state.noGMToastId);
                    this.setState({noGMToastId: undefined});
                }
            } else if (!this.state.noGMToastId) {
                this.setState((prevState: VirtualGamingTabletopState) => {
                    return (prevState.noGMToastId) ? null : ({
                        noGMToastId: toast('View-only mode - no GM is connected.', {
                                autoClose: false
                            })
                    });
                });
            }
        });
        if (!this.state.focusMapId || !props.scenario.maps[this.state.focusMapId]) {
            // Focus on the map closest to y=0 by default;
            let smallestDelta: number | undefined = undefined;
            const focusMapId = Object.keys(props.scenario.maps).reduce((focusMapId, mapId) => {
                const delta = Math.abs(props.scenario.maps[mapId].position.y);
                if (smallestDelta === undefined || delta < smallestDelta) {
                    smallestDelta = delta;
                    return mapId;
                } else {
                    return focusMapId;
                }
            }, undefined);
            this.setFocusMapId(focusMapId, true);
        }
    }

    onBack() {
        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
    }

    getDefaultCameraFocus(props = this.props) {
        const map = (this.state && this.state.focusMapId) ? props.scenario.maps[this.state.focusMapId] : undefined;
        if (map) {
            const cameraLookAt = buildVector3(map.position);
            return {
                cameraLookAt,
                cameraPosition: cameraLookAt.clone().add({x: 0, y: 10, z: 10} as THREE.Vector3)
            };
        } else {
            return {
                cameraLookAt: new THREE.Vector3(0, 0, 0),
                cameraPosition: new THREE.Vector3(0, 10, 10)
            }
        }
    }

    setCameraParameters(cameraParameters: Partial<VirtualGamingTabletopCameraState>) {
        // Typescript Partial<> doesn't distinguish between missing fields and undefined ones.  Ensure we can't set our
        // camera parameters to undefined values.
        this.setState({
            cameraPosition: cameraParameters.cameraPosition || this.state.cameraPosition,
            cameraLookAt: cameraParameters.cameraLookAt || this.state.cameraLookAt
        });
    }

    setFocusMapId(mapId: string | undefined, resetCamera = false) {
        if (mapId !== this.state.focusMapId) {
            const map = mapId && this.props.scenario.maps[mapId];
            const cameraLookAt = map ? buildVector3(map.position) : new THREE.Vector3();
            const positionDY = cameraLookAt.y + 10 - this.state.cameraPosition.y;
            const cameraPosition = resetCamera ? cameraLookAt.clone().add({x: 0, y: 10, z: 10} as THREE.Vector3) :
                this.state.cameraPosition.clone().add({x: 0, y: (positionDY > 0) ? positionDY : 0, z: 0} as THREE.Vector3);
            this.setState({focusMapId: mapId, cameraLookAt, cameraPosition});
        }
    }

    focusHigher() {
        // Focus on the lowest map higher than the current focus map
        const currentFocusMapY = this.state.focusMapId ? this.props.scenario.maps[this.state.focusMapId].position.y : 0;
        const focusMapId = Object.keys(this.props.scenario.maps).reduce((focusMapId: string | undefined, mapId) => {
            const focusMap = focusMapId ? this.props.scenario.maps[focusMapId] : undefined;
            const map = this.props.scenario.maps[mapId];
            return (map.position.y > currentFocusMapY && (!focusMap || map.position.y < focusMap.position.y)) ? mapId : focusMapId;
        }, undefined);
        this.setFocusMapId(focusMapId);
    }

    focusLower() {
        // Focus on the highest map lower than the current focus map
        const currentFocusMapY = this.state.focusMapId ? this.props.scenario.maps[this.state.focusMapId].position.y : 0;
        const focusMapId = Object.keys(this.props.scenario.maps).reduce((focusMapId: string | undefined, mapId) => {
            const focusMap = focusMapId ? this.props.scenario.maps[focusMapId] : undefined;
            const map = this.props.scenario.maps[mapId];
            return (map.position.y < currentFocusMapY && (!focusMap || map.position.y > focusMap.position.y)) ? mapId : focusMapId;
        }, undefined);
        this.setFocusMapId(focusMapId);
    }

    private doesPointTouchAnyMap(point: THREE.Vector3) {
        return Object.keys(this.props.scenario.maps).reduce((touching, mapId) => {
            if (touching) {
                return touching;
            }
            const map = this.props.scenario.maps[mapId];
            const width = Number(map.metadata.appProperties.width);
            const height = Number(map.metadata.appProperties.height);
            return (Math.abs(point.y - map.position.y) < VirtualGamingTabletop.MAP_EPSILON
                && point.x >= map.position.x - width / 2 && point.x < map.position.x + width / 2
                && point.z >= map.position.z - height / 2 && point.z < map.position.z + height / 2)
        }, false);
    }

    private adjustMapPositionToNotCollide(position: THREE.Vector3, width: number, height: number, performAdjust: boolean): boolean {
        let adjusted = false;
        Object.keys(this.props.scenario.maps).forEach((mapId) => {
            const map = this.props.scenario.maps[mapId];
            const mapWidth = Number(map.metadata.appProperties.width);
            const mapHeight = Number(map.metadata.appProperties.height);
            if (Math.abs(position.y - map.position.y) < VirtualGamingTabletop.MAP_EPSILON
                && position.x + width / 2 >= map.position.x - mapWidth / 2 && position.x - width / 2 < map.position.x + mapWidth / 2
                && position.z + height / 2 >= map.position.z - mapHeight / 2 && position.z - height / 2 < map.position.z + mapHeight / 2) {
                adjusted = true;
                if (performAdjust) {
                    const delta = position.clone().sub(map.position as THREE.Vector3);
                    const quadrant14 = (delta.x - delta.z > 0);
                    const quadrant12 = (delta.x + delta.z > 0);
                    if (quadrant12 && quadrant14) {
                        position.x = map.position.x + VirtualGamingTabletop.MAP_EPSILON + (mapWidth + width) / 2;
                    } else if (quadrant12) {
                        position.z = map.position.z + VirtualGamingTabletop.MAP_EPSILON + (mapHeight + height) / 2;
                    } else if (quadrant14) {
                        position.z = map.position.z - VirtualGamingTabletop.MAP_EPSILON - (mapHeight + height) / 2;
                    } else {
                        position.x = map.position.x - VirtualGamingTabletop.MAP_EPSILON - (mapWidth + width) / 2;
                    }
                }
            }
        });
        return adjusted;
    }

    findPositionForNewMap(appProperties: MapAppProperties, position = this.state.cameraLookAt.clone()): THREE.Vector3 {
        if (!this.doesPointTouchAnyMap(position)) {
            // Attempt to find free space for the map at current elevation.
            const width = Number(appProperties.width);
            const height = Number(appProperties.height);
            let search = position.clone();
            this.adjustMapPositionToNotCollide(search, width, height, true);
            if (!this.adjustMapPositionToNotCollide(search, width, height, false)) {
                return search;
            }
        }
        // Try to fit the map at a higher elevation
        position.add({x: 0, y: VirtualGamingTabletop.NEW_MAP_DELTA_Y, z: 0} as THREE.Vector3);
        return this.findPositionForNewMap(appProperties, position);
    }

    findPositionForNewMini(scale = 1.0, basePosition: THREE.Vector3 | ObjectVector3 = this.state.cameraLookAt): ObjectVector3 {
        // Search for free space in a spiral pattern around basePosition.
        const gridSnap = scale > 1 ? 1 : scale;
        const baseX = !this.props.scenario.snapToGrid ? basePosition.x : Math.floor(basePosition.x / gridSnap) * gridSnap + scale / 2;
        const baseZ = !this.props.scenario.snapToGrid ? basePosition.z : Math.floor(basePosition.z / gridSnap) * gridSnap + scale / 2;
        let horizontal = true, step = 1, delta = 1, dx = 0, dz = 0;
        while (Object.keys(this.props.scenario.minis).reduce((collide, miniId): boolean => {
            if (collide) {
                return true;
            } else {
                const mini = this.props.scenario.minis[miniId];
                const miniPosition = mini.position;
                const distance2 = (baseX + dx - miniPosition.x) * (baseX + dx - miniPosition.x)
                    + (basePosition.y - miniPosition.y) * (basePosition.y - miniPosition.y)
                    + (baseZ + dz - miniPosition.z) * (baseZ + dz - miniPosition.z);
                const minDistance = (scale + mini.scale - 0.2)/2;
                return (distance2 < minDistance * minDistance);
            }
        }, false)) {
            if (horizontal) {
                dx += delta;
                if (2 * dx * delta >= step) {
                    horizontal = false;
                }
            } else {
                dz += delta;
                if (2 * dz * delta >= step) {
                    horizontal = true;
                    delta = -delta;
                    step++;
                }
            }
        }
        return {x: baseX + dx, y: basePosition.y, z: baseZ + dz};
    }

    findUnusedMiniName(baseName: string, suffix?: number): [string, number] {
        const allMinis = this.props.scenario.minis;
        const allMiniIds = Object.keys(allMinis);
        if (!suffix) {
            // Find the largest current suffix for baseName
            let current: number;
            suffix = allMiniIds.reduce((largest, miniId) => {
                if (allMinis[miniId].name.indexOf(baseName) === 0) {
                    current = Number(allMinis[miniId].name.substr(baseName.length));
                }
                return isNaN(current) ? largest : Math.max(largest, current);
            }, 0);
        }
        let name: string;
        while (true) {
            name = suffix ? baseName + ' ' + String(suffix) : baseName;
            if (!allMiniIds.reduce((used, miniId) => (used || allMinis[miniId].name === name), false)) {
                return [name, suffix];
            }
            suffix++;
        }
    }

    setFolderStack(root: string, folderStack: string[]) {
        this.setState({folderStacks: {...this.state.folderStacks, [root]: folderStack}});
    }

    renderMenuButton() {
        return (
            this.state.panelOpen ? null : (
                <div className='menuControl material-icons' onClick={() => {
                    this.setState({panelOpen: true});
                }}>menu</div>
            )
        );
    }

    renderCameraMenu() {
        const multipleMaps = Object.keys(this.props.scenario.maps).length > 1;
        return (
            <div>
                <button title='Re-focus the camera on the current map.' onClick={() => {
                    this.setState({...this.getDefaultCameraFocus(), panelOpen: false});
                }}>Refocus Camera</button>
                <button disabled={!multipleMaps} title='Focus the camera on a map at a higher elevation.' onClick={() => {
                    this.focusHigher();
                    this.setState({panelOpen: false});
                }}>Focus Higher</button>
                <button disabled={!multipleMaps} title='Focus the camera on a map at a lower elevation.' onClick={() => {
                    this.focusLower();
                    this.setState({panelOpen: false});
                }}>Focus Lower</button>
            </div>
        )
    }

    renderGMOnlyMenu() {
        // Store in const in case it changes between now and when button onClick handler called.
        const loggedInUser = this.props.loggedInUser;
        return (!loggedInUser || loggedInUser.emailAddress !== this.props.scenario.gm) ? null : (
            <div>
                <hr/>
                <button onClick={() => {
                    const yesOption = 'Yes';
                    this.context.promiseModal && this.context.promiseModal({
                        children: 'Are you sure you want to remove all maps and minis from this tabletop?',
                        options: [yesOption, 'Cancel']
                    })
                        .then((response) => {
                            if (response === yesOption) {
                                this.props.dispatch(setScenarioAction({...this.emptyScenario, gm: loggedInUser.emailAddress}, 'clear'));
                            }
                        })
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

    renderDriveMenuButtons() {
        return !this.props.files.roots[constants.FOLDER_ROOT] ? null : (
            <div>
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

    renderMenu() {
        return (
            <div className={classNames('controlPanel', {
                open: this.state.panelOpen
            })}>
                <div className='material-icons' onClick={() => {
                    this.setState({panelOpen: false});
                }}>menu</div>
                {this.renderCameraMenu()}
                {this.renderGMOnlyMenu()}
                {this.renderDriveMenuButtons()}
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
                        scenario={this.props.scenario}
                        fullDriveMetadata={this.props.files.driveMetadata}
                        dispatch={this.props.dispatch}
                        fileAPI={this.context.fileAPI}
                        cameraPosition={this.state.cameraPosition}
                        cameraLookAt={this.state.cameraLookAt}
                        setCamera={this.setCameraParameters}
                        focusMapId={this.state.focusMapId}
                        setFocusMapId={this.setFocusMapId}
                        readOnly={!this.state.gmConnected}
                        transparentFog={userIsGM && !this.state.playerView}
                        fogOfWarMode={this.state.fogOfWarMode}
                        endFogOfWarMode={() => {
                            this.setState({fogOfWarMode: false});
                        }}
                        snapToGrid={this.props.scenario.snapToGrid}
                        userIsGM={userIsGM}
                        playerView={this.state.playerView}
                        findPositionForNewMini={this.findPositionForNewMini}
                        findUnusedMiniName={this.findUnusedMiniName}
                        myPeerId={this.props.myPeerId}
                    />
                </div>
                <ToastContainer className='toastContainer' position={toast.POSITION.BOTTOM_CENTER}/>
            </div>
        );
    }

    renderMapScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_MAP}
                folderStack={this.state.folderStacks[constants.FOLDER_MAP]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                onPickFile={(metadata: DriveMetadata<MapAppProperties>) => {
                    if (metadata.appProperties) {
                        const {name} = splitFileName(metadata.name);
                        const position = vector3ToObject(this.findPositionForNewMap(metadata.appProperties));
                        const addMap = addMapAction({metadata, name, gmOnly: false, position});
                        this.props.dispatch(addMap);
                        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP}, () => {
                            this.setFocusMapId(addMap.mapId, true);
                        });
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
                folderStack={this.state.folderStacks[constants.FOLDER_MINI]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                onPickFile={(miniMetadata: DriveMetadata<MiniAppProperties>) => {
                    if (miniMetadata.appProperties) {
                        const match = miniMetadata.name.match(/^(.*?) *([0-9]*)(\.[a-zA-Z]*)?$/);
                        if (match) {
                            let baseName = match[1], suffixStr = match[2];
                            let [name, suffix] = this.findUnusedMiniName(baseName, suffixStr ? Number(suffixStr) : undefined);
                            if (suffix === 1 && suffixStr !== '1') {
                                // There's a mini with baseName (with no suffix) already on the tabletop.  Rename it.
                                const existingMiniId = Object.keys(this.props.scenario.minis).reduce((result, miniId) => (
                                    result || (this.props.scenario.minis[miniId].name === baseName) ? miniId : null
                                ), null);
                                existingMiniId && this.props.dispatch(updateMiniNameAction(existingMiniId, name));
                                name = baseName + ' 2';
                            }
                            const position = this.findPositionForNewMini();
                            this.props.dispatch(addMiniAction({metadata: miniMetadata, name, position}));
                            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                        }
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
                folderStack={this.state.folderStacks[constants.FOLDER_TABLETOP]}
                setFolderStack={this.setFolderStack}
                highlightMetadataId={this.props.tabletopId}
                onBack={this.props.tabletopId ? this.onBack : undefined}
                customLabel='Add'
                onCustomAction={(parents) => {
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

    renderScenariosScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_SCENARIO}
                folderStack={this.state.folderStacks[constants.FOLDER_SCENARIO]}
                setFolderStack={this.setFolderStack}
                highlightMetadataId={this.props.tabletopId}
                onBack={this.props.tabletopId ? this.onBack : undefined}
                customLabel='Save current tabletop'
                onCustomAction={(parents) => {
                    const name = 'New Scenario';
                    const [privateScenario] = scenarioToJson(this.props.scenario);
                    return this.context.fileAPI.saveJsonToFile({name, parents}, privateScenario);
                }}
                onPickFile={(scenarioMetadata) => {
                    const yesOption = 'Yes, replace';
                    this.context.promiseModal && this.context.promiseModal({
                        children: 'Loading a scenario will replace the contents of your current tabletop.  Proceed?',
                        options: [yesOption, 'Cancel']
                    })
                        .then((response?: string): any => {
                            if (response === yesOption) {
                                return this.context.fileAPI.getJsonFileContents(scenarioMetadata)
                                    .then((json: ScenarioType) => {
                                        const [privateScenario, publicScenario] = scenarioToJson(json);
                                        this.props.dispatch(setScenarioAction(publicScenario, scenarioMetadata.id));
                                        this.props.dispatch(setScenarioAction(privateScenario));
                                        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                                    });
                            }
                        });
                    return true;
                }}
                editorComponent={ScenarioFileEditor}
                emptyMessage={
                    <div>
                        <p>Scenarios are used to save and restore tabletop layouts.  After you have set up the maps and
                        miniatures to your satisfaction in a tabletop, save them as a scenario here to preserve your
                        work and to move them between tabletops.  Pick a scenario to load it again into the current
                        tabletop, replacing that tabletop's contents.</p>
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
            case VirtualGamingTabletopMode.SCENARIOS_SCREEN:
                return this.renderScenariosScreen();
        }
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store),
        scenario: getScenarioFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store),
        connectedUsers: getConnectedUsersFromStore(store),
        myPeerId: getMyPeerIdFromStore(store),
        tabletopValidation: getTabletopValidationFromStore(store)
    }
}

export default connect(mapStoreToProps)(VirtualGamingTabletop);