import * as React from 'react';
import * as PropTypes from 'prop-types';
import classNames from 'classnames';
import {connect} from 'react-redux';
import {AnyAction, Dispatch} from 'redux';
import {isEqual, isObject, throttle} from 'lodash';
import {toast, ToastContainer} from 'react-toastify';
import * as THREE from 'three';
import {randomBytes} from 'crypto';
import Modal from 'react-modal';
import copyToClipboard from 'copy-to-clipboard';
import memoizeOne from 'memoize-one';
import FullScreen from 'react-full-screen';
import {withResizeDetector} from 'react-resize-detector';
import {v4} from 'uuid';

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
    setScenarioLocalAction,
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
    getDebugLogFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    getTabletopValidationFromStore,
    getWindowTitleFromStore,
    ReduxStoreType
} from '../redux/mainReducer';
import {
    cartesianToHexCoords,
    DistanceMode,
    DistanceRound,
    effectiveHexGridType,
    jsonToScenarioAndTabletop,
    MapType,
    MovementPathPoint,
    ObjectVector3,
    scenarioToJson,
    ScenarioType,
    snapMap,
    TabletopType
} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {
    castMapAppProperties,
    castTemplateAppProperties,
    DriveMetadata,
    GridType,
    isMiniAppProperties,
    MapAppProperties,
    MiniAppProperties,
    TabletopFileAppProperties,
    TemplateAppProperties,
    TemplateShape
} from '../util/googleDriveUtils';
import {LoggedInUserReducerType} from '../redux/loggedInUserReducer';
import {
    ConnectedUserReducerType,
    ConnectedUserUsersType,
    ignoreConnectedUserVersionMismatchAction,
    updateConnectedUserDeviceAction
} from '../redux/connectedUserReducer';
import {FileAPI, FileAPIContext, splitFileName} from '../util/fileUtils';
import {buildVector3, vector3ToObject} from '../util/threeUtils';
import {PromiseModalContext} from '../container/authenticatedContainer';
import {setLastSavedScenarioAction, TabletopValidationType} from '../redux/tabletopValidationReducer';
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
    updateGroupCameraAction,
    updateGroupCameraFocusMapIdAction
} from '../redux/deviceLayoutReducer';
import Spinner from './spinner';
import {appVersion} from '../util/appVersion';
import DebugLogComponent from './debugLogComponent';
import {DebugLogReducerType, enableDebugLogAction} from '../redux/debugLogReducer';
import {WINDOW_TITLE_DEFAULT} from '../redux/windowTitleReducer';
import {isCloseTo} from '../util/mathsUtils';

import './virtualGamingTabletop.scss';

interface VirtualGamingTabletopProps {
    files: FileIndexReducerType;
    tabletopId: string;
    windowTitle: string;
    scenario: ScenarioType;
    tabletop: TabletopType;
    loggedInUser: LoggedInUserReducerType;
    connectedUsers: ConnectedUserReducerType;
    tabletopValidation: TabletopValidationType;
    myPeerId: MyPeerIdReducerType;
    dispatch: Dispatch<AnyAction, ReduxStoreType>;
    createInitialStructure: CreateInitialStructureReducerType;
    deviceLayout: DeviceLayoutReducerType;
    debugLog: DebugLogReducerType;
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
    toastIds: {[message: string]: number};
    focusMapId?: string;
    folderStacks: {[root: string]: string[]};
    labelSize: number;
    workingMessages: string[];
    workingButtons: {[key: string]: () => void};
    savingTabletop: number;
}

type MiniSpace = ObjectVector3 & {scale: number};

enum VirtualGamingTabletopMode {
    GAMING_TABLETOP,
    MAP_SCREEN,
    MINIS_SCREEN,
    TEMPLATES_SCREEN,
    TABLETOP_SCREEN,
    SCENARIOS_SCREEN,
    BUNDLES_SCREEN,
    WORKING_SCREEN,
    DEVICE_LAYOUT_SCREEN,
    DEBUG_LOG_SCREEN
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

    static hexHorizontalGridPath = [
        {dx: 1, dy: 0},
        {dx: 0.5, dy: 1.5 * constants.INV_SQRT3},
        {dx: -0.5, dy: 1.5 * constants.INV_SQRT3},
        {dx: -1, dy: 0},
        {dx: -0.5, dy: -1.5 * constants.INV_SQRT3},
        {dx: 0.5, dy: -1.5 * constants.INV_SQRT3}
    ];

    static hexVerticalGridPath = [
        {dx: 1.5 * constants.INV_SQRT3, dy: 0.5},
        {dx: 0, dy: 1},
        {dx: -1.5 * constants.INV_SQRT3, dy: 0.5},
        {dx: -1.5 * constants.INV_SQRT3, dy: -0.5},
        {dx: 0, dy: -1},
        {dx: 1.5 * constants.INV_SQRT3, dy: -0.5}
    ];

    context: FileAPIContext & PromiseModalContext;

    private readonly emptyScenario: ScenarioType;
    private readonly emptyTabletop: ScenarioType & TabletopType;

    constructor(props: VirtualGamingTabletopProps) {
        super(props);
        this.onBack = this.onBack.bind(this);
        this.setFocusMapId = this.setFocusMapId.bind(this);
        this.setCameraParameters = this.setCameraParameters.bind(this);
        this.saveTabletopToDrive = throttle(this.saveTabletopToDrive.bind(this), VirtualGamingTabletop.SAVE_FREQUENCY_MS, {leading: false});
        this.setFolderStack = this.setFolderStack.bind(this);
        this.findPositionForNewMini = this.findPositionForNewMini.bind(this);
        this.findUnusedMiniName = this.findUnusedMiniName.bind(this);
        this.endFogOfWarMode = this.endFogOfWarMode.bind(this);
        this.replaceMapImage = this.replaceMapImage.bind(this);
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
            toastIds: {},
            ...this.getDefaultCameraFocus(props),
            folderStacks: [constants.FOLDER_TABLETOP, constants.FOLDER_MAP, constants.FOLDER_MINI, constants.FOLDER_TEMPLATE, constants.FOLDER_SCENARIO, constants.FOLDER_BUNDLE]
                .reduce((result, root) => ({...result, [root]: [props.files.roots[root]]}), {}),
            labelSize: 0.4,
            workingMessages: [],
            workingButtons: {},
            savingTabletop: 0
        };
        this.emptyScenario = settableScenarioReducer(undefined as any, {type: '@@init'});
        this.emptyTabletop = {
            ...this.emptyScenario,
            gm: props.loggedInUser!.emailAddress,
            gmSecret: null,
            defaultGrid: GridType.SQUARE,
            distanceMode: DistanceMode.STRAIGHT,
            distanceRound: DistanceRound.ROUND_OFF,
            commsStyle: CommsStyle.PeerToPeer,
            headActionIds: [],
            playerHeadActionIds: []
        };
    }

    isGMConnected(props: VirtualGamingTabletopProps) {
        // If I own the tabletop, then the GM is connected by definition.  Otherwise, check connectedUsers.
        return !props.tabletop || !props.tabletop.gm ||
            (props.loggedInUser && props.loggedInUser.emailAddress === props.tabletop.gm) ||
            Object.keys(props.connectedUsers.users).reduce<boolean>((result, peerId) => (
                result || props.connectedUsers.users[peerId].user.emailAddress === props.tabletop.gm
            ), false);
    }

    private async loadPublicPrivateJson(metadataId: string): Promise<(ScenarioType & TabletopType) | BundleType> {
        const fileAPI: FileAPI = this.context.fileAPI;
        let loadedJson = await fileAPI.getJsonFileContents({id: metadataId});
        if (loadedJson.gm && loadedJson.gm === this.props.loggedInUser!.emailAddress) {
            let metadata = this.props.files.driveMetadata[metadataId] as DriveMetadata<TabletopFileAppProperties>;
            if (!metadata) {
                metadata = await fileAPI.getFullMetadata(metadataId) as DriveMetadata<TabletopFileAppProperties>;
                this.props.dispatch(addFilesAction([metadata]));
            }
            const privateJson = await fileAPI.getJsonFileContents({id: metadata.appProperties!.gmFile});
            loadedJson = {...loadedJson, ...privateJson};
        }
        return loadedJson;
    }

    deepEqualWithMetadata(o1: object, o2: object): boolean {
        return Object.keys(o1).reduce<boolean>((result, key) => (
            result && ((!o1 || !o2) ? o1 === o2 :
                (isObject(o1[key]) && isObject(o2[key])) ? (
                    (key === 'metadata') ? o1[key].id === o2[key].id : this.deepEqualWithMetadata(o1[key], o2[key])
                ) : (
                    o1[key] === o2[key]
                ))
        ), true);
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
                await this.context.fileAPI.createShortcut({...bundleMetadata, appProperties: {...bundleMetadata.appProperties, fromBundleId}}, [folder.id]);
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
        try {
            const json = metadataId ? await this.loadPublicPrivateJson(metadataId) : this.emptyTabletop;
            if (isBundle(json)) {
                await this.extractBundle(json, metadataId);
            } else {
                const [loadedScenario, loadedTabletop] = jsonToScenarioAndTabletop(json, this.props.files.driveMetadata);
                this.props.dispatch(setTabletopAction(loadedTabletop));
                this.props.dispatch(setScenarioLocalAction(loadedScenario));
                if (metadataId && this.props.windowTitle === WINDOW_TITLE_DEFAULT) {
                    const metadata = this.props.files.driveMetadata[metadataId] || await this.context.fileAPI.getFullMetadata(metadataId);
                    this.props.dispatch(setTabletopIdAction(metadataId, metadata.name));
                }
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
            this.props.dispatch(setTabletopIdAction(publicTabletopMetadata.id, publicTabletopMetadata.name));
            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
        }
        this.setState({loading: ''});
    }

    async componentDidMount() {
        await this.loadTabletopFromDrive(this.props.tabletopId);
        const queryParameters = new URLSearchParams(window.location.search);
        if (queryParameters.get('debug')) {
            this.props.dispatch(enableDebugLogAction(true));
        }
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
        this.checkVersions();
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

    async checkVersions() {
        const myClientOutdated = Object.keys(this.props.connectedUsers.users).reduce<boolean>((outdated, peerId) => {
            const user = this.props.connectedUsers.users[peerId];
            return outdated
                || (user.version !== undefined && !user.ignoreVersionMismatch
                    && appVersion.hash !== user.version.hash && appVersion.numCommits < user.version.numCommits);
        }, false);
        if (myClientOutdated) {
            const reload = 'Load latest version';
            const response = this.context.promiseModal && await this.context.promiseModal({
                children: 'You are running an outdated version of gTove!  This may cause problems.',
                options: [reload, 'Ignore']
            });
            if (response === reload) {
                window.location.reload(true);
            } else {
                Object.keys(this.props.connectedUsers.users).forEach((peerId) => {
                    this.props.dispatch(ignoreConnectedUserVersionMismatchAction(peerId));
                });
            }
        }
    }

    saveTabletopToDrive(metadataId: string, scenarioState: ScenarioType): void {
        // Only save the scenario data if we own this tabletop
        const driveMetadata = metadataId && this.props.files.driveMetadata[metadataId] as DriveMetadata<TabletopFileAppProperties>;
        if (this.loggedInUserIsGM() && driveMetadata && driveMetadata.appProperties) {
            this.setState((state) => ({savingTabletop: state.savingTabletop + 1}), async () => {
                const [privateScenario, publicScenario] = scenarioToJson(scenarioState);
                try {
                    await this.context.fileAPI.saveJsonToFile(metadataId, {...publicScenario, ...this.props.tabletop, gmSecret: undefined});
                    await this.context.fileAPI.saveJsonToFile(driveMetadata.appProperties.gmFile, {...privateScenario, ...this.props.tabletop});
                    this.props.dispatch(setLastSavedScenarioAction(scenarioState));
                } catch (err) {
                    if (this.props.loggedInUser) {
                        throw err;
                    }
                    // Else we've logged out in the mean time, so we expect the upload to fail.
                } finally {
                    this.setState((state) => ({savingTabletop: state.savingTabletop - 1}));
                }
            });

        }
    }

    private updatePersistentToast(enable: boolean, message: string) {
        if (enable) {
            if (!this.state.toastIds[message]) {
                this.setState((prevState: VirtualGamingTabletopState) => (
                    prevState.toastIds[message] ? null : ({
                        toastIds: {...prevState.toastIds, [message]: toast(message, {autoClose: false})}
                    })
                ));
            }
        } else if (this.state.toastIds[message]) {
            toast.dismiss(this.state.toastIds[message]);
            let toastIds = {...this.state.toastIds};
            delete(toastIds[message]);
            this.setState({toastIds});
        }
    }

    async componentWillReceiveProps(props: VirtualGamingTabletopProps) {
        const {lastSavedScenario, lastCommonScenario} = props.tabletopValidation;
        if (!props.tabletopId) {
            this.setState({currentPage: VirtualGamingTabletopMode.TABLETOP_SCREEN});
        } else if (props.tabletopId !== this.props.tabletopId) {
            await this.loadTabletopFromDrive(props.tabletopId);
        } else if (lastSavedScenario && lastCommonScenario
                && lastSavedScenario.headActionIds !== lastCommonScenario.headActionIds) {
            this.saveTabletopToDrive(props.tabletopId, lastCommonScenario);
        }
        this.setState({gmConnected: this.isGMConnected(props)}, () => {
            this.updatePersistentToast(!this.state.gmConnected, 'View-only mode - no GM is connected.');
        });
        this.updatePersistentToast(props.tabletopValidation.pendingActions.length > 0,
            'Missing actions detected - attempting to re-synchronize.');
        this.updatePersistentToast(props.connectedUsers.signalError,
            'Signal server not reachable - new clients cannot connect.');
        if (!this.state.focusMapId || !props.scenario.maps[this.state.focusMapId]) {
            // Focus on the map closest to y=0 by default;
            let smallestDelta: number | undefined = undefined;
            const focusMapId = Object.keys(props.scenario.maps).reduce<string | undefined>((focusMapId, mapId) => {
                const delta = Math.abs(props.scenario.maps[mapId].position.y);
                if (smallestDelta === undefined || delta < smallestDelta) {
                    smallestDelta = delta;
                    return mapId;
                } else {
                    return focusMapId;
                }
            }, undefined);
            if (focusMapId !== this.state.focusMapId) {
                this.setFocusMapId(focusMapId, !props.scenario.startCameraAtOrigin, props);
            }
        }
        if (props.width !== this.props.width || props.height !== this.props.height) {
            this.props.dispatch(updateConnectedUserDeviceAction(this.props.myPeerId!, props.width, props.height));
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
        return !map ? true : Object.keys(maps).reduce<boolean>((highest, otherMapId) => {
            const otherMap = maps[otherMapId];
            return highest && (mapId === otherMapId || otherMap.position.y <= map.position.y + SAME_LEVEL_MAP_DELTA_Y)
        }, true);
    }

    isMapLowest(maps: {[key: string]: MapType}, mapId?: string): boolean {
        const map = mapId ? maps[mapId] : undefined;
        return !map ? true : Object.keys(maps).reduce<boolean>((lowest, otherMapId) => {
            const otherMap = maps[otherMapId];
            return lowest && (mapId === otherMapId || otherMap.position.y > map.position.y - SAME_LEVEL_MAP_DELTA_Y)
        }, true);
    }

    setFocusMapId(focusMapId: string | undefined, moveCamera: boolean = true, props = this.props) {
        const map = focusMapId ? props.scenario.maps[focusMapId] : undefined;
        if (focusMapId && moveCamera) {
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

    private getMapIdAtPoint(point: THREE.Vector3 | ObjectVector3): string | undefined {
        return Object.keys(this.props.scenario.maps).reduce<string | undefined>((touching, mapId) => {
            const map = this.props.scenario.maps[mapId];
            if (touching || !isCloseTo(point.y, map.position.y)) {
                return touching;
            }
            const width = Number(map.metadata.appProperties.width);
            const height = Number(map.metadata.appProperties.height);
            const cos = Math.cos(map.rotation.y);
            const sin = Math.sin(map.rotation.y);
            const dx = point.x - map.position.x;
            const dz = point.z - map.position.z;
            const effectiveX = dx * cos - dz * sin;
            const effectiveZ = dz * cos + dx * sin;
            return (effectiveX >= -width / 2 && effectiveX < width / 2
                && effectiveZ >= -height / 2 && effectiveZ < height / 2) ? mapId : touching
        }, undefined);
    }

    private adjustMapPositionToNotCollide(position: THREE.Vector3, appProperties: MapAppProperties, performAdjust: boolean): boolean {
        // TODO this doesn't account for map rotation.
        let adjusted = false;
        Object.keys(this.props.scenario.maps).forEach((mapId) => {
            const map = this.props.scenario.maps[mapId];
            const mapWidth = Number(map.metadata.appProperties.width);
            const mapHeight = Number(map.metadata.appProperties.height);
            if (isCloseTo(position.y, map.position.y)
                && position.x + appProperties.width / 2 >= map.position.x - mapWidth / 2 && position.x - appProperties.width / 2 < map.position.x + mapWidth / 2
                && position.z + appProperties.height / 2 >= map.position.z - mapHeight / 2 && position.z - appProperties.height / 2 < map.position.z + mapHeight / 2) {
                adjusted = true;
                if (performAdjust) {
                    const delta = position.clone().sub(map.position as THREE.Vector3);
                    const quadrant14 = (delta.x - delta.z > 0);
                    const quadrant12 = (delta.x + delta.z > 0);
                    if (quadrant12 && quadrant14) {
                        position.x = map.position.x + VirtualGamingTabletop.MAP_EPSILON + (mapWidth + appProperties.width) / 2;
                    } else if (quadrant12) {
                        position.z = map.position.z + VirtualGamingTabletop.MAP_EPSILON + (mapHeight + appProperties.height) / 2;
                    } else if (quadrant14) {
                        position.z = map.position.z - VirtualGamingTabletop.MAP_EPSILON - (mapHeight + appProperties.height) / 2;
                    } else {
                        position.x = map.position.x - VirtualGamingTabletop.MAP_EPSILON - (mapWidth + appProperties.width) / 2;
                    }
                    snapMap(true, appProperties, position);
                }
            }
        });
        return adjusted;
    }

    findPositionForNewMap(rawAppProperties: MapAppProperties, position = this.state.cameraLookAt): THREE.Vector3 {
        const appProperties = castMapAppProperties(rawAppProperties) || {};
        appProperties.width = appProperties.width || 10;
        appProperties.height = appProperties.height || 10;
        const {positionObj} = snapMap(true, appProperties, position);
        while (true) {
            const search = buildVector3(positionObj);
            if (this.getMapIdAtPoint(search) === undefined) {
                // Attempt to find free space for the map at current elevation.
                this.adjustMapPositionToNotCollide(search, appProperties, true);
                if (!this.adjustMapPositionToNotCollide(search, appProperties, false)) {
                    return search;
                }
            }
            // Try to fit the map at a higher elevation
            positionObj.y += VirtualGamingTabletop.NEW_MAP_DELTA_Y;
        }
    }

    private doesPositionCollideWithSpace(x: number, y: number, z: number, scale: number, space: MiniSpace[]): boolean {
        return space.reduce<boolean>((collide, space) => {
            if (collide) {
                return true;
            } else {
                const distance2 = (x - space.x) * (x - space.x)
                    + (y - space.y) * (y - space.y)
                    + (z - space.z) * (z - space.z);
                const minDistance = (scale + space.scale)/2 - 0.1;
                return (distance2 < minDistance * minDistance);
            }
        }, false);
    }

    *spiralSquareGridGenerator(): IterableIterator<{x: number, y: number}> {
        let horizontal = true, step = 1, delta = 1, x = 0, y = 0;
        while (true) {
            if (horizontal) {
                x += delta;
                if (2 * x * delta >= step) {
                    horizontal = false;
                }
            } else {
                y += delta;
                if (2 * y * delta >= step) {
                    horizontal = true;
                    delta = -delta;
                    step++;
                }
            }
            yield {x, y};
        }
    }

    *spiralHexGridGenerator(gridType: GridType.HEX_HORZ | GridType.HEX_VERT):  IterableIterator<{x: number, y: number}> {
        const path = (gridType === GridType.HEX_HORZ) ? VirtualGamingTabletop.hexHorizontalGridPath : VirtualGamingTabletop.hexVerticalGridPath;
        let x = 0, y = 0, sideLength = 1, direction = 0;
        while (true) {
            // The side length of the 2nd direction in the sequence needs to be one less, to make the circular sequence
            // into a spiral around the centre.
            const {dx, dy} = path[direction];
            for (let step = (direction === 1) ? 1 : 0; step < sideLength; ++step) {
                x += dx;
                y += dy;
                yield {x, y};
            }
            if (++direction >= path.length) {
                direction = 0;
                sideLength++;
            }
        }
    }

    findPositionForNewMini(scale = 1.0, basePosition: THREE.Vector3 | ObjectVector3 = this.state.cameraLookAt, avoid: MiniSpace[] = []): MovementPathPoint {
        // Find the map the mini is being placed on, if any.
        const onMapId = this.getMapIdAtPoint(basePosition);
        // Snap position to the relevant grid.
        const gridType = onMapId ? this.props.scenario.maps[onMapId].metadata.appProperties.gridType : this.props.tabletop.defaultGrid;
        const gridSnap = scale > 1 ? 1 : scale;
        let baseX, baseZ, spiralGenerator;
        switch (gridType) {
            case GridType.HEX_VERT:
            case GridType.HEX_HORZ:
                const mapRotation = onMapId ? this.props.scenario.maps[onMapId].rotation.y : 0;
                const effectiveGridType = effectiveHexGridType(mapRotation, gridType);
                const {strideX, strideY, centreX, centreY} = cartesianToHexCoords(basePosition.x / gridSnap, basePosition.z / gridSnap, effectiveGridType);
                baseX = centreX * strideX * gridSnap;
                baseZ = centreY * strideY * gridSnap;
                spiralGenerator = this.spiralHexGridGenerator(effectiveGridType);
                break;
            default:
                baseX = Math.floor(basePosition.x / gridSnap) * gridSnap + (scale / 2) % 1;
                baseZ = Math.floor(basePosition.z / gridSnap) * gridSnap + (scale / 2) % 1;
                spiralGenerator = this.spiralSquareGridGenerator();
                break;
        }
        // Get a list of occupied spaces with the same Y coordinates as our basePosition
        const occupied: MiniSpace[] = avoid.concat(Object.keys(this.props.scenario.minis)
            .filter((miniId) => (isCloseTo(basePosition.y, this.props.scenario.minis[miniId].position.y)))
            .map((miniId) => ({...this.props.scenario.minis[miniId].position, scale: this.props.scenario.minis[miniId].scale})));
        // Search for free space in a spiral pattern around basePosition.
        let offsetX = 0, offsetZ = 0;
        while (this.doesPositionCollideWithSpace(baseX + offsetX, basePosition.y, baseZ + offsetZ, scale, occupied)) {
            ({x: offsetX, y: offsetZ} = spiralGenerator.next().value);
        }
        return {x: baseX + offsetX, y: basePosition.y, z: baseZ + offsetZ, onMapId};
    }

    findUnusedMiniName(baseName: string, suffix?: number, space = true): [string, number] {
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
        while (true) {
            const name = suffix ? baseName + (space ? ' ' : '') + String(suffix) : baseName;
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
        const location = window.location.href.replace(/[\\/][^/\\]*$/, '/' + suffix);
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
                <InputButton type='button' fillWidth={true} className='scaryButton' onChange={async () => {
                    const yesOption = 'Yes';
                    const response = this.context.promiseModal && await this.context.promiseModal({
                        children: 'Are you sure you want to remove all maps and minis from this tabletop?',
                        options: [yesOption, 'Cancel']
                    });
                    if (response === yesOption) {
                        this.props.dispatch(setScenarioAction({...this.props.scenario, maps: {}, minis: {}}, 'clear'));
                        this.setState({fogOfWarMode: false});
                    }
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

    renderDebugMenu() {
        return !this.props.debugLog.enabled ? null : (
            <InputButton
                type='button'
                fillWidth={true}
                onChange={() => {
                    this.setState({currentPage: VirtualGamingTabletopMode.DEBUG_LOG_SCREEN});
                }}
            >Debug</InputButton>
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
                        {this.renderDebugMenu()}
                    </div>
                </div>
            </div>
        );
    }

    renderAvatars() {
        const connectedUsers = Object.keys(this.props.connectedUsers.users);
        const anyMismatches = connectedUsers.reduce<boolean>((any, peerId) => (any || (
            (this.props.connectedUsers.users[peerId].version === undefined
            || this.props.connectedUsers.users[peerId].version!.hash !== appVersion.hash)
            && !this.props.connectedUsers.users[peerId].ignoreVersionMismatch
        )), false);
        const annotation = anyMismatches ? '!' : (this.state.avatarsOpen || connectedUsers.length === 0) ? undefined : connectedUsers.length;
        return (
            <div>
                <div className='loggedInAvatar' onClick={() => {
                    this.setState({avatarsOpen: !this.state.avatarsOpen})
                }}>
                    <GoogleAvatar user={this.props.loggedInUser!}
                                  annotation={annotation}
                                  annotationClassNames={classNames({mismatch: anyMismatches, gmConnected: this.state.gmConnected})}
                                  annotationTitle={anyMismatches ? 'Different versions of gTove!' : undefined}
                    />
                    {
                        (this.state.savingTabletop > 0) ? (
                            <span className='saving' title='Saving changes to Drive'>
                                <Spinner/>
                            </span>
                        ) : this.loggedInUserIsGM() && this.props.tabletopValidation.lastSavedScenario && this.props.tabletopValidation.lastCommonScenario
                            && this.props.tabletopValidation.lastSavedScenario.headActionIds !== this.props.tabletopValidation.lastCommonScenario.headActionIds ? (
                            <span className='saving' title='Unsaved changes'>
                                <i className='material-icons pending'>sync</i>
                            </span>
                        ) : null
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
                                        const connectedUser = this.props.connectedUsers.users[peerId];
                                        const user = connectedUser.user;
                                        const userIsGM = (user.emailAddress === this.props.tabletop.gm);
                                        const mismatch = connectedUser.version === undefined || connectedUser.version.hash !== appVersion.hash;
                                        return (
                                            <div key={peerId} className={classNames({userIsGM})}>
                                                <GoogleAvatar user={user}
                                                              annotation={mismatch ? '!' : undefined}
                                                              annotationClassNames={classNames({mismatch})}
                                                              annotationTitle={mismatch ? 'Different version of gTove!' : undefined}
                                                />
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
            let errorId = Object.keys(this.props.scenario.maps).reduce<string | false>((errorId, mapId) => (
                errorId || (this.props.scenario.maps[mapId].metadata.name === ERROR_FILE_NAME && mapId)
            ), false);
            if (!errorId) {
                isMap = false;
                errorId = Object.keys(this.props.scenario.minis).reduce<string | false>((errorId, miniId) => (
                    errorId || (this.props.scenario.minis[miniId].metadata.name === ERROR_FILE_NAME && miniId)
                ), false);
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

    calculateCameraView(deviceLayout: DeviceLayoutReducerType, connected: ConnectedUserUsersType, myPeerId: string, width: number, height: number): TabletopViewComponentCameraView | undefined {
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

    endFogOfWarMode() {
        this.setState({fogOfWarMode: false});
    }

    replaceMapImage(replaceMapImageId: string) {
        this.setState({currentPage: VirtualGamingTabletopMode.MAP_SCREEN, replaceMapImageId});
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
                        endFogOfWarMode={this.endFogOfWarMode}
                        snapToGrid={this.props.scenario.snapToGrid}
                        userIsGM={this.loggedInUserIsGM()}
                        playerView={this.state.playerView}
                        labelSize={this.state.labelSize}
                        findPositionForNewMini={this.findPositionForNewMini}
                        findUnusedMiniName={this.findUnusedMiniName}
                        myPeerId={this.props.myPeerId}
                        cameraView={this.calculateCameraView(this.props.deviceLayout, this.props.connectedUsers.users, this.props.myPeerId!, this.props.width, this.props.height)}
                        replaceMapImageFn={this.replaceMapImage}
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
                allowUploadAndWebLink={true}
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
                                const mapId = v4();
                                this.props.dispatch(addMapAction({metadata, name, gmOnly, position}, mapId));
                                this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP}, () => {
                                    this.setFocusMapId(mapId);
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

    private placeMini(miniMetadata: DriveMetadata<MiniAppProperties>, avoid: MiniSpace[] = []): MiniSpace {
        const match = miniMetadata.name.match(/^(.*?) *([0-9]*)(\.[a-zA-Z]*)?$/)!;
        let baseName = match[1], suffixStr = match[2];
        let [name, suffix] = this.findUnusedMiniName(baseName, suffixStr ? Number(suffixStr) : undefined);
        if (suffix === 1 && suffixStr !== '1') {
            // There's a mini with baseName (with no suffix) already on the tabletop.  Rename it.
            const existingMiniId = Object.keys(this.props.scenario.minis).reduce<string | null>((result, miniId) => (
                result || (this.props.scenario.minis[miniId].name === baseName) ? miniId : null
            ), null);
            existingMiniId && this.props.dispatch(updateMiniNameAction(existingMiniId, name));
            name = baseName + ' 2';
        }
        const scale = Number(miniMetadata.appProperties.scale) || 1;
        const position = this.findPositionForNewMini(scale, this.state.cameraLookAt, avoid);
        this.props.dispatch(addMiniAction({
            metadata: miniMetadata,
            name,
            gmOnly: this.loggedInUserIsGM() && !this.state.playerView,
            position,
            movementPath: this.props.scenario.confirmMoves ? [position] : undefined,
            scale
        }));
        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
        return {...position, scale};
    }

    renderMinisScreen() {
        const hasNoAppData = (metadata: DriveMetadata<MiniAppProperties>) => (!metadata.appProperties || !metadata.appProperties.width);
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_MINI}
                folderStack={this.state.folderStacks[constants.FOLDER_MINI]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                allowUploadAndWebLink={true}
                globalActions={[
                    {label: 'Pick All Here', createsFile: false, onClick: async (parents: string[]) => {
                        parents.forEach((folderId) => {
                            let avoid: MiniSpace[] = [];
                            (this.props.files.children[folderId] || []).forEach((fileId) => {
                                const metadata = this.props.files.driveMetadata[fileId];
                                if (isMiniAppProperties(metadata.appProperties)) {
                                    avoid.push(this.placeMini(metadata as DriveMetadata<MiniAppProperties>, avoid));
                                }
                            });
                        });
                        return undefined;
                    }, hidden: this.state.replaceMiniMetadataId !== undefined}
                ]}
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
                                this.placeMini(miniMetadata);
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
                allowUploadAndWebLink={false}
                globalActions={[
                    {label: 'Add Template', createsFile: true, onClick: async (parents: string[]) => {
                        const metadata = await this.context.fileAPI.saveJsonToFile({name: 'New Template',parents}, {});
                        await this.context.fileAPI.makeFileReadableToAll(metadata);
                        return metadata;
                    }}
                ]}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: (metadata: DriveMetadata<TemplateAppProperties>) => (!metadata.appProperties || !metadata.appProperties.templateShape),
                        onClick: (templateMetadata: DriveMetadata<TemplateAppProperties>) => {
                            const position = this.findPositionForNewMini();
                            this.props.dispatch(addMiniAction({
                                metadata: templateMetadata, name: templateMetadata.name, gmOnly: this.loggedInUserIsGM() && !this.state.playerView, position, movementPath: this.props.scenario.confirmMoves ? [position] : undefined
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
        const tabletopName = this.props.tabletopId && this.props.files.driveMetadata[this.props.tabletopId]
            ? this.props.files.driveMetadata[this.props.tabletopId].name : 'current Tabletop';
        const tabletopSuffix = tabletopName.toLowerCase().indexOf('tabletop') >= 0 ? '' : ' Tabletop';
        return (
            <BrowseFilesComponent
                topDirectory={constants.FOLDER_TABLETOP}
                folderStack={this.state.folderStacks[constants.FOLDER_TABLETOP]}
                setFolderStack={this.setFolderStack}
                highlightMetadataId={this.props.tabletopId}
                onBack={this.props.tabletopId ? this.onBack : undefined}
                allowUploadAndWebLink={false}
                globalActions={[
                    {label: 'Add Tabletop', createsFile: true, onClick: async (parents: string[]) => (this.createNewTabletop(parents))},
                    {label: `Bookmark ${tabletopName}${tabletopSuffix}`, createsFile: true, onClick: async (parents: string[]) => {
                        const tabletop = await this.context.fileAPI.getFullMetadata(this.props.tabletopId);
                        return await this.context.fileAPI.createShortcut(tabletop, parents);
                    }, hidden: !this.props.tabletopId || this.loggedInUserIsGM()}
                ]}
                fileActions={[
                    {
                        label: 'Pick',
                        onClick: (tabletopMetadata: DriveMetadata) => {
                            if (!this.props.tabletopId) {
                                this.props.dispatch(setTabletopIdAction(tabletopMetadata.id, tabletopMetadata.name));
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
                        onClick: (metadata: DriveMetadata) => {
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
                allowUploadAndWebLink={false}
                globalActions={[
                    {label: 'Save current tabletop', createsFile: true, onClick: async (parents: string[]) => {
                        const name = 'New Scenario';
                        const [privateScenario] = scenarioToJson(this.props.scenario);
                        return await this.context.fileAPI.saveJsonToFile({name, parents}, privateScenario);
                    }}
                ]}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: () => (!this.state.gmConnected),
                        onClick: (scenarioMetadata: DriveMetadata) => {
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
                                                this.props.dispatch(setScenarioAction(privateScenario, 'gm' + scenarioMetadata.id, true));
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
                allowUploadAndWebLink={false}
                globalActions={[
                    {label: 'Add bundle', createsFile: true, onClick: async (parents: string[]) => {
                        const metadata = await this.context.fileAPI.saveJsonToFile({name: 'New Bundle', parents}, {});
                        await this.context.fileAPI.makeFileReadableToAll(metadata);
                        return metadata;
                    }}
                ]}
                fileActions={[
                    {
                        label: 'Copy URL',
                        onClick: (metadata: DriveMetadata) => {
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

    renderDebugLogScreen() {
        return (
            <DebugLogComponent
                onFinish={() => {this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP})}}
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
            case VirtualGamingTabletopMode.DEBUG_LOG_SCREEN:
                return this.renderDebugLogScreen();
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
        windowTitle: getWindowTitleFromStore(store),
        tabletop: getTabletopFromStore(store),
        scenario: getScenarioFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store),
        connectedUsers: getConnectedUsersFromStore(store),
        myPeerId: getMyPeerIdFromStore(store),
        tabletopValidation: getTabletopValidationFromStore(store),
        createInitialStructure: getCreateInitialStructureFromStore(store),
        deviceLayout: getDeviceLayoutFromStore(store),
        debugLog: getDebugLogFromStore(store)
    }
}

export default withResizeDetector(connect(mapStoreToProps)(VirtualGamingTabletop));