import * as React from 'react';
import * as PropTypes from 'prop-types';
import classNames from 'classnames';
import {connect} from 'react-redux';
import {Dispatch} from 'redux';
import {isEqual, isObject, throttle} from 'lodash';
import {toast, ToastContainer} from 'react-toastify';
import * as THREE from 'three';
import {randomBytes} from 'crypto';
import Modal from 'react-modal';
import copyToClipboard from 'copy-to-clipboard';
import memoizeOne from 'memoize-one';
import FullScreen from 'react-full-screen';
import {withResizeDetector} from 'react-resize-detector';

import TabletopViewComponent, {TabletopViewComponentCameraView} from './tabletopViewComponent';
import BrowseFilesComponent from '../container/browseFilesComponent';
import * as constants from '../util/constants';
import MapEditor from './mapEditor';
import MiniEditor from './miniEditor';
import TabletopEditor from './tabletopEditor';
import ScenarioFileEditor from './scenarioFileEditor';
import settableScenarioReducer, {
    addMapAction,
    addMiniAction,
    replaceMapImageAction,
    replaceMetadataAction,
    setScenarioAction,
    updateConfirmMovesAction,
    updateMiniNameAction,
    updateSnapToGridAction
} from '../redux/scenarioReducer';
import {setTabletopIdAction} from '../redux/locationReducer';
import {
    addFilesAction,
    ERROR_FILE_NAME,
    FileIndexReducerType,
    removeFileAction,
    setFileContinueAction
} from '../redux/fileIndexReducer';
import {
    getAllFilesFromStore,
    getConnectedUsersFromStore,
    getCreateInitialStructureFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    getTabletopValidationFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import {
    scenarioToJson,
    jsonToScenarioAndTabletop,
    ObjectVector3,
    ScenarioType,
    TabletopType,
    DistanceMode, DistanceRound, MapType
} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {
    castTemplateAppProperties,
    DriveMetadata,
    MapAppProperties,
    MiniAppProperties,
    TabletopFileAppProperties,
    TemplateAppProperties,
    TemplateShape
} from '../util/googleDriveUtils';
import {LoggedInUserReducerType} from '../redux/loggedInUserReducer';
import {ConnectedUserReducerType, updateConnectedUserAction} from '../redux/connectedUserReducer';
import {FileAPI, FileAPIContext, splitFileName} from '../util/fileUtils';
import {buildVector3, vector3ToObject} from '../util/threeUtils';
import {PromiseModalContext} from '../container/authenticatedContainer';
import {promiseSleep} from '../util/promiseSleep';
import {confirmTabletopValidAction, TabletopValidationType} from '../redux/tabletopValidationReducer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {setTabletopAction} from '../redux/tabletopReducer';
import InputField from './inputField';
import BundleFileEditor from './bundleFileEditor';
import {BundleType, isBundle} from '../util/bundleUtils';
import {setBundleIdAction} from '../redux/bundleReducer';
import TemplateEditor from './templateEditor';
import {CommsStyle} from '../util/commsNode';
import {
    CreateInitialStructureReducerType,
    setCreateInitialStructureAction
} from '../redux/createInitialStructureReducer';
import {getTutorialScenario} from '../tutorial/tutorialUtils';
import GoogleAvatar from './googleAvatar';
import DeviceLayoutComponent from './deviceLayoutComponent';
import {
    DeviceLayoutReducerType,
    updateGroupCameraAction, updateGroupCameraFocusMapIdAction
} from '../redux/deviceLayoutReducer';

import './virtualGamingTabletop.css';

interface VirtualGamingTabletopProps {
    files: FileIndexReducerType;
    tabletopId: string;
    scenario: ScenarioType;
    tabletop: TabletopType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    tabletopValidation: TabletopValidationType;
    myPeerId: MyPeerIdReducerType;
    dispatch: Dispatch<ReduxStoreType>;
    createInitialStructure: CreateInitialStructureReducerType;
    deviceLayout: DeviceLayoutReducerType;
    width: number;
    height: number;
}

export interface VirtualGamingTabletopCameraState {
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
}

interface VirtualGamingTabletopState extends VirtualGamingTabletopCameraState {
    targetCameraPosition?: THREE.Vector3;
    targetCameraLookAt?: THREE.Vector3;
    cameraAnimationStart?: number;
    cameraAnimationEnd?: number;
    fullScreen: boolean;
    loading: string;
    panelOpen: boolean;
    avatarsOpen: boolean;
    currentPage: VirtualGamingTabletopMode;
    replaceMiniMetadataId?: string;
    replaceMapMetadataId?: string;
    replaceMapImageId?: string;
    gmConnected: boolean;
    fogOfWarMode: boolean;
    playerView: boolean;
    noGMToastId?: number;
    focusMapId?: string;
    folderStacks: {[root: string]: string[]};
    labelSize: number;
    workingMessages: string[];
    workingButtons: {[key: string]: () => void};
}

enum VirtualGamingTabletopMode {
    GAMING_TABLETOP,
    MAP_SCREEN,
    MINIS_SCREEN,
    TEMPLATES_SCREEN,
    TABLETOP_SCREEN,
    SCENARIOS_SCREEN,
    BUNDLES_SCREEN,
    WORKING_SCREEN,
    DEVICE_LAYOUT_SCREEN
}

export const SAME_LEVEL_MAP_DELTA_Y = 2.0;

class VirtualGamingTabletop extends React.Component<VirtualGamingTabletopProps, VirtualGamingTabletopState> {

    static SAVE_FREQUENCY_MS = 5000;

    static MAP_EPSILON = 0.01;
    static NEW_MAP_DELTA_Y = 6.0;

    static CAMERA_INITIAL_OFFSET = 12.0;

    static isTabletopReadonly = (self: VirtualGamingTabletop) => (!self.state.gmConnected);
    static isCurrentUserPlayer = (self: VirtualGamingTabletop) => (!self.props.loggedInUser || self.props.loggedInUser.emailAddress !== self.props.tabletop.gm);

    static stateButtons = [
        {label: 'Tabletops', state: VirtualGamingTabletopMode.TABLETOP_SCREEN},
        {label: 'Maps', state: VirtualGamingTabletopMode.MAP_SCREEN, disabled: VirtualGamingTabletop.isTabletopReadonly},
        {label: 'Minis', state: VirtualGamingTabletopMode.MINIS_SCREEN, disabled: VirtualGamingTabletop.isTabletopReadonly},
        {label: 'Templates', state: VirtualGamingTabletopMode.TEMPLATES_SCREEN, disabled: VirtualGamingTabletop.isTabletopReadonly},
        {label: 'Scenarios', state: VirtualGamingTabletopMode.SCENARIOS_SCREEN, disabled: VirtualGamingTabletop.isCurrentUserPlayer},
        {label: 'Bundles', state: VirtualGamingTabletopMode.BUNDLES_SCREEN}
    ];

    static templateIcon = {
        [TemplateShape.CIRCLE]: 'fiber_manual_record',
        [TemplateShape.ARC]: 'signal_wifi_4_bar'
    };

    static contextTypes = {
        fileAPI: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: FileAPIContext & PromiseModalContext;

    private readonly emptyScenario: ScenarioType;
    private readonly emptyTabletop: ScenarioType & TabletopType;

    constructor(props: VirtualGamingTabletopProps) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.setFocusMapId = this.setFocusMapId.bind(this);
        this.setCameraParameters = this.setCameraParameters.bind(this);
        this.saveTabletopToDrive = throttle(this.saveTabletopToDrive.bind(this), VirtualGamingTabletop.SAVE_FREQUENCY_MS);
        this.setFolderStack = this.setFolderStack.bind(this);
        this.findPositionForNewMini = this.findPositionForNewMini.bind(this);
        this.findUnusedMiniName = this.findUnusedMiniName.bind(this);
        this.calculateCameraView = memoizeOne(this.calculateCameraView);
        this.isMapHighest = memoizeOne(this.isMapHighest);
        this.isMapLowest = memoizeOne(this.isMapLowest);
        this.state = {
            fullScreen: false,
            loading: '',
            panelOpen: !props.scenario || (Object.keys(props.scenario.minis).length === 0 && Object.keys(props.scenario.maps).length === 0),
            avatarsOpen: false,
            currentPage: props.tabletopId ? VirtualGamingTabletopMode.GAMING_TABLETOP : VirtualGamingTabletopMode.TABLETOP_SCREEN,
            gmConnected: this.isGMConnected(props),
            fogOfWarMode: false,
            playerView: false,
            ...this.getDefaultCameraFocus(props),
            folderStacks: [constants.FOLDER_TABLETOP, constants.FOLDER_MAP, constants.FOLDER_MINI, constants.FOLDER_TEMPLATE, constants.FOLDER_SCENARIO, constants.FOLDER_BUNDLE]
                .reduce((result, root) => ({...result, [root]: [props.files.roots[root]]}), {}),
            labelSize: 0.4,
            workingMessages: [],
            workingButtons: {}
        };
        this.emptyScenario = settableScenarioReducer(undefined as any, {type: '@@init'});
        this.emptyTabletop = {
            ...this.emptyScenario,
            gm: props.loggedInUser!.emailAddress,
            gmSecret: '',
            distanceMode: DistanceMode.STRAIGHT,
            distanceRound: DistanceRound.ROUND_OFF,
            commsStyle: CommsStyle.PeerToPeer
        };
    }

    isGMConnected(props: VirtualGamingTabletopProps) {
        // If I own the tabletop, then the GM is connected by definition.  Otherwise, check connectedUsers.
        return !props.tabletop || !props.tabletop.gm ||
            (props.loggedInUser && props.loggedInUser.emailAddress === props.tabletop.gm) ||
            Object.keys(props.connectedUsers).reduce((result, peerId) => (
                result || props.connectedUsers[peerId].user.emailAddress === props.tabletop.gm
            ), false);
    }

    private loadPublicPrivateJson(metadataId: string): Promise<(ScenarioType & TabletopType) | BundleType> {
        const fileAPI: FileAPI = this.context.fileAPI;
        return fileAPI.getJsonFileContents({id: metadataId})
            .then((loadedJson: any) => {
                if (loadedJson.gm && loadedJson.gm === this.props.loggedInUser!.emailAddress) {
                    const publicMetadata = this.props.files.driveMetadata[metadataId];
                    return (publicMetadata ? Promise.resolve(publicMetadata) : fileAPI.getFullMetadata(metadataId).then((publicMetadata) => {
                        this.props.dispatch(addFilesAction([publicMetadata]));
                        return publicMetadata
                    }))
                        .then((publicMetadata: DriveMetadata<TabletopFileAppProperties>) => (fileAPI.getJsonFileContents({id: publicMetadata.appProperties.gmFile})))
                        .then((privateTabletopJson: any) => {
                            return {...loadedJson, ...privateTabletopJson};
                        })
                } else {
                    return loadedJson;
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
            .then(() => (this.loadPublicPrivateJson(metadataId)))
            .then((combined: ScenarioType & TabletopType) => {
                const [loadedScenario] = jsonToScenarioAndTabletop(combined, this.props.files.driveMetadata);
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

    private addWorkingMessage(message: string) {
        this.setState((state) => ({workingMessages: [...state.workingMessages, message]}));
    }

    private appendToLastWorkingMessage(message: string) {
        this.setState((state) => ({workingMessages: [
            ...state.workingMessages.slice(0, state.workingMessages.length - 1),
            state.workingMessages[state.workingMessages.length - 1] + message
        ]}));
    }

    private async createImageShortcutFromDrive(root: string, bundleName: string, fromBundleId: string, metadataList: string[]): Promise<void> {
        let folder;
        for (let metadataId of metadataList) {
            if (!folder) {
                folder = await this.context.fileAPI.createFolder(bundleName, {parents: [this.props.files.roots[root]], appProperties: {fromBundleId}});
                this.addWorkingMessage(`Created folder ${root}/${bundleName}.`);
            }
            try {
                const bundleMetadata = await this.context.fileAPI.getFullMetadata(metadataId);
                this.addWorkingMessage(`Creating shortcut to image in ${root}/${bundleName}/${bundleMetadata.name}...`);
                await this.context.fileAPI.createShortcut({...bundleMetadata, appProperties: {...bundleMetadata.appProperties, fromBundleId}}, folder.id);
                this.appendToLastWorkingMessage(' done.');
            } catch (e) {
                this.addWorkingMessage(`Error! failed to create shortcut to image.`);
                console.error(e);
            }
        }
    }

    private async extractBundle(bundle: BundleType, fromBundleId: string) {
        this.props.dispatch(setBundleIdAction(this.props.tabletopId));
        if (this.props.files.roots[constants.FOLDER_SCENARIO] && this.props.files.roots[constants.FOLDER_MAP] && this.props.files.roots[constants.FOLDER_MINI]) {
            // Check if have files from this bundle already...
            // const existingBundleFiles = await this.context.fileAPI.findFilesWithAppProperty('fromBundleId', fromBundleId);
            this.setState({currentPage: VirtualGamingTabletopMode.WORKING_SCREEN, workingMessages: [], workingButtons: {}});
            this.addWorkingMessage(`Extracting bundle ${bundle.name}!`);
            await this.createImageShortcutFromDrive(constants.FOLDER_MAP, bundle.name, fromBundleId, bundle.driveMaps);
            await this.createImageShortcutFromDrive(constants.FOLDER_MINI, bundle.name, fromBundleId, bundle.driveMinis);
            let folder;
            for (let scenarioName of Object.keys(bundle.scenarios)) {
                if (!folder) {
                    folder = await this.context.fileAPI.createFolder(bundle.name, {parents: [this.props.files.roots[constants.FOLDER_SCENARIO]]});
                    this.addWorkingMessage(`Created folder ${constants.FOLDER_SCENARIO}/${bundle.name}.`);
                }
                const scenario = bundle.scenarios[scenarioName];
                this.addWorkingMessage(`Saving scenario ${scenarioName}...`);
                await this.context.fileAPI.saveJsonToFile({name: scenarioName, parents: [folder.id], appProperties: {fromBundleId}}, scenario);
                this.appendToLastWorkingMessage(' done.');
            }
            this.addWorkingMessage(`Finished extracting bundle ${bundle.name}!`);
            this.setState({workingButtons: {...this.state.workingButtons, 'Close': () => {this.props.dispatch(setTabletopIdAction())}}})
        }
    }

    async loadTabletopFromDrive(metadataId: string) {
        let lastActionId = '';
        try {
            const loadedModifiedTimestamp = metadataId ? await this.context.fileAPI.getFileModifiedTime(metadataId) : undefined;
            const json = metadataId ? await this.loadPublicPrivateJson(metadataId) : this.emptyTabletop;
            if (isBundle(json)) {
                await this.extractBundle(json, metadataId);
            } else {
                const [loadedScenario, loadedTabletop] = jsonToScenarioAndTabletop(json, this.props.files.driveMetadata);
                this.props.dispatch(setTabletopAction(loadedTabletop));
                this.props.dispatch(setScenarioAction(loadedScenario));
                lastActionId = loadedScenario.lastActionId;
            }
            if (metadataId) {
                await this.waitForChangeAndVerifyTabletop(metadataId, lastActionId, loadedModifiedTimestamp);
            }
        } catch (err) {
            // If the tabletop file doesn't exist, drop off that tabletop
            console.error(err);
            this.context.promiseModal && await this.context.promiseModal({
                children: 'The link you used is no longer valid.  Switching to GM mode.'
            });
            this.props.dispatch(setTabletopIdAction())
        }
    }

    async createTutorial(createTabletop = true) {
        this.props.dispatch(setCreateInitialStructureAction(false));
        const scenarioFolderMetadataId = this.props.files.roots[constants.FOLDER_SCENARIO];
        this.setState({loading: ': Creating tutorial scenario...'});
        const tutorialScenario = getTutorialScenario();
        const scenarioMetadata = await this.context.fileAPI.saveJsonToFile({name: 'Tutorial Scenario', parents: [scenarioFolderMetadataId]}, tutorialScenario);
        this.props.dispatch(addFilesAction([scenarioMetadata]));
        if (createTabletop) {
            this.setState({loading: ': Creating tutorial tabletop...'});
            const tabletopFolderMetadataId = this.props.files.roots[constants.FOLDER_TABLETOP];
            const publicTabletopMetadata = await this.createNewTabletop([tabletopFolderMetadataId], 'Tutorial Tabletop', tutorialScenario as any);
            this.props.dispatch(setTabletopIdAction(publicTabletopMetadata.id));
            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
        }
        this.setState({loading: ''});
    }

    async componentDidMount() {
        await this.loadTabletopFromDrive(this.props.tabletopId);
    }

    componentDidUpdate() {
        if (this.props.createInitialStructure && !this.props.tabletopId) {
            this.setState((state) => {
                if (!state.loading) {
                    this.createTutorial();
                    return {loading: '...'};
                }
                return null;
            });
        }
        this.animateCameraFromState();
    }

    private animateCameraFromState() {
        const {targetCameraPosition, targetCameraLookAt, cameraAnimationStart, cameraAnimationEnd} = this.state;
        if (targetCameraPosition && targetCameraLookAt) {
            window.setTimeout(() => {
                this.setState(({cameraPosition, cameraLookAt}) => {
                    const deltaTime = cameraAnimationStart && cameraAnimationEnd ? (Date.now() - cameraAnimationStart) / (cameraAnimationEnd - cameraAnimationStart) : undefined;
                    if (deltaTime === undefined || deltaTime > 1) {
                        return {
                            cameraLookAt: targetCameraLookAt,
                            cameraPosition: targetCameraPosition,
                            targetCameraLookAt: undefined,
                            targetCameraPosition: undefined,
                            cameraAnimationStart: undefined,
                            cameraAnimationEnd: undefined
                        };
                    } else if (cameraPosition && cameraLookAt) {
                        return {
                            cameraPosition: cameraPosition.clone().lerp(targetCameraPosition, deltaTime),
                            cameraLookAt: cameraLookAt.clone().lerp(targetCameraLookAt, deltaTime)
                        };
                    } else {
                        return null;
                    }
                });
            }, 1);
        }
    }

    saveTabletopToDrive(metadataId: string, scenarioState: ScenarioType, publicActionId?: string): any {
        // Only save the scenario data if we own this tabletop
        const driveMetadata = metadataId && this.props.files.driveMetadata[metadataId] as DriveMetadata<TabletopFileAppProperties>;
        if (this.loggedInUserIsGM() && metadataId && driveMetadata && driveMetadata.appProperties) {
            const [privateScenario, publicScenario] = scenarioToJson(scenarioState, publicActionId);
            return this.context.fileAPI.saveJsonToFile(metadataId, {...publicScenario, ...this.props.tabletop, gmSecret: undefined})
                .then(() => (this.context.fileAPI.saveJsonToFile(driveMetadata.appProperties.gmFile, {...privateScenario, ...this.props.tabletop})))
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
            this.saveTabletopToDrive(props.tabletopId, props.tabletopValidation.lastCommonScenario, props.tabletopValidation.lastPublicActionId);
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
            this.setFocusMapId(focusMapId, !props.scenario.startCameraAtOrigin, props);
        }
        if (props.width !== this.props.width || props.height !== this.props.height) {
            this.props.dispatch(updateConnectedUserAction(this.props.myPeerId!, props.width, props.height));
        }
        this.updateCameraFromProps(props);
    }

    private updateCameraFromProps(props: VirtualGamingTabletopProps) {
        if (props.deviceLayout.layout[props.myPeerId!]) {
            const groupId = props.deviceLayout.layout[this.props.myPeerId!].deviceGroupId;
            const groupCamera = props.deviceLayout.groupCamera[groupId];
            const prevGroupCamera = this.props.deviceLayout.groupCamera[groupId];
            const cameraPosition = groupCamera.cameraPosition ? buildVector3(groupCamera.cameraPosition) : this.state.cameraPosition;
            const cameraLookAt = groupCamera.cameraLookAt ? buildVector3(groupCamera.cameraLookAt) : this.state.cameraLookAt;
            if (groupCamera.animate) {
                if (!prevGroupCamera
                    || !prevGroupCamera.animate
                    || !isEqual(prevGroupCamera.cameraPosition, groupCamera.cameraPosition)
                    || !isEqual(prevGroupCamera.cameraLookAt, groupCamera.cameraLookAt)
                ) {
                    const cameraAnimationStart = Date.now();
                    this.setState({
                        targetCameraPosition: cameraPosition,
                        targetCameraLookAt: cameraLookAt,
                        cameraAnimationStart,
                        cameraAnimationEnd: cameraAnimationStart + groupCamera.animate
                    });
                }
            } else if (!prevGroupCamera || !isEqual(prevGroupCamera.cameraPosition, groupCamera.cameraPosition) || !isEqual(prevGroupCamera.cameraLookAt, groupCamera.cameraLookAt)) {
                this.setState({cameraPosition, cameraLookAt,
                    targetCameraPosition: undefined, targetCameraLookAt: undefined,
                    cameraAnimationStart: undefined, cameraAnimationEnd: undefined});
            }
            if (!prevGroupCamera || prevGroupCamera.focusMapId !== groupCamera.focusMapId) {
                this.setState({focusMapId: groupCamera.focusMapId});
            }
        }
    }

    onBack() {
        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP, replaceMapMetadataId: undefined, replaceMapImageId: undefined});
    }

    getDefaultCameraFocus(props = this.props) {
        const map = (this.state && this.state.focusMapId) ? props.scenario.maps[this.state.focusMapId] : undefined;
        const cameraLookAt = map ? buildVector3(map.position) : new THREE.Vector3();
        return {
            cameraLookAt,
            cameraPosition: cameraLookAt.clone().add({x: 0, y: VirtualGamingTabletop.CAMERA_INITIAL_OFFSET, z: VirtualGamingTabletop.CAMERA_INITIAL_OFFSET} as THREE.Vector3)
        };
    }

    setCameraParameters(cameraParameters: Partial<VirtualGamingTabletopCameraState>, animate = 0) {
        if (this.props.deviceLayout.layout[this.props.myPeerId!]) {
            // We're part of a combined display - camera parameters are in the Redux store.
            this.props.dispatch(updateGroupCameraAction(this.props.deviceLayout.layout[this.props.myPeerId!].deviceGroupId, cameraParameters, animate));
        } else if (animate) {
            const cameraAnimationStart = Date.now();
            const cameraAnimationEnd = cameraAnimationStart + animate;
            this.setState({
                cameraAnimationStart,
                cameraAnimationEnd,
                targetCameraPosition: cameraParameters.cameraPosition || this.state.cameraPosition,
                targetCameraLookAt: cameraParameters.cameraLookAt || this.state.cameraLookAt
            });
        } else {
            this.setState({
                cameraPosition: cameraParameters.cameraPosition || this.state.cameraPosition,
                cameraLookAt: cameraParameters.cameraLookAt || this.state.cameraLookAt,
                targetCameraPosition: undefined,
                targetCameraLookAt: undefined,
                cameraAnimationStart: undefined,
                cameraAnimationEnd: undefined
            });
        }
    }

    isMapHighest(maps: {[key: string]: MapType}, mapId?: string): boolean {
        const map = mapId ? maps[mapId] : undefined;
        return !map ? true : Object.keys(maps).reduce((highest, otherMapId) => {
            const otherMap = maps[otherMapId];
            return highest && (mapId === otherMapId || otherMap.position.y <= map.position.y + SAME_LEVEL_MAP_DELTA_Y)
        }, true);
    }

    isMapLowest(maps: {[key: string]: MapType}, mapId?: string): boolean {
        const map = mapId ? maps[mapId] : undefined;
        return !map ? true : Object.keys(maps).reduce((lowest, otherMapId) => {
            const otherMap = maps[otherMapId];
            return lowest && (mapId === otherMapId || otherMap.position.y > map.position.y - SAME_LEVEL_MAP_DELTA_Y)
        }, true);
    }

    setFocusMapId(focusMapId: string | undefined, moveCamera: boolean = true, props = this.props) {
        const map = focusMapId ? props.scenario.maps[focusMapId] : undefined;
        if (moveCamera) {
            // Move camera to look at map's position, but don't change view angle.
            const cameraOffset = this.state.cameraPosition.clone().sub(this.state.cameraLookAt)
                .normalize().multiplyScalar(VirtualGamingTabletop.CAMERA_INITIAL_OFFSET * Math.SQRT2);
            const cameraLookAt = map ? buildVector3(map.position) : new THREE.Vector3();
            const cameraPosition = cameraLookAt.clone().add(cameraOffset);
            this.setCameraParameters({cameraPosition, cameraLookAt}, 1000);
        }
        this.setState({focusMapId});
        if (props.deviceLayout.layout[this.props.myPeerId!]) {
            props.dispatch(updateGroupCameraFocusMapIdAction(props.deviceLayout.layout[props.myPeerId!].deviceGroupId, focusMapId));
        }
    }

    focusHigher() {
        // Focus on the lowest map higher than the current focus map + SAME_LEVEL_MAP_DELTA_Y
        const currentFocusMapY = this.state.focusMapId ? this.props.scenario.maps[this.state.focusMapId].position.y + SAME_LEVEL_MAP_DELTA_Y : 0;
        const focusMapId = Object.keys(this.props.scenario.maps).reduce((focusMapId: string | undefined, mapId) => {
            const focusMap = focusMapId ? this.props.scenario.maps[focusMapId] : undefined;
            const map = this.props.scenario.maps[mapId];
            return (map.position.y > currentFocusMapY && (!focusMap || map.position.y < focusMap.position.y)) ? mapId : focusMapId;
        }, undefined);
        this.setFocusMapId(focusMapId);
    }

    focusLower() {
        // Focus on the highest map lower than the current focus map - SAME_LEVEL_MAP_DELTA_Y
        const currentFocusMapY = this.state.focusMapId ? this.props.scenario.maps[this.state.focusMapId].position.y - SAME_LEVEL_MAP_DELTA_Y : 0;
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

    findPositionForNewMap(appProperties: MapAppProperties, position = this.state.cameraLookAt): THREE.Vector3 {
        if (!this.doesPointTouchAnyMap(position)) {
            // Attempt to find free space for the map at current elevation.
            const width = Number(appProperties.width) || 10;
            const height = Number(appProperties.height) || 10;
            const dx = (1 + Number(appProperties.gridOffsetX) / Number(appProperties.gridSize)) % 1 || 0;
            const dy = (1 + Number(appProperties.gridOffsetY) / Number(appProperties.gridSize)) % 1 || 0;
            const mapDX = (width / 2) % 1 - dx;
            const mapDZ = (height / 2) % 1 - dy;
            let search = new THREE.Vector3(Math.round(position.x) + mapDX, Math.round(position.y), Math.round(position.z) + mapDZ);
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

    copyURLToClipboard(suffix: string) {
        const location = window.location.href.replace(/[\\\/][^\/\\]*$/, '/' + suffix);
        copyToClipboard(location);
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

    renderEveryoneMenu() {
        return (
            <div>
                <div className='controlsRow'>
                    <InputButton type='button' disabled={this.isMapHighest(this.props.scenario.maps, this.state.focusMapId)}
                                 title='Focus the camera on a map at a higher elevation.'
                                 onChange={() => {
                                     this.focusHigher();
                                 }}>
                        <span className='material-icons'>expand_less</span>
                    </InputButton>
                    <InputButton type='button' title='Re-focus the camera on the current map.'
                                 onChange={() => {
                                     this.setCameraParameters(this.getDefaultCameraFocus(), 1000);
                                 }}>
                        <span className='material-icons'>videocam</span>
                    </InputButton>
                    <InputButton type='button' disabled={this.isMapLowest(this.props.scenario.maps, this.state.focusMapId)}
                                 title='Focus the camera on a map at a lower elevation.'
                                 onChange={() => {
                                     this.focusLower();
                                 }}>
                        <span className='material-icons'>expand_more</span>
                    </InputButton>
                </div>
                <div className='controlsRow'>
                    <span className='smaller'>A</span>
                    <InputField className='labelSizeInput' type='range' title='Label Size'
                                initialValue={this.state.labelSize} minValue={0.2} maxValue={0.6} step={0.1}
                                onChange={(value) => {
                                    this.setState({labelSize: Number(value)})
                                }}
                    />
                    <span className='larger'>A</span>
                </div>
                <div className='controlsRow'>
                    <InputButton type='button'
                                 title={this.state.fullScreen ? 'Exit full-screen mode' : 'Start full-screen mode'}
                                 onChange={() => {this.setState({fullScreen: !this.state.fullScreen})}}>
                        <span className='material-icons'>{this.state.fullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </InputButton>
                    <InputButton type='button'
                                 title='Copy Tabletop URL to clipboard'
                                 onChange={() => {
                                     copyToClipboard(window.location.href);
                                     toast('Current tabletop URL copied to clipboard.');
                                 }}>
                        <span className='material-icons'>share</span>
                    </InputButton>
                </div>
            </div>
        )
    }

    loggedInUserIsGM(): boolean {
        return (this.props.loggedInUser !== null && this.props.loggedInUser.emailAddress === this.props.tabletop.gm);
    }

    renderGMOnlyMenu() {
        return (!this.loggedInUserIsGM()) ? null : (
            <div>
                <hr/>
                <InputButton type='checkbox' fillWidth={true} selected={this.props.scenario.snapToGrid} onChange={() => {
                    this.props.dispatch(updateSnapToGridAction(!this.props.scenario.snapToGrid));
                }} title='Snap minis to the grid when moving them.'>Grid Snap</InputButton>
                <InputButton type='checkbox' fillWidth={true} selected={this.state.fogOfWarMode} onChange={() => {
                    this.setState({fogOfWarMode: !this.state.fogOfWarMode});
                }} title='Cover or reveal map sections with the fog of war.'>Edit Fog</InputButton>
                <InputButton type='checkbox' fillWidth={true} selected={!this.props.scenario.confirmMoves} onChange={() => {
                    this.props.dispatch(updateConfirmMovesAction(!this.props.scenario.confirmMoves));
                }} title='Toggle whether movement needs to be confirmed.'>Free Move</InputButton>
                <InputButton type='checkbox' fillWidth={true} selected={!this.state.playerView} onChange={() => {
                    this.setState({playerView: !this.state.playerView});
                }} title='Toggle between the "see everything" GM View and what players can see.'>GM View</InputButton>
            </div>
        );
    }

    renderClearButton() {
        return (!this.loggedInUserIsGM()) ? null : (
            <div>
                <hr/>
                <InputButton type='button' fillWidth={true} className='scaryButton' onChange={() => {
                    const yesOption = 'Yes';
                    this.context.promiseModal && this.context.promiseModal({
                        children: 'Are you sure you want to remove all maps and minis from this tabletop?',
                        options: [yesOption, 'Cancel']
                    })
                        .then((response) => {
                            if (response === yesOption) {
                                this.props.dispatch(setScenarioAction(this.emptyScenario, 'clear'));
                            }
                        })
                }}>Clear Tabletop</InputButton>
            </div>
        );
    }

    renderDriveMenuButtons() {
        return !this.props.files.roots[constants.FOLDER_ROOT] ? null : (
            <div>
                <hr/>
                {
                    VirtualGamingTabletop.stateButtons.map((buttonData) => (
                        <InputButton
                            key={buttonData.label}
                            type='button'
                            fillWidth={true}
                            disabled={buttonData.disabled ? buttonData.disabled(this) : false}
                            onChange={() => {
                                this.setState({currentPage: buttonData.state});
                            }}
                        >{buttonData.label}</InputButton>
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
                <div className='material-icons openMenuControl' onClick={() => {
                    this.setState({panelOpen: false});
                }}>close</div>
                <div className='scrollWrapper'>
                    <div className='buttonsPanel'>
                        {this.renderEveryoneMenu()}
                        {this.renderGMOnlyMenu()}
                        {this.renderDriveMenuButtons()}
                        {this.renderClearButton()}
                    </div>
                </div>
            </div>
        );
    }

    renderAvatars() {
        const connectedUsers = Object.keys(this.props.connectedUsers);
        return (
            <div>
                <div className='loggedInAvatar' onClick={() => {
                    this.setState({avatarsOpen: !this.state.avatarsOpen})
                }}>
                    <GoogleAvatar user={this.props.loggedInUser!}/>
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
                            <InputButton type='button' onChange={this.context.fileAPI.signOutFromFileAPI}>
                                Sign Out
                            </InputButton>
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
                                        const user = this.props.connectedUsers[peerId].user;
                                        const userIsGM = (user.emailAddress === this.props.tabletop.gm);
                                        return (
                                            <div key={peerId} className={classNames({userIsGM})}>
                                                <GoogleAvatar user={user}/>
                                                <span title={user.displayName}>{user.displayName}</span>
                                            </div>
                                        )
                                    })
                                )
                            }
                            {
                                connectedUsers.length === 0 ? null : (
                                    <div>
                                        <hr/>
                                        <InputButton type='button' onChange={() => {
                                            this.setState({currentPage: VirtualGamingTabletopMode.DEVICE_LAYOUT_SCREEN, avatarsOpen: false})
                                        }}>
                                            Combine devices
                                        </InputButton>
                                    </div>
                                )
                            }

                        </div>
                    )
                }
            </div>
        );
    }

    renderFileErrorModal() {
        if (!this.loggedInUserIsGM()) {
            return null;
        } else {
            let isMap = true;
            let errorId = Object.keys(this.props.scenario.maps).reduce((errorId, mapId) => (
                errorId || (this.props.scenario.maps[mapId].metadata.name === ERROR_FILE_NAME && mapId)
            ), undefined);
            if (!errorId) {
                isMap = false;
                errorId = Object.keys(this.props.scenario.minis).reduce((errorId, miniId) => (
                    errorId || (this.props.scenario.minis[miniId].metadata.name === ERROR_FILE_NAME && miniId)
                ), undefined);
            }
            if (!errorId) {
                return null;
            }
            const mapOrMini = isMap ? 'map' : 'mini';
            const name = isMap ? this.props.scenario.maps[errorId].name : this.props.scenario.minis[errorId].name;
            const metadataId = isMap ? this.props.scenario.maps[errorId].metadata.id : this.props.scenario.minis[errorId].metadata.id;
            return (
                <Modal
                    isOpen={true}
                    className='modalDialog'
                    overlayClassName='overlay'
                >
                    <div>
                        <p>Error loading the image for {mapOrMini} {name} - it may have been deleted from Drive.</p>
                        <p>You can remove {name} (and any other {mapOrMini}s using the same image) from your tabletop,
                            use a different image in its place, or continue on without the image if you think
                            this is a transient error.</p>
                    </div>
                    <div className='modalButtonDiv'>
                        <InputButton type='button' onChange={() => {this.props.dispatch(removeFileAction({id: metadataId}))}}>Remove anything using image</InputButton>
                        <InputButton type='button' onChange={() => {
                            if (isMap) {
                                this.setState({currentPage: VirtualGamingTabletopMode.MAP_SCREEN, replaceMapMetadataId: metadataId});
                            } else {
                                this.setState({currentPage: VirtualGamingTabletopMode.MINIS_SCREEN, replaceMiniMetadataId: metadataId});
                            }
                        }}>Replace with different image</InputButton>
                        <InputButton type='button' onChange={() => {this.props.dispatch(setFileContinueAction(metadataId))}}>Continue without image</InputButton>
                    </div>
                </Modal>
            );
        }
    }

    calculateCameraView(deviceLayout: DeviceLayoutReducerType, connected: ConnectedUserReducerType, myPeerId: string, width: number, height: number): TabletopViewComponentCameraView | undefined {
        const layout = deviceLayout.layout;
        if (!layout[myPeerId]) {
            return undefined;
        }
        const groupId = layout[myPeerId].deviceGroupId;
        const myX = layout[myPeerId].x;
        const myY = layout[myPeerId].y;
        let minX = myX, maxX = myX + width;
        let minY = myY, maxY = myY + height;
        Object.keys(layout).forEach((peerId) => {
            if (layout[peerId].deviceGroupId === groupId && connected[peerId]) {
                const {x, y} = layout[peerId];
                const {deviceWidth, deviceHeight} = connected[peerId];
                if (minX > x) {
                    minX = x;
                }
                if (maxX < x + deviceWidth) {
                    maxX = x + deviceWidth;
                }
                if (minY > y) {
                    minY = y;
                }
                if (maxY < y + deviceHeight) {
                    maxY = y + deviceHeight;
                }
            }
        });
        return {
            fullWidth: maxX - minX,
            fullHeight: maxY - minY,
            offsetX: myX - minX,
            offsetY: myY - minY,
            width,
            height
        };
    }

    renderControlPanelAndMap() {
        return (
            <div className='controlFrame'>
                {this.renderMenuButton()}
                {this.renderMenu()}
                {this.renderAvatars()}
                {this.renderFileErrorModal()}
                <div className='mainArea'>
                    <TabletopViewComponent
                        scenario={this.props.scenario}
                        tabletop={this.props.tabletop}
                        fullDriveMetadata={this.props.files.driveMetadata}
                        dispatch={this.props.dispatch}
                        cameraPosition={this.state.cameraPosition}
                        cameraLookAt={this.state.cameraLookAt}
                        setCamera={this.setCameraParameters}
                        focusMapId={this.state.focusMapId}
                        setFocusMapId={this.setFocusMapId}
                        readOnly={!this.state.gmConnected}
                        disableTapMenu={!this.state.gmConnected}
                        fogOfWarMode={this.state.fogOfWarMode}
                        endFogOfWarMode={() => {
                            this.setState({fogOfWarMode: false});
                        }}
                        snapToGrid={this.props.scenario.snapToGrid}
                        userIsGM={this.loggedInUserIsGM()}
                        playerView={this.state.playerView}
                        labelSize={this.state.labelSize}
                        findPositionForNewMini={this.findPositionForNewMini}
                        findUnusedMiniName={this.findUnusedMiniName}
                        myPeerId={this.props.myPeerId}
                        cameraView={this.calculateCameraView(this.props.deviceLayout, this.props.connectedUsers, this.props.myPeerId!, this.props.width, this.props.height)}
                        replaceMapImageFn={(metadataId) => {this.setState({currentPage: VirtualGamingTabletopMode.MAP_SCREEN, replaceMapImageId: metadataId})}}
                    />
                </div>
                <ToastContainer className='toastContainer' position={toast.POSITION.BOTTOM_CENTER}/>
            </div>
        );
    }

    renderMapScreen() {
        const hasNoAppProperties = (metadata: DriveMetadata<MapAppProperties>) => (!metadata.appProperties || !(metadata.appProperties as any).width);
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_MAP}
                folderStack={this.state.folderStacks[constants.FOLDER_MAP]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: hasNoAppProperties,
                        onClick: (metadata: DriveMetadata<MapAppProperties>) => {
                            if (this.state.replaceMapMetadataId) {
                                const gmOnly = Object.keys(this.props.scenario.maps)
                                    .filter((mapId) => (this.props.scenario.maps[mapId].metadata.id === this.state.replaceMapMetadataId))
                                    .reduce((gmOnly, mapId) => (gmOnly && this.props.scenario.maps[mapId].gmOnly), true);
                                this.props.dispatch(replaceMetadataAction(this.state.replaceMapMetadataId, metadata.id, gmOnly));
                                this.setState({
                                    replaceMapMetadataId: undefined,
                                    currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP
                                })
                            } else if (this.state.replaceMapImageId) {
                                const gmOnly = this.props.scenario.maps[this.state.replaceMapImageId].gmOnly;
                                this.props.dispatch(replaceMapImageAction(this.state.replaceMapImageId, metadata.id, gmOnly));
                                this.setState({
                                    replaceMapImageId: undefined,
                                    currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP
                                })
                            } else {
                                const {name} = splitFileName(metadata.name);
                                const position = vector3ToObject(this.findPositionForNewMap(metadata.appProperties));
                                const gmOnly = (this.loggedInUserIsGM() && metadata.appProperties.gridColour === constants.GRID_NONE && !this.state.playerView);
                                const addMap = addMapAction({metadata, name, gmOnly, position});
                                this.props.dispatch(addMap);
                                this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP}, () => {
                                    this.setFocusMapId(addMap.mapId);
                                });
                            }
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Delete', onClick: 'delete'}
                ]}
                fileIsNew={hasNoAppProperties}
                editorComponent={MapEditor}
                screenInfo={this.state.replaceMapImageId ? (
                    <div className='browseFilesScreenInfo'>
                        <p>
                            Upload or Pick the new map whose image will replace map
                            "{this.props.scenario.maps[this.state.replaceMapImageId].name}" on the tabletop.  The new image
                            may be a different resolution to {this.props.scenario.maps[this.state.replaceMapImageId].name},
                            but to ensure Fog of War lines up correctly, make sure you have defined a grid that is the same
                            number of tiles wide and high.  Be especially careful that any thin slivers of tiles at the
                            edges of the old map's grid are also present on the new map's grid.
                        </p>
                        <p>
                            Your map's Fog of War data will not change unless you explicitly cover or uncover any tiles,
                            so if the fog does not align correctly with the new image, you can edit the new map's grid to
                            attempt to fix things, or even revert back to the original map image, without losing anything.
                        </p>
                    </div>
                ) : this.state.replaceMapMetadataId ? (
                    <p>
                        Upload or Pick the new map to use.
                    </p>
                ) : undefined}
            />
        );
    }

    renderMinisScreen() {
        const hasNoAppData = (metadata: DriveMetadata<MiniAppProperties>) => (!metadata.appProperties || !metadata.appProperties.width);
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_MINI}
                folderStack={this.state.folderStacks[constants.FOLDER_MINI]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: hasNoAppData,
                        onClick: (miniMetadata: DriveMetadata<MiniAppProperties>) => {
                            if (this.state.replaceMiniMetadataId) {
                                const gmOnly = Object.keys(this.props.scenario.minis).reduce((gmOnly, miniId) => (gmOnly && this.props.scenario.minis[miniId].gmOnly), true);
                                this.props.dispatch(replaceMetadataAction(this.state.replaceMiniMetadataId, miniMetadata.id, gmOnly));
                                this.setState({replaceMiniMetadataId: undefined, currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP})
                            } else {
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
                                    this.props.dispatch(addMiniAction({
                                        metadata: miniMetadata, name, gmOnly: this.loggedInUserIsGM() && !this.state.playerView, position, movementPath: this.props.scenario.confirmMoves ? [position] : undefined
                                    }));
                                    this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                                }
                            }
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Delete', onClick: 'delete'}
                ]}
                fileIsNew={hasNoAppData}
                editorComponent={MiniEditor}
                screenInfo={this.state.replaceMiniMetadataId ? (
                    <div className='browseFilesScreenInfo'>
                        Upload or Pick the new mini to use.
                    </div>
                ) : undefined}
            />
        );
    }

    renderTemplatesScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_TEMPLATE}
                folderStack={this.state.folderStacks[constants.FOLDER_TEMPLATE]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                customLabel='Add Template'
                onCustomAction={(parents) => (
                    this.context.fileAPI
                        .saveJsonToFile({
                            name: 'New Template',
                            parents
                        }, {})
                        .then((metadata) => (
                            this.context.fileAPI.makeFileReadableToAll(metadata))
                            .then(() => (metadata))
                        )
                )}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: (metadata: DriveMetadata<TemplateAppProperties>) => (!metadata.appProperties || !metadata.appProperties.templateShape),
                        onClick: (templateMetadata: DriveMetadata<TemplateAppProperties>) => {
                            const position = this.findPositionForNewMini();
                            this.props.dispatch(addMiniAction({
                                metadata: templateMetadata, name: templateMetadata.name, gmOnly: this.loggedInUserIsGM() && !this.state.playerView, position
                            }));
                            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Delete', onClick: 'delete'}
                ]}
                editorComponent={TemplateEditor}
                jsonIcon={(metadata: DriveMetadata<TemplateAppProperties>) => {
                    if (metadata.appProperties) {
                        const appProperties = castTemplateAppProperties(metadata.appProperties);
                        const colour = ('000000' + appProperties.colour.toString(16)).slice(-6);
                        return (appProperties.templateShape === TemplateShape.RECTANGLE) ? (
                            <div className='rectangleTemplateIcon' style={{backgroundColor: '#' + colour}}/>
                        ) : (
                            <div className='material-icons' style={{color: '#' + colour}}>{VirtualGamingTabletop.templateIcon[appProperties.templateShape]}</div>
                        );
                    } else {
                        return (<div className='material-icons'>fiber_new</div>);
                    }
                }}
            />
        );
    }

    private async createNewTabletop(parents: string[], name = 'New Tabletop', scenario = this.emptyScenario) {
        // Create both the private file in the GM Data folder, and the new shared tabletop file
        const newTabletop = {
            ...this.emptyTabletop,
            gmSecret: randomBytes(48).toString('hex'),
            ...scenario
        };
        const privateMetadata = await this.context.fileAPI.saveJsonToFile({name, parents: [this.props.files.roots[constants.FOLDER_GM_DATA]]}, newTabletop);
        const publicMetadata = await this.context.fileAPI.saveJsonToFile({name, parents, appProperties: {gmFile: privateMetadata.id}}, {...newTabletop, gmSecret: undefined});
        await this.context.fileAPI.makeFileReadableToAll(publicMetadata);
        return publicMetadata;
    }

    renderTabletopsScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_TABLETOP}
                folderStack={this.state.folderStacks[constants.FOLDER_TABLETOP]}
                setFolderStack={this.setFolderStack}
                highlightMetadataId={this.props.tabletopId}
                onBack={this.props.tabletopId ? this.onBack : undefined}
                customLabel='Add Tabletop'
                onCustomAction={(parents) => (this.createNewTabletop(parents))}
                fileActions={[
                    {
                        label: 'Pick',
                        onClick: (tabletopMetadata) => {
                            if (!this.props.tabletopId) {
                                this.props.dispatch(setTabletopIdAction(tabletopMetadata.id));
                            } else if (this.props.tabletopId !== tabletopMetadata.id) {
                                // pop out a new window/tab with the new tabletop
                                const newWindow = window.open(tabletopMetadata.id, '_blank');
                                newWindow && newWindow.focus();
                            }
                            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                            return true;
                        }
                    },
                    {
                        label: 'Copy URL',
                        onClick: (metadata) => {
                            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP}, () => {
                                this.copyURLToClipboard(metadata.id);
                                const name = metadata.name + (metadata.name.endsWith('abletop') ? '' : ' Tabletop');
                                toast(name + ' URL copied to clipboard.');
                            });
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Delete', onClick: 'delete'}
                ]}
                editorComponent={TabletopEditor}
                screenInfo={
                    <div className='browseFilesScreenInfo'>
                        <p>A Tabletop is a shared space that you and your players can view - everyone connected to
                            the same tabletop sees the same map and miniatures (although you as the GM may see
                            additional, hidden items).</p>
                        <p>You might want to create a Tabletop for each campaign that you GM, plus perhaps a
                            personal "working tabletop" where you can prepare scenarios out of sight of your
                            players.</p>
                    </div>
                }
                jsonIcon='cloud'
            />
        );
    }

    renderScenariosScreen() {
        return VirtualGamingTabletop.isCurrentUserPlayer(this) ? null : (
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
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: () => (!this.state.gmConnected),
                        onClick: (scenarioMetadata) => {
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
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Delete', onClick: 'delete'}
                ]}
                editorComponent={ScenarioFileEditor}
                screenInfo={(folder: string, children: string[], loading: boolean) => {
                    const createTutorialButton = !loading && folder === this.props.files.roots[constants.FOLDER_SCENARIO]
                        && children.reduce((result, fileId) => (result && this.props.files.driveMetadata[fileId].name !== 'Tutorial Scenario'), true);
                    return (
                        <div>
                            <p>Scenarios are used to save and restore tabletop layouts.  After you have set up the maps and
                            miniatures to your satisfaction in a tabletop, save them as a scenario here to preserve your
                            work and to move them between tabletops.  Pick a scenario to load it again into the current
                            tabletop, replacing that tabletop's contents.</p>
                            {
                                !createTutorialButton ? null : (
                                    <InputButton type='button' onChange={() => (this.createTutorial(false))}>
                                        Create Tutorial Scenario
                                    </InputButton>
                                )
                            }
                        </div>
                    );
                }}
                jsonIcon='photo'
            />
        );
    }

    renderBundlesScreen() {
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_BUNDLE}
                folderStack={this.state.folderStacks[constants.FOLDER_BUNDLE]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                customLabel='Add bundle'
                onCustomAction={(parents) => (
                    this.context.fileAPI.saveJsonToFile({name: 'New Bundle', parents}, {})
                        .then((metadata) => (
                            this.context.fileAPI.makeFileReadableToAll(metadata)
                                .then(() => (metadata))
                        ))
                )}
                fileActions={[
                    {
                        label: 'Copy URL',
                        onClick: (metadata) => {
                            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP}, () => {
                                this.copyURLToClipboard(metadata.id);
                                toast('Bundle URL copied to clipboard.');
                            });
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Delete', onClick: 'delete'}
                ]}
                editorComponent={BundleFileEditor}
                jsonIcon='photo_library'
                screenInfo={
                    <div className='browseFilesScreenInfo'>
                        <p>Bundles are used to create "content packs" for gTove, allowing you to transfer gTove objects
                            to other users.  You select some of your maps, minis and scenarios to add to the bundle, and
                            gTove will assign the bundle a unique URL.  When another GM accesses a bundle URL, shortcuts
                            to the contents of the bundle in your Drive will be created in their Drive, ready for them
                            to use in gTove.</p>
                        <p>Note that you do not need to define bundles to share a tabletop and its contents with your
                        players.  Bundles are only needed if you want to share content with other GMs.</p>
                        <p>Please ensure you respect the copyright of any images you share using bundles.</p>
                    </div>
                }
            />
        );
    }

    renderWorkingScreen() {
        return (
            <div className='workingScreen'>
                {
                    this.state.workingMessages.map((message, index) => (
                        <div key={index}>{message}</div>
                    ))
                }
                <div>
                    {
                        Object.keys(this.state.workingButtons).map((label, index) => (
                            <InputButton type='button' key={index} onChange={this.state.workingButtons[label]}>
                                {label}
                            </InputButton>
                        ))
                    }
                </div>
            </div>
        )
    }

    renderDeviceLayoutScreen() {
        return (
            <DeviceLayoutComponent
                onFinish={() => {this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP})}}
                cameraPosition={this.state.cameraPosition}
                cameraLookAt={this.state.cameraLookAt}
                focusMapId={this.state.focusMapId}
            />
        );
    }


    renderContent() {
        if (this.state.loading) {
            return (
                <div>
                    Waiting on Google Drive{this.state.loading}
                </div>
            );
        }
        switch (this.state.currentPage) {
            case VirtualGamingTabletopMode.GAMING_TABLETOP:
                return this.renderControlPanelAndMap();
            case VirtualGamingTabletopMode.MAP_SCREEN:
                return this.renderMapScreen();
            case VirtualGamingTabletopMode.MINIS_SCREEN:
                return this.renderMinisScreen();
            case VirtualGamingTabletopMode.TEMPLATES_SCREEN:
                return this.renderTemplatesScreen();
            case VirtualGamingTabletopMode.TABLETOP_SCREEN:
                return this.renderTabletopsScreen();
            case VirtualGamingTabletopMode.SCENARIOS_SCREEN:
                return this.renderScenariosScreen();
            case VirtualGamingTabletopMode.BUNDLES_SCREEN:
                return this.renderBundlesScreen();
            case VirtualGamingTabletopMode.WORKING_SCREEN:
                return this.renderWorkingScreen();
            case VirtualGamingTabletopMode.DEVICE_LAYOUT_SCREEN:
                return this.renderDeviceLayoutScreen();
        }
    }

    render() {
        return (
            <FullScreen enabled={this.state.fullScreen} onChange={(fullScreen) => {this.setState({fullScreen})}}>
                {this.renderContent()}
            </FullScreen>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store),
        tabletop: getTabletopFromStore(store),
        scenario: getScenarioFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store),
        connectedUsers: getConnectedUsersFromStore(store),
        myPeerId: getMyPeerIdFromStore(store),
        tabletopValidation: getTabletopValidationFromStore(store),
        createInitialStructure: getCreateInitialStructureFromStore(store),
        deviceLayout: getDeviceLayoutFromStore(store)
    }
}

export default withResizeDetector(connect(mapStoreToProps)(VirtualGamingTabletop));