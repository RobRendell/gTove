import * as React from 'react';
import * as PropTypes from 'prop-types';
import classNames from 'classnames';
import {connect} from 'react-redux';
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
import {ActionCreators} from 'redux-undo';

import TabletopViewComponent, {TabletopViewComponentCameraView} from './tabletopViewComponent';
import BrowseFilesComponent from '../container/browseFilesComponent';
import * as constants from '../util/constants';
import MapEditor from './mapEditor';
import MiniEditor from './miniEditor';
import TabletopEditor from './tabletopEditor';
import ScenarioFileEditor from './scenarioFileEditor';
import {
    addMapAction,
    addMiniAction,
    appendScenarioAction,
    redoAction,
    replaceMapImageAction,
    replaceMetadataAction,
    setScenarioAction,
    setScenarioLocalAction,
    settableScenarioReducer,
    undoAction,
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
    getDiceFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getPingsFromStore,
    getScenarioFromStore,
    getServiceWorkerFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    getTabletopValidationFromStore,
    getUndoableHistoryFromStore,
    getWindowTitleFromStore,
    GtoveDispatchProp,
    ReduxStoreType
} from '../redux/mainReducer';
import {
    cartesianToHexCoords,
    DistanceMode,
    DistanceRound,
    effectiveHexGridType,
    getFocusMapIdAndFocusPointAtLevel,
    getGridTypeOfMap,
    getMapIdAtPoint,
    getMapIdClosestToZero,
    getMapIdOnNextLevel,
    getNetworkHubId,
    isMapFoggedAtPosition,
    isMapIdHighest,
    isMapIdLowest,
    isScenarioEmpty,
    isTabletopLockedForPeer,
    isUserAllowedOnTabletop,
    jsonToScenarioAndTabletop,
    MAP_EPSILON,
    MovementPathPoint,
    NEW_MAP_DELTA_Y,
    ObjectVector3,
    PieceVisibilityEnum,
    scenarioToJson,
    ScenarioType,
    snapMap,
    snapMini,
    spiralHexGridGenerator,
    spiralSquareGridGenerator,
    TabletopType
} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {
    castMapProperties,
    castMiniProperties,
    castTemplateProperties,
    DriveMetadata,
    DriveUser,
    GridType,
    MapProperties,
    MiniProperties,
    TabletopFileAppProperties,
    TemplateProperties,
    TemplateShape
} from '../util/googleDriveUtils';
import {
    addConnectedUserAction,
    ConnectedUserReducerType,
    ConnectedUserUsersType,
    setUserAllowedAction,
    updateConnectedUserDeviceAction
} from '../redux/connectedUserReducer';
import {FileAPI, FileAPIContext, splitFileName} from '../util/fileUtils';
import {buildVector3, vector3ToObject} from '../util/threeUtils';
import {PromiseModalContext} from '../container/authenticatedContainer';
import {
    setLastSavedHeadActionIdsAction,
    setLastSavedPlayerHeadActionIdsAction,
    TabletopValidationType
} from '../redux/tabletopValidationReducer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {setTabletopAction, updateTabletopAction} from '../redux/tabletopReducer';
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
import {DropDownMenuClickParams} from './dropDownMenu';
import OnClickOutsideWrapper from '../container/onClickOutsideWrapper';
import {clearDiceAction, DiceReducerType} from '../redux/diceReducer';
import DiceBag from './diceBag';
import {PingReducerType} from '../redux/pingReducer';
import {ServiceWorkerReducerType, serviceWorkerSetUpdateAction} from '../redux/serviceWorkerReducer';
import KeyDownHandler from '../container/keyDownHandler';
import Tooltip from './tooltip';

import './virtualGamingTabletop.scss';

interface VirtualGamingTabletopProps extends GtoveDispatchProp {
    files: FileIndexReducerType;
    tabletopId: string;
    windowTitle: string;
    scenario: ScenarioType;
    tabletop: TabletopType;
    loggedInUser: DriveUser;
    connectedUsers: ConnectedUserReducerType;
    tabletopValidation: TabletopValidationType;
    myPeerId: MyPeerIdReducerType;
    createInitialStructure: CreateInitialStructureReducerType;
    deviceLayout: DeviceLayoutReducerType;
    debugLog: DebugLogReducerType;
    width: number;
    height: number;
    dice: DiceReducerType;
    pings: PingReducerType;
    canUndo: boolean;
    canRedo: boolean;
    serviceWorker: ServiceWorkerReducerType;
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
    copyMapMetadataId?: string;
    gmConnected: boolean;
    fogOfWarMode: boolean;
    playerView: boolean;
    toastIds: {[message: string]: string | number};
    focusMapId?: string;
    folderStacks: {[root: string]: string[]};
    labelSize: number;
    workingMessages: string[];
    workingButtons: {[key: string]: () => void};
    savingTabletop: number;
    openDiceBag: boolean;
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

export const CAMERA_INITIAL_OFFSET = new THREE.Vector3(0, 12, 12);

class VirtualGamingTabletop extends React.Component<VirtualGamingTabletopProps, VirtualGamingTabletopState> {

    static SAVE_FREQUENCY_MS = 5000;

    private driveMenuButtons = [
        {label: 'Tabletops', state: VirtualGamingTabletopMode.TABLETOP_SCREEN, tooltip: 'Manage your tabletops'},
        {label: 'Maps', state: VirtualGamingTabletopMode.MAP_SCREEN, disabled: this.isTabletopReadonly.bind(this), tooltip: 'Upload and configure map images.'},
        {label: 'Minis', state: VirtualGamingTabletopMode.MINIS_SCREEN, disabled: this.isTabletopReadonly.bind(this), tooltip: 'Upload and configure miniature images.'},
        {label: 'Templates', state: VirtualGamingTabletopMode.TEMPLATES_SCREEN, disabled: this.isTabletopReadonly.bind(this), tooltip: 'Create and manage shapes like circles and squares.'},
        {label: 'Scenarios', state: VirtualGamingTabletopMode.SCENARIOS_SCREEN, disabled: () => (this.isCurrentUserPlayer() || this.isTabletopReadonly()), tooltip: 'Save your tabletop layouts to scenarios.'},
        {label: 'Bundles', state: VirtualGamingTabletopMode.BUNDLES_SCREEN, tooltip: 'Share your work with other GMs.'}
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
        this.updateVersionNow = this.updateVersionNow.bind(this);
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
        this.state = {
            fullScreen: false,
            loading: '',
            panelOpen: true,
            avatarsOpen: false,
            currentPage: props.tabletopId ? VirtualGamingTabletopMode.GAMING_TABLETOP : VirtualGamingTabletopMode.TABLETOP_SCREEN,
            gmConnected: this.isGMConnected(props),
            fogOfWarMode: false,
            playerView: false,
            toastIds: {},
            cameraLookAt: new THREE.Vector3(),
            cameraPosition: CAMERA_INITIAL_OFFSET.clone(),
            folderStacks: [constants.FOLDER_TABLETOP, constants.FOLDER_MAP, constants.FOLDER_MINI, constants.FOLDER_TEMPLATE, constants.FOLDER_SCENARIO, constants.FOLDER_BUNDLE]
                .reduce((result, root) => ({...result, [root]: [props.files.roots[root]]}), {}),
            labelSize: 0.4,
            workingMessages: [],
            workingButtons: {},
            savingTabletop: 0,
            openDiceBag: false,
        };
        this.emptyScenario = settableScenarioReducer(undefined as any, {type: '@@init'});
        this.emptyTabletop = {
            ...this.emptyScenario,
            gm: props.loggedInUser.emailAddress,
            gmSecret: null,
            gmOnlyPing: false,
            defaultGrid: GridType.SQUARE,
            distanceMode: DistanceMode.STRAIGHT,
            distanceRound: DistanceRound.ROUND_OFF,
            commsStyle: CommsStyle.PeerToPeer,
            headActionIds: [],
            playerHeadActionIds: [],
            lastSavedHeadActionIds: null,
            lastSavedPlayerHeadActionIds: null,
            videoMuted: {}
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

    private isTabletopReadonly() {
        return !this.state.gmConnected
            || isTabletopLockedForPeer(this.props.tabletop, this.props.connectedUsers.users, this.props.myPeerId)
            || !isUserAllowedOnTabletop(this.props.tabletop.gm, this.props.loggedInUser.emailAddress, this.props.tabletop.tabletopUserControl);
    }

    private isCurrentUserPlayer() {
        return !this.props.loggedInUser || this.props.loggedInUser.emailAddress !== this.props.tabletop.gm;
    }


    private async loadPublicPrivateJson(metadataId: string): Promise<(ScenarioType & TabletopType) | BundleType> {
        const fileAPI: FileAPI = this.context.fileAPI;
        let loadedJson = await fileAPI.getJsonFileContents({id: metadataId});
        if (loadedJson.gm && loadedJson.gm === this.props.loggedInUser.emailAddress) {
            let metadata = this.props.files.driveMetadata[metadataId] as DriveMetadata<TabletopFileAppProperties, void>;
            if (!metadata) {
                metadata = await fileAPI.getFullMetadata(metadataId) as DriveMetadata<TabletopFileAppProperties, void>;
                this.props.dispatch(addFilesAction([metadata]));
            }
            const privateJson = await fileAPI.getJsonFileContents({id: metadata.appProperties.gmFile});
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
                folder = await this.context.fileAPI.createFolder(bundleName, {parents: [this.props.files.roots[root]], properties: {fromBundleId}});
                this.addWorkingMessage(`Created folder ${root}/${bundleName}.`);
            }
            try {
                const bundleMetadata = await this.context.fileAPI.getFullMetadata(metadataId);
                this.addWorkingMessage(`Creating shortcut to image in ${root}/${bundleName}/${bundleMetadata.name}...`);
                await this.context.fileAPI.createShortcut({...bundleMetadata, properties: {...bundleMetadata.properties, fromBundleId}}, [folder.id]);
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
            // Check if have files from this bundle already... TODO
            // const existingBundleFiles = await this.context.fileAPI.findFilesWithProperty('fromBundleId', fromBundleId);
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
                await this.context.fileAPI.saveJsonToFile({name: scenarioName, parents: [folder.id], properties: {fromBundleId}}, scenario);
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
                // Reset Undo history after loading a tabletop
                this.props.dispatch(ActionCreators.clearHistory());
            }
        } catch (err) {
            // If the tabletop file doesn't exist, drop off that tabletop
            console.error(err);
            if (this.context.promiseModal && !this.context.promiseModal.isBusy()) {
                await this.context.promiseModal({
                    children: 'The link you used is no longer valid.'
                });
            }
            this.props.dispatch(setTabletopIdAction());
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
        if (Object.keys(this.props.connectedUsers.users).length === 0 && this.props.myPeerId) {
            // Add the logged-in user
            this.props.dispatch(addConnectedUserAction(this.props.myPeerId, this.props.loggedInUser, appVersion, this.props.width, this.props.height, this.props.deviceLayout));
        }
        this.checkConnectedUsers();
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

    private updateVersionNow() {
        const serviceWorker = this.props.serviceWorker;
        if (serviceWorker.registration && serviceWorker.registration.waiting) {
            serviceWorker.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload(true);
        }
    }

    async checkVersions() {
        const serviceWorker = this.props.serviceWorker;
        // Check if we have a pending update from the service worker
        if (serviceWorker.update && serviceWorker.registration && serviceWorker.registration.waiting
                && this.context.promiseModal && !this.context.promiseModal.isBusy()) {
            const reload = 'Load latest version';
            const response = await this.context.promiseModal({
                children: (
                    <div>
                        <p>
                            You are running an outdated version of gTove!  This may cause problems.
                        </p>
                        <p>
                            If you don't update now, you can update at any time from the menu opened from your avatar.
                        </p>
                    </div>
                ),
                options: [reload, 'Ignore']
            });
            if (response === reload) {
                this.updateVersionNow();
            } else {
                this.props.dispatch(serviceWorkerSetUpdateAction(false));
            }
        }
        if (serviceWorker.registration && !serviceWorker.registration.waiting) {
            // Also check if other clients have a newer version; if so, trigger the service worker to load the new code.
            const myClientOutdated = Object.keys(this.props.connectedUsers.users).reduce<boolean>((outdated, peerId) => {
                const user = this.props.connectedUsers.users[peerId];
                return outdated || (user.version !== undefined && appVersion.numCommits < user.version.numCommits);
            }, false);
            if (myClientOutdated) {
                serviceWorker.registration.update();
            }
        }
    }

    async checkConnectedUsers() {
        if (this.props.tabletopId && this.context.promiseModal && !this.context.promiseModal.isBusy()) {
            for (let peerId of Object.keys(this.props.connectedUsers.users)) {
                const user = this.props.connectedUsers.users[peerId];
                if (peerId !== this.props.myPeerId && !user.checkedForTabletop && user.user.emailAddress) {
                    let userAllowed = isUserAllowedOnTabletop(this.props.tabletop.gm, user.user.emailAddress, this.props.tabletop.tabletopUserControl);
                    if (userAllowed === null) {
                        const allowConnection = `Allow ${user.user.displayName} to connect`;
                        const response = await this.context.promiseModal({
                            children: (
                                <p>
                                    {user.user.displayName} ({user.user.emailAddress}) is attempting to connect to the
                                    tabletop.  Should they be allowed to connect?
                                </p>
                            ),
                            options: [allowConnection, 'Add them to the blacklist']
                        });
                        userAllowed = (response === allowConnection);
                        // Need to dispatch this before updating whitelist/blacklist, or an allowed user won't get the
                        // tabletop update.
                        this.props.dispatch(setUserAllowedAction(peerId, userAllowed));
                        const {whitelist, blacklist} = this.props.tabletop.tabletopUserControl || {whitelist: [], blacklist: []};
                        this.props.dispatch(updateTabletopAction({tabletopUserControl: {
                                whitelist: userAllowed ? [...whitelist, user.user.emailAddress] : whitelist,
                                blacklist: userAllowed ? blacklist : [...blacklist, user.user.emailAddress]
                            }}));
                    } else {
                        this.props.dispatch(setUserAllowedAction(peerId, userAllowed));
                    }
                }
            }
        }
    }

    saveTabletopToDrive(): void {
        // Due to undo and redo, the tabletop may not have unsaved changes any more.
        if (this.hasUnsavedActions()) {
            const metadataId = this.props.tabletopId;
            const driveMetadata = metadataId && this.props.files.driveMetadata[metadataId] as DriveMetadata<TabletopFileAppProperties, void>;
            const scenarioState = this.props.tabletopValidation.lastCommonScenario;
            if (driveMetadata && driveMetadata.appProperties && scenarioState) {
                this.setState((state) => ({savingTabletop: state.savingTabletop + 1}), async () => {
                    const [privateScenario, publicScenario] = scenarioToJson(scenarioState);
                    try {
                        const {gmSecret, lastSavedHeadActionIds, lastSavedPlayerHeadActionIds, ...tabletop} = this.props.tabletop;
                        await this.context.fileAPI.saveJsonToFile(metadataId, {...publicScenario, ...tabletop});
                        await this.context.fileAPI.saveJsonToFile(driveMetadata.appProperties.gmFile, {...privateScenario, ...tabletop, gmSecret});
                        this.props.dispatch(setLastSavedHeadActionIdsAction(scenarioState, lastSavedPlayerHeadActionIds || []));
                        this.props.dispatch(setLastSavedPlayerHeadActionIdsAction(scenarioState, lastSavedPlayerHeadActionIds || []));
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

    private hasUnsavedActions(props: VirtualGamingTabletopProps = this.props) {
        if (!props.tabletopValidation.lastCommonScenario) {
            return false;
        }
        if (props.loggedInUser.emailAddress === props.tabletop.gm) {
            return !isEqual(props.tabletop.lastSavedHeadActionIds, props.tabletopValidation.lastCommonScenario.headActionIds);
        } else {
            return !isEqual(props.tabletop.lastSavedPlayerHeadActionIds, props.tabletopValidation.lastCommonScenario.playerHeadActionIds);
        }
    }

    async UNSAFE_componentWillReceiveProps(props: VirtualGamingTabletopProps) {
        if (!props.tabletopId) {
            if (this.props.tabletopId) {
                // Change back to tabletop screen if we're losing our tabletopId
                this.setState({currentPage: VirtualGamingTabletopMode.TABLETOP_SCREEN});
            }
        } else if (props.tabletopId !== this.props.tabletopId) {
            await this.loadTabletopFromDrive(props.tabletopId);
        } else if (props.myPeerId === getNetworkHubId(props.loggedInUser.emailAddress, props.myPeerId, props.tabletop.gm, props.connectedUsers.users)
            && this.hasUnsavedActions(props)) {
            // Only save the scenario data if we are the network hub
            this.saveTabletopToDrive();
        }
        const gmConnected = props.tabletopId !== undefined && this.isGMConnected(props);
        if (gmConnected !== this.state.gmConnected) {
            this.setState({gmConnected});
            this.updatePersistentToast(props.tabletopId !== undefined && !gmConnected, 'View-only mode - no GM is connected.');
        }
        this.updatePersistentToast(gmConnected && isTabletopLockedForPeer(props.tabletop, props.connectedUsers.users, props.myPeerId),
            'The tabletop is locked by the GM - only they can make changes.');
        this.updatePersistentToast(gmConnected && !isUserAllowedOnTabletop(props.tabletop.gm, props.loggedInUser.emailAddress, props.tabletop.tabletopUserControl),
            'Requesting permission to connect to this tabletop, please wait...');
        this.updatePersistentToast(Object.keys(props.tabletopValidation.pendingActions).length > 0,
            'Missing actions detected - attempting to re-synchronize.');
        this.updatePersistentToast(props.connectedUsers.signalError,
            'Signal server not reachable - new clients cannot connect.');
        if (!this.state.focusMapId) {
            if (Object.keys(props.scenario.maps).length > 0) {
                // Maps have appeared for the first time.
                this.setFocusMapIdToMapClosestToZero(!props.scenario.startCameraAtOrigin, props);
            }
        } else if (!props.scenario.maps[this.state.focusMapId]) {
            // The focus map has gone
            this.setFocusMapIdToMapClosestToZero(true, props);
        }
        if (props.width !== this.props.width || props.height !== this.props.height) {
            this.props.dispatch(updateConnectedUserDeviceAction(this.props.myPeerId!, props.width, props.height));
        }
        this.updateCameraFromProps(props);
    }

    private setFocusMapIdToMapClosestToZero(panCamera: boolean, props: VirtualGamingTabletopProps = this.props) {
        const closestId = getMapIdClosestToZero(props.scenario.maps);
        this.setFocusMapId(closestId, panCamera, props);
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

    getDefaultCameraFocus(levelMapId: string | undefined | null = this.state.focusMapId, props = this.props) {
        const {cameraLookAt} = this.getLevelCameraLookAtAndFocusMapId(levelMapId, true, props);
        return {
            cameraLookAt,
            cameraPosition: cameraLookAt.clone().add(CAMERA_INITIAL_OFFSET)
        };
    }

    setCameraParameters(cameraParameters: Partial<VirtualGamingTabletopCameraState>, animate = 0, focusMapId?: string | null) {
        if (this.props.deviceLayout.layout[this.props.myPeerId!]) {
            // We're part of a combined display - camera parameters are in the Redux store.
            this.props.dispatch(updateGroupCameraAction(this.props.deviceLayout.layout[this.props.myPeerId!].deviceGroupId, cameraParameters, animate));
            if (focusMapId !== undefined) {
                this.props.dispatch(updateGroupCameraFocusMapIdAction(this.props.deviceLayout.layout[this.props.myPeerId!].deviceGroupId, focusMapId || undefined));
            }
        } else if (animate) {
            const cameraAnimationStart = Date.now();
            const cameraAnimationEnd = cameraAnimationStart + animate;
            this.setState({
                cameraAnimationStart,
                cameraAnimationEnd,
                targetCameraPosition: cameraParameters.cameraPosition || this.state.cameraPosition,
                targetCameraLookAt: cameraParameters.cameraLookAt || this.state.cameraLookAt,
                focusMapId: focusMapId === undefined ? this.state.focusMapId : (focusMapId || undefined)
            });
        } else {
            this.setState({
                cameraPosition: cameraParameters.cameraPosition || this.state.cameraPosition,
                cameraLookAt: cameraParameters.cameraLookAt || this.state.cameraLookAt,
                targetCameraPosition: undefined,
                targetCameraLookAt: undefined,
                cameraAnimationStart: undefined,
                cameraAnimationEnd: undefined,
                focusMapId: focusMapId === undefined ? this.state.focusMapId : (focusMapId || undefined)
            });
        }
    }

    lookAtPointPreservingViewAngle(newCameraLookAt: THREE.Vector3): THREE.Vector3 {
        // Simply shift the cameraPosition by the same delta as we're shifting the cameraLookAt.
        return newCameraLookAt.clone().sub(this.state.cameraLookAt).add(this.state.cameraPosition);
    }

    /**
     * Given a levelMapId, find the actual ID of the best map on that level to focus on, and the selected or defeault
     * 3D focus point for the level.
     *
     * @param levelMapId The mapId of a map on the level.  If null or undefined, default to the level at elevation 0.
     * @param panCamera If true, the cameraLookAt will be the focus point for the level (if no explicit focus point is
     * set, it will be the centre of the focusMapId).  If false, the cameraLookAt will be the same as the current
     * camera's from this.state, except the elevation will that of focusMapId.  If null, act like panCamera is true if
     * focusMapId has an explicit focus point, false if not.
     * @param props The component's props, to support calling from UNSAFE_componentWillReceiveProps.
     * @returns {focusMapId, cameraLookAt} The id of the best mapId on the level (e.g. the highest one with the lowest
     * mapId which has an explicit map focus point set), and the cameraLookAt for that map, as controlled by the
     * parameters.
     */
    getLevelCameraLookAtAndFocusMapId(levelMapId: string | null | undefined, panCamera: boolean | null, props = this.props) {
        const elevation = levelMapId ? props.scenario.maps[levelMapId].position.y : 0;
        const {focusMapId, cameraFocusPoint} = getFocusMapIdAndFocusPointAtLevel(props.scenario.maps, elevation);
        const cameraLookAt = (panCamera || (panCamera === null && cameraFocusPoint)) ? (
            (focusMapId && cameraFocusPoint) ? buildVector3(cameraFocusPoint)
                : focusMapId ? buildVector3(props.scenario.maps[focusMapId].position)
                : new THREE.Vector3()
        ) : (
            new THREE.Vector3(this.state.cameraLookAt.x, focusMapId ? props.scenario.maps[focusMapId].position.y : 0, this.state.cameraLookAt.z)
        );
        return {focusMapId, cameraLookAt};
    }

    setFocusMapId(levelMapId: string | undefined, panCamera: boolean | null = true, props = this.props) {
        const {focusMapId, cameraLookAt} = this.getLevelCameraLookAtAndFocusMapId(levelMapId, panCamera, props);
        // Move camera to look at target position, but don't change view angle.
        const cameraPosition = this.lookAtPointPreservingViewAngle(cameraLookAt);
        this.setCameraParameters({cameraPosition, cameraLookAt}, 1000, focusMapId || null);
        if (props.deviceLayout.layout[this.props.myPeerId!]) {
            props.dispatch(updateGroupCameraFocusMapIdAction(props.deviceLayout.layout[props.myPeerId!].deviceGroupId, focusMapId));
        }
    }

    changeFocusLevel(direction: 1 | -1) {
        const levelMapId = getMapIdOnNextLevel(direction, this.props.scenario.maps, this.state.focusMapId, false);
        this.setFocusMapId(levelMapId, null);
    }

    private adjustMapPositionToNotCollide(position: THREE.Vector3, properties: MapProperties, performAdjust: boolean): boolean {
        // TODO this doesn't account for map rotation.
        let adjusted = false;
        Object.keys(this.props.scenario.maps).forEach((mapId) => {
            const map = this.props.scenario.maps[mapId];
            const mapWidth = Number(map.metadata.properties.width);
            const mapHeight = Number(map.metadata.properties.height);
            if (isCloseTo(position.y, map.position.y)
                && position.x + properties.width / 2 >= map.position.x - mapWidth / 2 && position.x - properties.width / 2 < map.position.x + mapWidth / 2
                && position.z + properties.height / 2 >= map.position.z - mapHeight / 2 && position.z - properties.height / 2 < map.position.z + mapHeight / 2) {
                adjusted = true;
                if (performAdjust) {
                    const delta = position.clone().sub(map.position as THREE.Vector3);
                    const quadrant14 = (delta.x - delta.z > 0);
                    const quadrant12 = (delta.x + delta.z > 0);
                    if (quadrant12 && quadrant14) {
                        position.x = map.position.x + MAP_EPSILON + (mapWidth + properties.width) / 2;
                    } else if (quadrant12) {
                        position.z = map.position.z + MAP_EPSILON + (mapHeight + properties.height) / 2;
                    } else if (quadrant14) {
                        position.z = map.position.z - MAP_EPSILON - (mapHeight + properties.height) / 2;
                    } else {
                        position.x = map.position.x - MAP_EPSILON - (mapWidth + properties.width) / 2;
                    }
                    snapMap(true, properties, position);
                }
            }
        });
        return adjusted;
    }

    findPositionForNewMap(rawProperties: MapProperties, position = this.state.cameraLookAt): THREE.Vector3 {
        const properties = castMapProperties(rawProperties) || {};
        properties.width = properties.width || 10;
        properties.height = properties.height || 10;
        const {positionObj} = snapMap(true, properties, position);
        while (true) {
            const search = buildVector3(positionObj);
            if (getMapIdAtPoint(search, this.props.scenario.maps) === undefined) {
                // Attempt to find free space for the map at current elevation.
                this.adjustMapPositionToNotCollide(search, properties, true);
                if (!this.adjustMapPositionToNotCollide(search, properties, false)) {
                    return search;
                }
            }
            // Try to fit the map at a higher elevation
            positionObj.y += NEW_MAP_DELTA_Y;
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

    findPositionForNewMini(scale = 1.0, basePosition: THREE.Vector3 | ObjectVector3 = this.state.cameraLookAt, avoid: MiniSpace[] = []): MovementPathPoint {
        // Find the map the mini is being placed on, if any.
        const onMapId = getMapIdAtPoint(basePosition, this.props.scenario.maps);
        // Snap position to the relevant grid.
        const gridType = onMapId ? this.props.scenario.maps[onMapId].metadata.properties.gridType : this.props.tabletop.defaultGrid;
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
                spiralGenerator = spiralHexGridGenerator(effectiveGridType);
                break;
            default:
                baseX = Math.floor(basePosition.x / gridSnap) * gridSnap + (scale / 2) % 1;
                baseZ = Math.floor(basePosition.z / gridSnap) * gridSnap + (scale / 2) % 1;
                spiralGenerator = spiralSquareGridGenerator();
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
        if (baseName === '') {
            // Allow duplicate empty names
            return ['', 0];
        }
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
                    <InputButton type='button' disabled={isMapIdHighest(this.props.scenario.maps, this.state.focusMapId)}
                                 tooltip='Focus the camera on a map at a higher elevation.'
                                 onChange={() => {
                                     this.changeFocusLevel(1);
                                 }}>
                        <span className='material-icons'>expand_less</span>
                    </InputButton>
                    <InputButton type='button' tooltip='Re-focus the camera on the current map.'
                                 onChange={() => {
                                     this.setCameraParameters(this.getDefaultCameraFocus(), 1000);
                                 }}>
                        <span className='material-icons'>videocam</span>
                    </InputButton>
                    <InputButton type='button' disabled={isMapIdLowest(this.props.scenario.maps, this.state.focusMapId)}
                                 tooltip='Focus the camera on a map at a lower elevation.'
                                 onChange={() => {
                                     this.changeFocusLevel(-1);
                                 }}>
                        <span className='material-icons'>expand_more</span>
                    </InputButton>
                </div>
                <div className='controlsRow'>
                    <span className='smaller'>A</span>
                    <InputField className='labelSizeInput' type='range' tooltip='Label Size'
                                initialValue={this.state.labelSize} minValue={0.2} maxValue={0.6} step={0.1}
                                onChange={(value) => {
                                    this.setState({labelSize: Number(value)})
                                }}
                    />
                    <span className='larger'>A</span>
                </div>
                <div className='controlsRow'>
                    <InputButton type='button'
                                 tooltip={this.state.fullScreen ? 'Exit full-screen mode' : 'Start full-screen mode'}
                                 onChange={() => {this.setState({fullScreen: !this.state.fullScreen})}}>
                        <span className='material-icons'>{this.state.fullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </InputButton>
                    <InputButton type='button'
                                 tooltip='Copy Tabletop URL to clipboard'
                                 onChange={() => {
                                     copyToClipboard(window.location.href);
                                     toast('Current tabletop URL copied to clipboard.');
                                 }}>
                        <span className='material-icons'>share</span>
                    </InputButton>
                    <InputButton type='button'
                                 tooltip='Open Dice Bag'
                                 onChange={() => {this.setState({openDiceBag: !this.state.openDiceBag})}}>
                        <span className='material-icons'>casino</span>
                    </InputButton>
                </div>
            </div>
        )
    }

    loggedInUserIsGM(): boolean {
        return (this.props.loggedInUser !== null && this.props.loggedInUser.emailAddress === this.props.tabletop.gm);
    }

    async dispatchUndoRedoAction(undo: boolean) {
        if (Object.keys(this.props.connectedUsers.users).length > 1 && this.props.tabletop.tabletopLockedPeerId !== this.props.myPeerId) {
            if (!this.context.promiseModal || this.context.promiseModal.isBusy()) {
                return;
            }
            const canLock = !isTabletopLockedForPeer(this.props.tabletop, this.props.connectedUsers.users, this.props.myPeerId, true);
            const lockTabletop = 'Lock the tabletop';
            const response = await this.context.promiseModal({
                children: 'You cannot undo or redo changes to the tabletop while other people are connected, unless you lock the tabletop for everyone else first.',
                options: canLock ? [lockTabletop, 'Ok'] : ['Ok']
            });
            if (response === lockTabletop) {
                this.props.dispatch(updateTabletopAction({tabletopLockedPeerId: this.props.myPeerId!}));
            }
        } else {
            this.props.dispatch(undo ? undoAction() : redoAction());
        }
    }

    renderGMOnlyMenu() {
        const readOnly = this.isTabletopReadonly();
        return (!this.loggedInUserIsGM()) ? null : (
            <div>
                <div className='controlsRow'>
                    <InputButton type='button'
                                 tooltip={this.props.tabletop.tabletopLockedPeerId === this.props.myPeerId ? 'Unlock the tabletop.' : 'Lock the tabletop so that only this client can make changes.'}
                                 className={classNames({myLock: this.props.tabletop.tabletopLockedPeerId === this.props.myPeerId})}
                                 onChange={() => {
                                     if (this.props.myPeerId && !isTabletopLockedForPeer(this.props.tabletop, this.props.connectedUsers.users, this.props.myPeerId, true)) {
                                         const tabletopLockedPeerId = this.props.tabletop.tabletopLockedPeerId === this.props.myPeerId ? undefined : this.props.myPeerId;
                                         this.props.dispatch(updateTabletopAction({tabletopLockedPeerId}));
                                     }
                                 }}>
                        <span className='material-icons'>{this.props.tabletop.tabletopLockedPeerId ? 'lock' : 'lock_open'}</span>
                    </InputButton>
                    <InputButton type='button'
                                 tooltip='Undo'
                                 disabled={!this.props.canUndo}
                                 onChange={() => (this.dispatchUndoRedoAction(true))}>
                        <span className='material-icons'>undo</span>
                    </InputButton>
                    <InputButton type='button'
                                 tooltip='Redo'
                                 disabled={!this.props.canRedo}
                                 onChange={() => (this.dispatchUndoRedoAction(false))}>
                        <span className='material-icons'>redo</span>
                    </InputButton>
                </div>
                <hr/>
                <InputButton type='checkbox' fillWidth={true} selected={this.props.scenario.snapToGrid} disabled={readOnly} onChange={() => {
                    this.props.dispatch(updateSnapToGridAction(!this.props.scenario.snapToGrid));
                }} tooltip='Snap minis to the grid when moving them.'>Grid Snap</InputButton>
                <InputButton type='checkbox' fillWidth={true} selected={this.state.fogOfWarMode} disabled={readOnly} onChange={() => {
                    this.setState({fogOfWarMode: !this.state.fogOfWarMode});
                }} tooltip='Cover or reveal map sections with the fog of war.'>Edit Fog</InputButton>
                <InputButton type='checkbox' fillWidth={true} selected={!this.props.scenario.confirmMoves} disabled={readOnly} onChange={() => {
                    this.props.dispatch(updateConfirmMovesAction(!this.props.scenario.confirmMoves));
                }} tooltip='Toggle whether movement needs to be confirmed.'>Free Move</InputButton>
                <InputButton type='checkbox' fillWidth={true} selected={!this.state.playerView} disabled={readOnly} onChange={() => {
                    this.setState({playerView: !this.state.playerView});
                }} tooltip='Toggle between the "see everything" GM View and what players can see.'>GM View</InputButton>
            </div>
        );
    }

    renderClearButton() {
        return !this.loggedInUserIsGM() ? null : (
            <div>
                <hr/>
                <InputButton
                    type='button' fillWidth={true} className='scaryButton' disabled={this.isTabletopReadonly()}
                    tooltip='Remove all maps, pieces and dice.'
                    onChange={async () => {
                        if (this.context.promiseModal && !this.context.promiseModal.isBusy()) {
                            const yesOption = 'Yes';
                            const response = await this.context.promiseModal({
                                children: 'Are you sure you want to remove all maps, pieces and dice from this tabletop?',
                                options: [yesOption, 'Cancel']
                            });
                            if (response === yesOption) {
                                this.props.dispatch(setScenarioAction({...this.props.scenario, maps: {}, minis: {}}, 'clear'));
                                this.props.dispatch(updateTabletopAction({videoMuted: {}}));
                                this.props.dispatch(clearDiceAction());
                                this.setState({fogOfWarMode: false});
                            }
                        }
                    }}
                >Clear Tabletop</InputButton>
            </div>
        );
    }

    renderDriveMenuButtons() {
        return !this.props.files.roots[constants.FOLDER_ROOT] ? null : (
            <div>
                <hr/>
                {
                    this.driveMenuButtons.map((buttonData) => (
                        <InputButton
                            key={buttonData.label}
                            type='button'
                            fillWidth={true}
                            disabled={buttonData.disabled ? buttonData.disabled() : false}
                            tooltip={buttonData.tooltip}
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
        const otherUsers = Object.keys(this.props.connectedUsers.users).filter((peerId) => (peerId !== this.props.myPeerId));
        const anyMismatches = otherUsers.reduce<boolean>((any, peerId) => {
            const version = this.props.connectedUsers.users[peerId].version;
            return any || (version !== undefined && version.hash !== appVersion.hash)
        }, false);
        const updatePending = !!(this.props.serviceWorker.registration && this.props.serviceWorker.registration.waiting);
        const annotation = (this.state.avatarsOpen || otherUsers.length === 0) ? (anyMismatches ? '!' : undefined) : otherUsers.length;
        return (
            <OnClickOutsideWrapper onClickOutside={() => {this.setState({avatarsOpen: false})}}>
                <div>
                    <div className='loggedInAvatar' onClick={() => {
                        this.setState({avatarsOpen: !this.state.avatarsOpen})
                    }}>
                        <GoogleAvatar user={this.props.loggedInUser}
                                      annotation={annotation}
                                      annotationClassNames={classNames({mismatch: anyMismatches || updatePending, gmConnected: this.state.gmConnected})}
                                      annotationTooltip={anyMismatches ? 'Different versions of gTove!' : updatePending ? 'Update pending' : undefined}
                        />
                        {
                            (this.state.savingTabletop > 0) ? (
                                <Tooltip className='saving' tooltip='Saving changes to Drive'>
                                    <Spinner/>
                                </Tooltip>
                            ) : this.hasUnsavedActions() ? (
                                <Tooltip className='saving' tooltip='Unsaved changes'>
                                    <i className='material-icons pending'>sync</i>
                                </Tooltip>
                            ) : null
                        }
                    </div>
                    {
                        !this.state.avatarsOpen ? null : (
                            <div className='avatarPanel small'>
                                {
                                    !updatePending ? null : (
                                        <InputButton type='button' onChange={this.updateVersionNow}>
                                            Update gTove now
                                        </InputButton>
                                    )
                                }
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
                                    otherUsers.length === 0 ? null : (
                                        <p>Other users connected to this tabletop:</p>
                                    )
                                }
                                {
                                    otherUsers.length === 0 ? null : (
                                        otherUsers.sort().map((peerId) => {
                                            const connectedUser = this.props.connectedUsers.users[peerId];
                                            const user = connectedUser.user;
                                            const userIsGM = (user.emailAddress === this.props.tabletop.gm);
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
                                                this.setState({currentPage: VirtualGamingTabletopMode.DEVICE_LAYOUT_SCREEN, avatarsOpen: false})
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

    private tabletopUndoRedoAction(undo: boolean) {
        if (this.loggedInUserIsGM()) {
            this.dispatchUndoRedoAction(undo);
        }
    }

    renderControlPanelAndTabletop() {
        const readOnly = this.isTabletopReadonly();
        return (
            <div className='controlFrame'>
                <KeyDownHandler keyMap={{
                    'z': {modifiers: {metaKey: true}, callback: () => {this.tabletopUndoRedoAction(true)}},
                    'y': {modifiers: {metaKey: true}, callback: () => {this.tabletopUndoRedoAction(false)}}
                }}/>
                {this.renderMenuButton()}
                {this.renderMenu()}
                {this.renderAvatars()}
                {
                    !this.state.openDiceBag ? null : (
                        <DiceBag dice={this.props.dice} dispatch={this.props.dispatch} onClose={() => {this.setState({openDiceBag: false})}}/>
                    )
                }
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
                        readOnly={readOnly}
                        disableTapMenu={readOnly}
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
                        dice={this.props.dice}
                        networkHubId={getNetworkHubId(this.props.loggedInUser.emailAddress, this.props.myPeerId, this.props.tabletop.gm, this.props.connectedUsers.users) || undefined}
                        pings={this.props.pings}
                        connectedUsers={this.props.connectedUsers}
                        sideMenuOpen={this.state.panelOpen}
                    />
                </div>
            </div>
        );
    }

    renderMapScreen() {
        const hasNoProperties = ((metadata: DriveMetadata<void, MapProperties>) => (!metadata.properties || !metadata.properties.width));
        return (
            <BrowseFilesComponent<void, MapProperties>
                files={this.props.files}
                dispatch={this.props.dispatch}
                topDirectory={constants.FOLDER_MAP}
                folderStack={this.state.folderStacks[constants.FOLDER_MAP]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                showSearch={true}
                allowUploadAndWebLink={true}
                allowMultiPick={true}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: hasNoProperties,
                        onClick: async (metadata: DriveMetadata<void, MapProperties>) => {
                            if (this.state.copyMapMetadataId) {
                                const editMetadata = await this.context.fileAPI.getFullMetadata(this.state.copyMapMetadataId);
                                this.setState({copyMapMetadataId: undefined});
                                toast(`Grid parameters copied from ${metadata.name} to ${editMetadata.name}`);
                                return {
                                    postAction: 'edit',
                                    metadata: {...editMetadata, ...metadata, id: editMetadata.id, name: editMetadata.name}
                                }
                            } else if (this.state.replaceMapMetadataId) {
                                const gmOnly = Object.keys(this.props.scenario.maps)
                                    .filter((mapId) => (this.props.scenario.maps[mapId].metadata.id === this.state.replaceMapMetadataId))
                                    .reduce((gmOnly, mapId) => (gmOnly && this.props.scenario.maps[mapId].gmOnly), true);
                                this.props.dispatch(replaceMetadataAction(this.state.replaceMapMetadataId, metadata.id, gmOnly));
                                this.setState({
                                    replaceMapMetadataId: undefined,
                                    currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP
                                });
                            } else if (this.state.replaceMapImageId) {
                                const gmOnly = this.props.scenario.maps[this.state.replaceMapImageId].gmOnly;
                                this.props.dispatch(replaceMapImageAction(this.state.replaceMapImageId, metadata.id, gmOnly));
                                this.setState({
                                    replaceMapImageId: undefined,
                                    currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP
                                });
                            } else {
                                const {name} = splitFileName(metadata.name);
                                const position = vector3ToObject(this.findPositionForNewMap(metadata.properties));
                                const gmOnly = (this.loggedInUserIsGM() && metadata.properties.gridColour === constants.GRID_NONE && !this.state.playerView);
                                const mapId = v4();
                                this.props.dispatch(addMapAction({metadata, name, gmOnly, position}, mapId));
                                this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP}, () => {
                                    this.setFocusMapId(mapId);
                                });
                            }
                            return undefined;
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Select', onClick: 'select'},
                    {
                        label: 'Copy from...',
                        onClick: async (metadata: DriveMetadata<void, MapProperties>) => {
                            toast('Pick a map to copy the grid and other parameters from, replacing the grid of ' + metadata.name);
                            this.setState({copyMapMetadataId: metadata.id});
                        }
                    },
                    {label: 'Delete', onClick: 'delete'}
                ]}
                fileIsNew={hasNoProperties}
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

    private placeMini(miniMetadata: DriveMetadata<void, MiniProperties>, avoid: MiniSpace[] = []): MiniSpace {
        const match = splitFileName(miniMetadata.name).name.match(/^(.*?) *([0-9]*)$/)!;
        let baseName = match[1], suffixStr = match[2];
        let [name, suffix] = this.findUnusedMiniName(baseName, suffixStr ? Number(suffixStr) : undefined);
        if (suffix === 1 && suffixStr !== '1') {
            // There's a mini with baseName (with no suffix) already on the tabletop.  Rename it.
            const existingMiniId = Object.keys(this.props.scenario.minis).reduce<string | null>((result, miniId) => (
                result || ((this.props.scenario.minis[miniId].name === baseName) ? miniId : null)
            ), null);
            existingMiniId && this.props.dispatch(updateMiniNameAction(existingMiniId, name));
            name = baseName + ' 2';
        }
        const properties = castMiniProperties(miniMetadata.properties);
        const scale = properties.scale || 1;
        const position = this.findPositionForNewMini(scale, this.state.cameraLookAt, avoid);
        const visibility = properties.defaultVisibility || PieceVisibilityEnum.FOGGED;
        const onFog = position.onMapId ? isMapFoggedAtPosition(this.props.scenario.maps[position.onMapId], position) : false;
        const gmOnly = (visibility === PieceVisibilityEnum.HIDDEN || (visibility === PieceVisibilityEnum.FOGGED && onFog));
        if (gmOnly && (!this.loggedInUserIsGM() || this.state.playerView)) {
            toast(name + ' added, but it is hidden from you.');
        }
        this.props.dispatch(addMiniAction({
            metadata: miniMetadata,
            name,
            visibility,
            gmOnly,
            position,
            movementPath: this.props.scenario.confirmMoves ? [position] : undefined,
            scale,
            onMapId: position.onMapId
        }));
        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
        return {...position, scale};
    }

    renderMinisScreen() {
        const hasNoAppData = (metadata: DriveMetadata<void, MiniProperties>) => (!metadata.properties || !metadata.properties.width);
        return (
            <BrowseFilesComponent<void, MiniProperties>
                files={this.props.files}
                dispatch={this.props.dispatch}
                topDirectory={constants.FOLDER_MINI}
                folderStack={this.state.folderStacks[constants.FOLDER_MINI]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                showSearch={true}
                allowUploadAndWebLink={true}
                allowMultiPick={true}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: hasNoAppData,
                        onClick: (miniMetadata: DriveMetadata<void, MiniProperties>) => {
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
                    {label: 'Select', onClick: 'select'},
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
            <BrowseFilesComponent<void, TemplateProperties>
                files={this.props.files}
                dispatch={this.props.dispatch}
                topDirectory={constants.FOLDER_TEMPLATE}
                folderStack={this.state.folderStacks[constants.FOLDER_TEMPLATE]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                showSearch={true}
                allowUploadAndWebLink={false}
                allowMultiPick={true}
                globalActions={[
                    {label: 'Add Template', createsFile: true, onClick: async (parents: string[]) => {
                        const metadata = await this.context.fileAPI.saveJsonToFile({name: 'New Template', parents}, {});
                        await this.context.fileAPI.makeFileReadableToAll(metadata);
                        return metadata as DriveMetadata<void, TemplateProperties>;
                    }}
                ]}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: (metadata: DriveMetadata<void, TemplateProperties>) => (!metadata.properties || !metadata.properties.templateShape),
                        onClick: (templateMetadata: DriveMetadata<void, TemplateProperties>) => {
                            const position = this.findPositionForNewMini();
                            const onFog = position.onMapId ? isMapFoggedAtPosition(this.props.scenario.maps[position.onMapId], position) : false;
                            const properties = castTemplateProperties(templateMetadata.properties);
                            const visibility = properties.defaultVisibility || PieceVisibilityEnum.FOGGED;
                            const gmOnly = (visibility === PieceVisibilityEnum.HIDDEN || (visibility === PieceVisibilityEnum.FOGGED && onFog));
                            if (gmOnly && (!this.loggedInUserIsGM() || this.state.playerView)) {
                                toast(templateMetadata.name + ' added, but it is hidden from you.');
                            }
                            this.props.dispatch(addMiniAction({
                                metadata: templateMetadata,
                                name: templateMetadata.name,
                                visibility,
                                gmOnly,
                                position, movementPath: this.props.scenario.confirmMoves ? [position] : undefined
                            }));
                            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Select', onClick: 'select'},
                    {label: 'Delete', onClick: 'delete'}
                ]}
                editorComponent={TemplateEditor}
                jsonIcon={(metadata: DriveMetadata<void, TemplateProperties>) => {
                    if (metadata.properties) {
                        const properties = castTemplateProperties(metadata.properties);
                        const colour = ('000000' + properties.colour.toString(16)).slice(-6);
                        return (properties.templateShape === TemplateShape.RECTANGLE) ? (
                            <div className='rectangleTemplateIcon' style={{backgroundColor: '#' + colour}}/>
                        ) : (
                            <div className='material-icons' style={{color: '#' + colour}}>{VirtualGamingTabletop.templateIcon[properties.templateShape]}</div>
                        );
                    } else {
                        return (<div className='material-icons'>fiber_new</div>);
                    }
                }}
            />
        );
    }

    private async createNewTabletop(parents: string[], name = 'New Tabletop', scenario = this.emptyScenario): Promise<DriveMetadata<TabletopFileAppProperties, void>> {
        // Create both the private file in the GM Data folder, and the new shared tabletop file
        const newTabletop = {
            ...this.emptyTabletop,
            gmSecret: randomBytes(48).toString('hex'),
            ...scenario
        };
        const privateMetadata = await this.context.fileAPI.saveJsonToFile({name, parents: [this.props.files.roots[constants.FOLDER_GM_DATA]]}, newTabletop);
        const publicMetadata = await this.context.fileAPI.saveJsonToFile({name, parents, appProperties: {gmFile: privateMetadata.id}}, {...newTabletop, gmSecret: undefined});
        await this.context.fileAPI.makeFileReadableToAll(publicMetadata);
        return publicMetadata as DriveMetadata<TabletopFileAppProperties, void>;
    }

    renderTabletopsScreen() {
        const tabletopName = this.props.tabletopId && this.props.files.driveMetadata[this.props.tabletopId]
            ? this.props.files.driveMetadata[this.props.tabletopId].name : 'current Tabletop';
        const tabletopSuffix = tabletopName.toLowerCase().indexOf('tabletop') >= 0 ? '' : ' Tabletop';
        return (
            <BrowseFilesComponent<TabletopFileAppProperties, void>
                files={this.props.files}
                dispatch={this.props.dispatch}
                topDirectory={constants.FOLDER_TABLETOP}
                folderStack={this.state.folderStacks[constants.FOLDER_TABLETOP]}
                setFolderStack={this.setFolderStack}
                highlightMetadataId={this.props.tabletopId}
                onBack={this.props.tabletopId ? this.onBack : undefined}
                showSearch={false}
                allowUploadAndWebLink={false}
                allowMultiPick={false}
                globalActions={[
                    {label: 'Add Tabletop', createsFile: true, onClick: async (parents: string[]) => (this.createNewTabletop(parents))},
                    {label: `Bookmark ${tabletopName}${tabletopSuffix}`, createsFile: true, onClick: async (parents: string[]) => {
                        const tabletop = await this.context.fileAPI.getFullMetadata(this.props.tabletopId);
                        return await this.context.fileAPI.createShortcut(tabletop, parents) as DriveMetadata<TabletopFileAppProperties, void>;
                    }, hidden: !this.props.tabletopId || this.loggedInUserIsGM()}
                ]}
                fileActions={[
                    {
                        label: 'Pick',
                        onClick: (tabletopMetadata: DriveMetadata<TabletopFileAppProperties, void>) => {
                            if (!this.props.tabletopId) {
                                this.props.dispatch(setTabletopIdAction(tabletopMetadata.id, tabletopMetadata.name));
                                this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                            } else if (this.props.tabletopId !== tabletopMetadata.id) {
                                // pop out a new window/tab with the new tabletop
                                const newWindow = window.open(tabletopMetadata.id, '_blank');
                                newWindow && newWindow.focus();
                                this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                            }
                            return true;
                        }
                    },
                    {
                        label: 'Copy URL',
                        onClick: (metadata: DriveMetadata<TabletopFileAppProperties, void>) => {
                            const targetPage = this.props.tabletopId ? VirtualGamingTabletopMode.GAMING_TABLETOP : this.state.currentPage;
                            this.setState({currentPage: targetPage}, () => {
                                this.copyURLToClipboard(metadata.id);
                                const name = metadata.name + (metadata.name.endsWith('abletop') ? '' : ' Tabletop');
                                toast(name + ' URL copied to clipboard.');
                            });
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Select', onClick: 'select'},
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

    private adjustScenarioOrigin(scenario: ScenarioType, origin: THREE.Vector3, orientation: THREE.Euler): ScenarioType {
        scenario.maps = Object.keys(scenario.maps).reduce((maps, mapId) => {
            const map = scenario.maps[mapId];
            const position = buildVector3(map.position).applyEuler(orientation).add(origin);
            const rotation = {...map.rotation, y: map.rotation.y + orientation.y};
            const {positionObj, rotationObj} = snapMap(true, map.metadata.properties, position, rotation);
            maps[mapId] = {...map, position: positionObj, rotation: rotationObj};
            return maps;
        }, {});
        scenario.minis = Object.keys(scenario.minis).reduce((minis, miniId) => {
            const mini = scenario.minis[miniId];
            if (mini.attachMiniId) {
                minis[miniId] = mini;
            } else {
                const position = buildVector3(mini.position).applyEuler(orientation).add(origin);
                const rotation = {...mini.rotation, y: mini.rotation.y + orientation.y};
                const gridType = mini.onMapId ? getGridTypeOfMap(scenario.maps[mini.onMapId]) : this.props.tabletop.defaultGrid;
                const {positionObj, rotationObj, elevation} = snapMini(this.props.scenario.snapToGrid, gridType, mini.scale, position, mini.elevation, rotation);
                minis[miniId] = {...mini, position: positionObj, rotation: rotationObj, elevation};
            }
            return minis;
        }, {});
        return scenario;
    }

    renderScenariosScreen() {
        return this.isCurrentUserPlayer() ? null : (
            <BrowseFilesComponent<void, void>
                files={this.props.files}
                dispatch={this.props.dispatch}
                topDirectory={constants.FOLDER_SCENARIO}
                folderStack={this.state.folderStacks[constants.FOLDER_SCENARIO]}
                setFolderStack={this.setFolderStack}
                highlightMetadataId={this.props.tabletopId}
                onBack={this.props.tabletopId ? this.onBack : undefined}
                showSearch={false}
                allowUploadAndWebLink={false}
                allowMultiPick={false}
                globalActions={[
                    {label: 'Save current tabletop', createsFile: true, onClick: async (parents: string[]) => {
                        const name = 'New Scenario';
                        const [privateScenario] = scenarioToJson(this.props.scenario);
                        return await this.context.fileAPI.saveJsonToFile({name, parents}, privateScenario) as DriveMetadata<void, void>;
                    }}
                ]}
                fileActions={[
                    {
                        label: 'Pick',
                        disabled: () => (!this.state.gmConnected),
                        onClick: async (scenarioMetadata: DriveMetadata, params?: DropDownMenuClickParams) => {
                            if (!this.context.promiseModal || this.context.promiseModal.isBusy()) {
                                return;
                            }
                            const clearOption = 'Replace the tabletop\'s contents';
                            const appendOption = 'Add the scenario without clearing the tabletop';
                            const cancelOption = 'Cancel';
                            const response = isScenarioEmpty(this.props.scenario)
                                ? clearOption
                                : await this.context.promiseModal({
                                    children: (
                                        <div>
                                            <p>
                                                Your current tabletop is not clear.  You can clear the tabletop and
                                                replace its contents with this scenario, or simply add the maps, minis
                                                and templates from this scenario to your tabletop as it is.
                                            </p>
                                            <p>
                                                If you add the scenario without clearing, the scenario's contents will
                                                be centered and rotated on your current camera focus.  The newly added
                                                maps, minis and templates may end up overlapping with the tabletop's
                                                current content.
                                            </p>
                                        </div>
                                    ),
                                    options: [clearOption, appendOption, cancelOption]
                                });
                            if (response !== cancelOption) {
                                params && params.showBusySpinner && params.showBusySpinner(true);
                                const json = await this.context.fileAPI.getJsonFileContents(scenarioMetadata);
                                const [privateScenario, publicScenario] = scenarioToJson(json);
                                if (response === clearOption) {
                                    this.props.dispatch(setScenarioAction(publicScenario, scenarioMetadata.id, false, true));
                                    this.props.dispatch(setScenarioAction(privateScenario, 'gm' + scenarioMetadata.id, true));
                                } else {
                                    const lookDirectionXZ = this.state.cameraLookAt.clone().sub(this.state.cameraPosition);
                                    lookDirectionXZ.y = 0;
                                    lookDirectionXZ.normalize();
                                    // Looking in direction 0,0,-1 = no rotation.
                                    const orientation = new THREE.Euler(0, lookDirectionXZ.z < 0 ? Math.asin(-lookDirectionXZ.x) : Math.PI - Math.asin(-lookDirectionXZ.x), 0);
                                    this.props.dispatch(appendScenarioAction(
                                        this.adjustScenarioOrigin(publicScenario, this.state.cameraLookAt, orientation),
                                        scenarioMetadata.id)
                                    );
                                    this.props.dispatch(appendScenarioAction(
                                        this.adjustScenarioOrigin(privateScenario, this.state.cameraLookAt, orientation),
                                        'gm' + scenarioMetadata.id, true)
                                    );
                                }
                                this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
                            }
                        }
                    },
                    {label: 'Edit', onClick: 'edit'},
                    {label: 'Select', onClick: 'select'},
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
                            tabletop.</p>
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
                files={this.props.files}
                dispatch={this.props.dispatch}
                topDirectory={constants.FOLDER_BUNDLE}
                folderStack={this.state.folderStacks[constants.FOLDER_BUNDLE]}
                setFolderStack={this.setFolderStack}
                onBack={this.onBack}
                showSearch={false}
                allowUploadAndWebLink={false}
                allowMultiPick={false}
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
                    {label: 'Select', onClick: 'select'},
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
                return this.renderControlPanelAndTabletop();
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
                <ToastContainer className='toastContainer' position={toast.POSITION.BOTTOM_CENTER} hideProgressBar={true}/>
            </FullScreen>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    const history = getUndoableHistoryFromStore(store);
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store),
        windowTitle: getWindowTitleFromStore(store),
        tabletop: getTabletopFromStore(store),
        scenario: getScenarioFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store)!,
        connectedUsers: getConnectedUsersFromStore(store),
        myPeerId: getMyPeerIdFromStore(store),
        tabletopValidation: getTabletopValidationFromStore(store),
        createInitialStructure: getCreateInitialStructureFromStore(store),
        deviceLayout: getDeviceLayoutFromStore(store),
        debugLog: getDebugLogFromStore(store),
        dice: getDiceFromStore(store),
        pings: getPingsFromStore(store),
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        serviceWorker: getServiceWorkerFromStore(store)
    }
}

export default withResizeDetector(connect(mapStoreToProps)(VirtualGamingTabletop));