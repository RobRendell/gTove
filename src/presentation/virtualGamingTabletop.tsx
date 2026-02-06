import * as React from 'react';
import * as PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {debounce, isEqual} from 'lodash';
import {toast, ToastContainer} from 'react-toastify';
import * as THREE from 'three';
import {randomBytes} from 'crypto';
import ResizeDetector from 'react-resize-detector';
import memoizeOne from 'memoize-one';
import FullScreen from 'react-full-screen';
import {v4} from 'uuid';
import {ActionCreators} from 'redux-undo';

import './virtualGamingTabletop.scss';

import {TabletopViewComponentCameraView} from './tabletopViewComponent';
import * as constants from '../util/constants';
import {
    addMapAction,
    addMiniAction,
    clearUpdateSideEffectAction,
    setScenarioLocalAction,
    settableScenarioReducer,
    updateMiniNameAction
} from '../redux/scenarioReducer';
import {setTabletopIdAction} from '../redux/locationReducer';
import {addFilesAction, FileIndexReducerType} from '../redux/fileIndexReducer';
import {
    getAllFilesFromStore,
    getConnectedUsersFromStore,
    getCreateInitialStructureFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getServiceWorkerFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    getTabletopResourceKeyFromStore,
    getTabletopValidationFromStore,
    getWindowTitleFromStore,
    GtoveDispatchProp,
    ReduxStoreType
} from '../redux/mainReducer';
import {
    cartesianToHexCoords,
    effectiveHexGridType,
    findPositionForNewMap,
    getBaseCameraParameters,
    getFocusMapIdAndFocusPointAtLevel,
    getMapIdAtPoint,
    getMapIdClosestToZero,
    getMapIdOnNextLevel,
    getNetworkHubId,
    getUserDiceColours,
    isMapFoggedAtPosition,
    isTabletopLockedForPeer,
    isUserAllowedOnTabletop,
    jsonToScenarioAndTabletop,
    mapMetadataHasNoGrid,
    MovementPathPoint,
    ObjectVector3,
    scenarioToJson,
    ScenarioType,
    spiralHexGridGenerator,
    spiralSquareGridGenerator,
    TabletopType,
    TabletopUserPreferencesType
} from '../util/scenarioUtils';
import InputButton from './inputButton';
import {
    addConnectedUserAction,
    ConnectedUserReducerType,
    ConnectedUserUsersType,
    setUserAllowedAction,
    updateConnectedUserDeviceAction
} from '../redux/connectedUserReducer';
import { FileMetadata, FileSystemUser, GridType, MapProperties, MiniProperties, PieceVisibilityEnum, TabletopFileAppProperties} from '../util/storage/storageContract';
import { FileAPI, FileAPIContext } from '../util/storage/storageContract';
import { buildVector3, vector3ToObject } from '../util/threeUtils';
import { castMiniProperties, splitFileName } from '../util/storage/storageUtils';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {
    setLastSavedHeadActionIdAction,
    setLastSavedPlayerHeadActionIdAction,
    TabletopValidationType
} from '../redux/tabletopValidationReducer';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducer';
import {initialTabletopReducerState, setTabletopAction, updateTabletopAction} from '../redux/tabletopReducer';
import {BundleType, isBundle} from '../util/bundleUtils';
import {setBundleIdAction} from '../redux/bundleReducer';
import {
    CreateInitialStructureReducerType,
    setCreateInitialStructureAction
} from '../redux/createInitialStructureReducer';
import {getTutorialScenario} from '../tutorial/tutorialUtils';
import DeviceLayoutComponent from './deviceLayoutComponent';
import {
    DeviceLayoutReducerType,
    updateGroupCameraAction,
    updateGroupCameraFocusMapIdAction
} from '../redux/deviceLayoutReducer';
import {appVersion} from '../util/appVersion';
import {WINDOW_TITLE_DEFAULT} from '../redux/windowTitleReducer';
import {isCloseTo} from '../util/mathsUtils';
import {ServiceWorkerReducerType, serviceWorkerSetUpdateAction} from '../redux/serviceWorkerReducer';
import UserPreferencesScreen from './userPreferencesScreen';
import ScreenControlPanelAndTabletop from './screenControlPanelAndTabletop';
import ScreenMapBrowser from '../container/screenMapBrowser';
import ScreenMiniBrowser from '../container/screenMiniBrowser';
import ScreenTemplateBrowser from '../container/screenTemplateBrowser';
import ScreenTabletopBrowser from '../container/screenTabletopBrowser';
import ScreenScenarioBrowser from '../container/screenScenarioBrowser';
import ScreenPDFBrowser from '../container/screenPDFBrowser';
import ScreenBundleBrowser from '../container/screenBundleBrowser';
import UploadPlaceholderContainer from '../container/uploadPlaceholderContainer';
import {serviceWorkerStore} from '../util/serviceWorkerStore';

interface VirtualGamingTabletopProps extends GtoveDispatchProp {
    files: FileIndexReducerType;
    tabletopId: string;
    tabletopResourceKey?: string;
    windowTitle: string;
    scenario: ScenarioType;
    tabletop: TabletopType;
    loggedInUser: FileSystemUser;
    connectedUsers: ConnectedUserReducerType;
    tabletopValidation: TabletopValidationType;
    myPeerId: MyPeerIdReducerType;
    createInitialStructure: CreateInitialStructureReducerType;
    deviceLayout: DeviceLayoutReducerType;
    serviceWorker: ServiceWorkerReducerType;
}

export interface VirtualGamingTabletopCameraState {
    cameraPosition: THREE.Vector3;
    cameraLookAt: THREE.Vector3;
}

export type SetCameraFunction = (parameters: Partial<VirtualGamingTabletopCameraState>, animate?: number, focusMapId?: string) => void;

interface VirtualGamingTabletopState extends VirtualGamingTabletopCameraState {
    width: number;
    height: number;
    targetCameraPosition?: THREE.Vector3;
    targetCameraLookAt?: THREE.Vector3;
    cameraAnimationStart?: number;
    cameraAnimationEnd?: number;
    fullScreen: boolean;
    loading: string;
    currentPage: VirtualGamingTabletopMode;
    replaceMiniMetadataId?: string;
    replaceMapMetadataId?: string;
    replaceMapImageId?: string;
    gmConnected: boolean;
    playerView: boolean;
    toastIds: {[message: string]: string | number};
    focusMapId?: string;
    workingMessages: string[];
    workingButtons: {[key: string]: () => void};
    savingTabletop: number;
}

type MiniSpace = ObjectVector3 & {scale: number};

export enum VirtualGamingTabletopMode {
    GAMING_TABLETOP,
    MAP_SCREEN,
    MINIS_SCREEN,
    TEMPLATES_SCREEN,
    TABLETOP_SCREEN,
    SCENARIOS_SCREEN,
    PDFS_SCREEN,
    BUNDLES_SCREEN,
    WORKING_SCREEN,
    DEVICE_LAYOUT_SCREEN,
    USER_PREFERENCES_SCREEN
}

class VirtualGamingTabletop extends React.Component<VirtualGamingTabletopProps, VirtualGamingTabletopState> {

    static SAVE_FREQUENCY_MS = 5000;

    static contextTypes = {
        fileAPI: PropTypes.object,
        promiseModal: PropTypes.func
    };

    context: FileAPIContext & PromiseModalContext;

    static readonly emptyScenario = settableScenarioReducer(undefined as any, {type: '@@init'});
    private readonly emptyTabletop: TabletopType;

    constructor(props: VirtualGamingTabletopProps) {
        super(props);
        this.onResize = this.onResize.bind(this);
        this.returnToGamingTabletop = this.returnToGamingTabletop.bind(this);
        this.setFocusMapId = this.setFocusMapId.bind(this);
        this.setCameraParameters = this.setCameraParameters.bind(this);
        this.saveTabletopToDrive = debounce(this.saveTabletopToDrive.bind(this), VirtualGamingTabletop.SAVE_FREQUENCY_MS, {leading: false});
        this.placeMap = this.placeMap.bind(this);
        this.placeMini = this.placeMini.bind(this);
        this.findPositionForNewMini = this.findPositionForNewMini.bind(this);
        this.findUnusedMiniName = this.findUnusedMiniName.bind(this);
        this.replaceMapImage = this.replaceMapImage.bind(this);
        this.calculateCameraView = memoizeOne(this.calculateCameraView);
        this.getDefaultCameraFocus = this.getDefaultCameraFocus.bind(this);
        this.replaceMetadata = this.replaceMetadata.bind(this);
        this.changeFocusLevel = this.changeFocusLevel.bind(this);
        this.createTutorial = this.createTutorial.bind(this);
        this.createNewTabletop = this.createNewTabletop.bind(this);
        this.state = {
            width: 0,
            height: 0,
            fullScreen: false,
            loading: '',
            currentPage: props.tabletopId ? VirtualGamingTabletopMode.GAMING_TABLETOP : VirtualGamingTabletopMode.TABLETOP_SCREEN,
            gmConnected: this.isGMConnected(props),
            playerView: false,
            toastIds: {},
            ...getBaseCameraParameters(),
            workingMessages: [],
            workingButtons: {},
            savingTabletop: 0
        };
        this.emptyTabletop = {
            ...initialTabletopReducerState,
            gm: props.loggedInUser.emailAddress
        };
    }

    onResize(width?: number, height?: number) {
        if (width !== undefined && height !== undefined) {
            this.setState({width, height});
            this.props.dispatch(updateConnectedUserDeviceAction(this.props.myPeerId!, width, height));
        }
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

    private async loadPublicPrivateJson(metadataId: string, resourceKey?: string)
    : Promise<(ScenarioType & TabletopType) | BundleType> {
        const fileAPI: FileAPI = this.context.fileAPI;
        let loadedJson = await fileAPI.getJsonFileContents({id: metadataId, resourceKey});
        if (loadedJson.gm && loadedJson.gm === this.props.loggedInUser.emailAddress) {
            let metadata = this.props.files.fileMetadata[metadataId] as 
                FileMetadata<TabletopFileAppProperties, void>;
            if (!metadata) {
                metadata = await fileAPI.getFullMetadata(metadataId) as
                    FileMetadata<TabletopFileAppProperties, void>;
                this.props.dispatch(addFilesAction([metadata]));
            }
            const privateJson = await fileAPI.getJsonFileContents({id: metadata.appProperties!.gmFile});
            loadedJson = {...loadedJson, ...privateJson};
        }
        return loadedJson;
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
            const json = metadataId ? await this.loadPublicPrivateJson(metadataId, this.props.tabletopResourceKey) : {...this.emptyTabletop, ...VirtualGamingTabletop.emptyScenario};
            if (isBundle(json)) {
                await this.extractBundle(json, metadataId);
            } else {
                const [loadedScenario, loadedTabletop] = jsonToScenarioAndTabletop(json, this.props.files.fileMetadata);
                this.props.dispatch(setTabletopAction(loadedTabletop));
                this.props.dispatch(setScenarioLocalAction(loadedScenario));
                if (metadataId && this.props.windowTitle === WINDOW_TITLE_DEFAULT) {
                    const metadata = this.props.files.fileMetadata[metadataId] || await this.context.fileAPI.getFullMetadata(metadataId);
                    this.props.dispatch(setTabletopIdAction(metadataId, metadata.name, this.props.tabletopResourceKey));
                }
                // Reset Undo history after loading a tabletop
                this.props.dispatch(ActionCreators.clearHistory());
            }
        } catch (err) {
            // If the tabletop file doesn't exist, drop off that tabletop
            console.error(err);
            if (this.context.promiseModal?.isAvailable()) {
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
            const publicTabletopMetadata = await this.createNewTabletop([tabletopFolderMetadataId], 'Tutorial Tabletop', tutorialScenario);
            this.props.dispatch(setTabletopIdAction(publicTabletopMetadata.id, publicTabletopMetadata.name, publicTabletopMetadata.resourceKey));
            this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP});
        }
        this.setState({loading: ''});
    }

    async componentDidMount() {
        window.addEventListener('beforeunload', this.onBeforeUnload.bind(this));
        await this.loadTabletopFromDrive(this.props.tabletopId);
    }

    onBeforeUnload(evt: BeforeUnloadEvent) {
        const networkHubId = getNetworkHubId(this.props.loggedInUser.emailAddress, this.props.myPeerId, this.props.tabletop.gm, this.props.connectedUsers.users);
        if (this.props.myPeerId === networkHubId && this.hasUnsavedActions()) {
            evt.preventDefault();
            evt.returnValue = 'Your changes to Drive have not finished saving - please wait until the spinner in the top right corner has stopped.';
            return evt.returnValue;
        } else {
            return undefined;
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
            this.props.dispatch(addConnectedUserAction(this.props.myPeerId, this.props.loggedInUser, appVersion, this.state.width, this.state.height, this.props.deviceLayout));
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

    static updateVersionNow() {
        if (serviceWorkerStore.registration && serviceWorkerStore.registration.waiting) {
            serviceWorkerStore.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }

    async checkVersions() {
        const serviceWorker = this.props.serviceWorker;
        // Check if we have a pending update from the service worker
        if (serviceWorker.update && serviceWorkerStore.registration?.waiting
                && this.context.promiseModal?.isAvailable()) {
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
                VirtualGamingTabletop.updateVersionNow();
            } else {
                this.props.dispatch(serviceWorkerSetUpdateAction(false));
            }
        }
        if (serviceWorkerStore.registration && !serviceWorkerStore.registration.waiting) {
            // Also check if other clients have a newer version; if so, trigger the service worker to load the new code.
            const myClientOutdated = Object.keys(this.props.connectedUsers.users).reduce<boolean>((outdated, peerId) => {
                const user = this.props.connectedUsers.users[peerId];
                return outdated || (user.version !== undefined && appVersion.numCommits < user.version.numCommits);
            }, false);
            if (myClientOutdated) {
                await serviceWorkerStore.registration.update();
            }
        }
    }

    async checkConnectedUsers() {
        if (this.props.tabletopId && this.context.promiseModal?.isAvailable()) {
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

    saveTabletopToDrive(props = this.props): void {
        // Only attempt to save the tabletop if we are the network hub
        if (props.myPeerId === getNetworkHubId(props.loggedInUser.emailAddress, props.myPeerId, props.tabletop.gm, props.connectedUsers.users)) {
            const metadataId = props.tabletopId;
            const fileMetadata = metadataId && props.files.fileMetadata[metadataId] as FileMetadata<TabletopFileAppProperties, void>;
            const scenarioState = props.tabletopValidation.lastCommonScenario;
            if (fileMetadata && fileMetadata.appData && scenarioState) {
                this.setState((state) => ({savingTabletop: state.savingTabletop + 1}), async () => {
                    const [privateScenario, publicScenario] = scenarioToJson(scenarioState);
                    try {
                        const {gmSecret, ...tabletop} = props.tabletop;
                        await this.context.fileAPI.saveJsonToFile(metadataId, {...publicScenario, ...tabletop});
                        await this.context.fileAPI.saveJsonToFile(fileMetadata.appProperties!.gmFile, {...privateScenario, ...tabletop, gmSecret});
                        props.dispatch(setLastSavedHeadActionIdAction(scenarioState));
                        props.dispatch(setLastSavedPlayerHeadActionIdAction(scenarioState));
                    } catch (err) {
                        if (props.loggedInUser) {
                            throw err;
                        }
                        // Else we've logged out in the meantime, so we expect the upload to fail.
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
            return props.tabletop.lastSavedHeadActionId !== props.tabletopValidation.lastCommonScenario.headActionId;
        } else {
            return props.tabletop.lastSavedPlayerHeadActionId !== props.tabletopValidation.lastCommonScenario.playerHeadActionId;
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
        } else if (this.hasUnsavedActions(props)) {
            this.saveTabletopToDrive(props);
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
        if (!this.state.focusMapId) {
            if (Object.keys(props.scenario.maps).length > 0) {
                // Maps have appeared for the first time.
                this.setFocusMapIdToMapClosestToZero(!props.scenario.startCameraAtOrigin, props);
            }
        } else if (!props.scenario.maps[this.state.focusMapId]) {
            // The focus map has gone
            this.setFocusMapIdToMapClosestToZero(true, props);
        }
        this.updateCameraFromProps(props);
        if (props.scenario.updateSideEffect) {
            // Clear the update side-effect flag, which will also cause a tabletop save.
            this.props.dispatch(clearUpdateSideEffectAction());
        }
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

    returnToGamingTabletop(callback?: () => void) {
        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP,
            replaceMapMetadataId: undefined, replaceMapImageId: undefined, replaceMiniMetadataId: undefined}, callback);
    }

    getDefaultCameraFocus(levelMapId: string | undefined | null = this.state.focusMapId, props = this.props) {
        const {focusMapId, cameraLookAt} = this.getLevelCameraLookAtAndFocusMapId(levelMapId, true, props);
        return getBaseCameraParameters(focusMapId ? props.scenario.maps[focusMapId] : undefined, 1, cameraLookAt);
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
        const levelMap = levelMapId ? props.scenario.maps[levelMapId] : undefined;
        const elevation = levelMap?.position.y ?? 0;
        const {focusMapId, cameraFocusPoint} = getFocusMapIdAndFocusPointAtLevel(props.scenario.maps, elevation);
        const focusMap = focusMapId ? props.scenario.maps[focusMapId] : undefined;
        const cameraLookAt = (panCamera || (panCamera === null && cameraFocusPoint)) ? (
            (focusMapId && cameraFocusPoint) ? buildVector3(cameraFocusPoint)
                : buildVector3(focusMap?.position)
        ) : (
            new THREE.Vector3(this.state.cameraLookAt.x, focusMap?.position.y ?? 0, this.state.cameraLookAt.z)
        );
        return {focusMapId, cameraLookAt};
    }

    setFocusMapId(levelMapId: string | undefined, panCamera: boolean | null = true, props = this.props) {
        const {focusMapId, cameraLookAt} = this.getLevelCameraLookAtAndFocusMapId(levelMapId, panCamera, props);
        const cameraPosition = this.state.focusMapId || !focusMapId ? this.lookAtPointPreservingViewAngle(cameraLookAt)
            : getBaseCameraParameters(props.scenario.maps[focusMapId], 1, cameraLookAt).cameraPosition;
        this.setCameraParameters({cameraPosition, cameraLookAt}, 1000, focusMapId || null);
        if (props.deviceLayout.layout[this.props.myPeerId!]) {
            props.dispatch(updateGroupCameraFocusMapIdAction(props.deviceLayout.layout[props.myPeerId!].deviceGroupId, focusMapId));
        }
    }

    changeFocusLevel(direction: 1 | -1) {
        const levelMapId = getMapIdOnNextLevel(direction, this.props.scenario.maps, this.state.focusMapId, false);
        this.setFocusMapId(levelMapId, null);
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

    findPositionForNewMini(allowHiddenMap: boolean, scale = 1.0, basePosition: THREE.Vector3 | ObjectVector3 = this.state.cameraLookAt, avoid: MiniSpace[] = []): MovementPathPoint {
        // Find the map the mini is being placed on, if any.
        const onMapId = getMapIdAtPoint(basePosition, this.props.scenario.maps, allowHiddenMap);
        const onMap = onMapId ? this.props.scenario.maps[onMapId] : undefined;
        // Snap position to the relevant grid.
        const gridType = onMap?.metadata.properties!.gridType ?? this.props.tabletop.defaultGrid;
        const gridSnap = scale > 1 ? 1 : scale;
        let baseX, baseZ, spiralGenerator;
        switch (gridType) {
            case GridType.HEX_VERT:
            case GridType.HEX_HORZ:
                const mapRotation = onMap?.rotation.y ?? 0;
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

    loggedInUserIsGM(): boolean {
        return (this.props.loggedInUser !== null && this.props.loggedInUser.emailAddress === this.props.tabletop.gm);
    }

    replaceMetadata(isMap: boolean, metadataId?: string) {
        if (isMap) {
            this.setState({currentPage: VirtualGamingTabletopMode.MAP_SCREEN, replaceMapMetadataId: metadataId});
        } else {
            this.setState({currentPage: VirtualGamingTabletopMode.MINIS_SCREEN, replaceMiniMetadataId: metadataId});
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

    replaceMapImage(replaceMapImageId?: string) {
        this.setState({currentPage: VirtualGamingTabletopMode.MAP_SCREEN, replaceMapImageId});
    }

    private placeMap(metadata: FileMetadata<void, MapProperties>) {
        const {name} = splitFileName(metadata.name);
        const position = vector3ToObject(findPositionForNewMap(this.props.scenario, metadata.properties!, this.state.cameraLookAt, this.state.cameraLookAt.y < this.state.cameraPosition.y));
        const gmOnly = (this.loggedInUserIsGM() && mapMetadataHasNoGrid(metadata) && !this.state.playerView);
        const mapId = v4();
        this.props.dispatch(addMapAction({metadata, name, gmOnly, position}, mapId));
        this.setState({currentPage: VirtualGamingTabletopMode.GAMING_TABLETOP, replaceMapMetadataId: undefined, replaceMapImageId: undefined}, () => {
            this.setFocusMapId(mapId);
        });
    }

    private placeMini(miniMetadata: FileMetadata<void, MiniProperties>, avoid: MiniSpace[] = []): MiniSpace {
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
        const scale = properties?.scale || 1;
        const visibility = properties?.defaultVisibility || PieceVisibilityEnum.FOGGED;
        const position = this.findPositionForNewMini(visibility === PieceVisibilityEnum.HIDDEN, scale, this.state.cameraLookAt, avoid);
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

    private async createNewTabletop(parents: string[], name = 'New Tabletop', scenario = VirtualGamingTabletop.emptyScenario, tabletop = this.emptyTabletop): Promise<FileMetadata<TabletopFileAppProperties, void>> {
        // Create both the private file in the GM Data folder, and the new shared tabletop file
        const newTabletop = {
            ...tabletop,
            gmSecret: randomBytes(48).toString('hex'),
            ...scenario
        };
        const privateMetadata = await this.context.fileAPI.saveJsonToFile({name, parents: [this.props.files.roots[constants.FOLDER_GM_DATA]]}, newTabletop);
        const publicMetadata = await this.context.fileAPI.saveJsonToFile({name, parents, appData: {gmFile: privateMetadata.id}}, {...newTabletop, gmSecret: undefined});
        await this.context.fileAPI.makeFileReadableToAll(publicMetadata);
        return publicMetadata as FileMetadata<TabletopFileAppProperties, void>;
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
                onFinish={this.returnToGamingTabletop}
                cameraPosition={this.state.cameraPosition}
                cameraLookAt={this.state.cameraLookAt}
                focusMapId={this.state.focusMapId}
            />
        );
    }

    renderUserPreferencesScreen() {
        const email = this.props.loggedInUser.emailAddress;
        const preferences: TabletopUserPreferencesType = this.props.tabletop.userPreferences[email] || {
            dieColour: getUserDiceColours(this.props.tabletop, email).diceColour
        };
        return (
            <UserPreferencesScreen
                dispatch={this.props.dispatch}
                preferences={preferences}
                emailAddress={email}
                onFinish={this.returnToGamingTabletop}
            />
        );
    }

    renderOptionalScreens() {
        switch (this.state.currentPage) {
            case VirtualGamingTabletopMode.MAP_SCREEN:
                return (
                    <ScreenMapBrowser onFinish={this.returnToGamingTabletop}
                                      placeMap={this.placeMap}
                                      replaceMapMetadataId={this.state.replaceMapMetadataId}
                                      setReplaceMetadata={this.replaceMetadata}
                                      replaceMapImageId={this.state.replaceMapImageId}
                                      setReplaceMapImage={this.replaceMapImage}
                    />
                );
            case VirtualGamingTabletopMode.MINIS_SCREEN:
                return (
                    <ScreenMiniBrowser onFinish={this.returnToGamingTabletop}
                                       placeMini={this.placeMini}
                                       replaceMiniMetadataId={this.state.replaceMiniMetadataId}
                                       setReplaceMetadata={this.replaceMetadata}
                    />
                );
            case VirtualGamingTabletopMode.TEMPLATES_SCREEN:
                return (
                    <ScreenTemplateBrowser onFinish={this.returnToGamingTabletop}
                                           findPositionForNewMini={this.findPositionForNewMini}
                                           isGM={this.loggedInUserIsGM() && !this.state.playerView}
                    />
                );
            case VirtualGamingTabletopMode.TABLETOP_SCREEN:
                return (
                    <ScreenTabletopBrowser onFinish={this.returnToGamingTabletop}
                                           createNewTabletop={this.createNewTabletop}
                                           isGM={this.loggedInUserIsGM()}
                   />
                );
            case VirtualGamingTabletopMode.SCENARIOS_SCREEN:
                return this.isCurrentUserPlayer() ? null : (
                    <ScreenScenarioBrowser onFinish={this.returnToGamingTabletop}
                                           isGMConnected={this.isGMConnected(this.props)}
                                           cameraLookAt={this.state.cameraLookAt}
                                           cameraPosition={this.state.cameraPosition}
                                           defaultGrid={this.props.tabletop.defaultGrid}
                                           createTutorial={this.createTutorial}
                    />
                );
            case VirtualGamingTabletopMode.PDFS_SCREEN:
                return (
                    <ScreenPDFBrowser onFinish={this.returnToGamingTabletop} />
                );
            case VirtualGamingTabletopMode.BUNDLES_SCREEN:
                return (
                    <ScreenBundleBrowser onFinish={this.returnToGamingTabletop} />
                );
            case VirtualGamingTabletopMode.WORKING_SCREEN:
                return this.renderWorkingScreen();
            case VirtualGamingTabletopMode.DEVICE_LAYOUT_SCREEN:
                return this.renderDeviceLayoutScreen();
            case VirtualGamingTabletopMode.USER_PREFERENCES_SCREEN:
                return this.renderUserPreferencesScreen();
            default:
                return null;
        }
    }

    renderContent() {
        if (this.state.loading) {
            return (
                <div>
                    Waiting on Google Drive{this.state.loading}
                </div>
            );
        }
        return (
            <>
                {
                    !this.props.tabletopId ? null : (
                        <ScreenControlPanelAndTabletop hidden={this.state.currentPage !== VirtualGamingTabletopMode.GAMING_TABLETOP}
                                                       readOnly={this.isTabletopReadonly()}
                                                       cameraPosition={this.state.cameraPosition}
                                                       cameraLookAt={this.state.cameraLookAt}
                                                       setCamera={this.setCameraParameters}
                                                       focusMapId={this.state.focusMapId}
                                                       setFocusMapId={this.setFocusMapId}
                                                       findPositionForNewMini={this.findPositionForNewMini}
                                                       findUnusedMiniName={this.findUnusedMiniName}
                                                       cameraView={this.calculateCameraView(this.props.deviceLayout, this.props.connectedUsers.users, this.props.myPeerId!, this.state.width, this.state.height)}
                                                       replaceMapImage={this.replaceMapImage}
                                                       changeFocusLevel={this.changeFocusLevel}
                                                       getDefaultCameraFocus={this.getDefaultCameraFocus}
                                                       fullScreen={this.state.fullScreen}
                                                       setFullScreen={(fullScreen: boolean) => {this.setState({fullScreen})}}
                                                       setCurrentScreen={(currentPage: VirtualGamingTabletopMode) => {
                                                           this.setState({currentPage});
                                                       }}
                                                       isGMConnected={this.isGMConnected(this.props)}
                                                       savingTabletop={this.state.savingTabletop}
                                                       hasUnsavedChanges={this.hasUnsavedActions()}
                                                       updateVersionNow={VirtualGamingTabletop.updateVersionNow}
                                                       replaceMetadata={this.replaceMetadata}
                                                       placeMini={this.placeMini}
                                                       saveTabletop={this.saveTabletopToDrive}
                        />
                    )
                }
                {this.renderOptionalScreens()}
            </>
        );
    }

    render() {
        return (
            <FullScreen enabled={this.state.fullScreen} onChange={(fullScreen) => {this.setState({fullScreen})}}>
                <ResizeDetector handleWidth={true} handleHeight={true} onResize={this.onResize} />
                <UploadPlaceholderContainer />
                {this.renderContent()}
                <ToastContainer className='toastContainer' position={toast.POSITION.BOTTOM_CENTER} hideProgressBar={true}/>
            </FullScreen>
        );
    }
}

function mapStoreToProps(store: ReduxStoreType) {
    return {
        files: getAllFilesFromStore(store),
        tabletopId: getTabletopIdFromStore(store),
        tabletopResourceKey: getTabletopResourceKeyFromStore(store),
        windowTitle: getWindowTitleFromStore(store),
        tabletop: getTabletopFromStore(store),
        scenario: getScenarioFromStore(store),
        loggedInUser: getLoggedInUserFromStore(store)!,
        connectedUsers: getConnectedUsersFromStore(store),
        myPeerId: getMyPeerIdFromStore(store),
        tabletopValidation: getTabletopValidationFromStore(store),
        createInitialStructure: getCreateInitialStructureFromStore(store),
        deviceLayout: getDeviceLayoutFromStore(store),
        serviceWorker: getServiceWorkerFromStore(store)
    }
}

export default connect(mapStoreToProps)(VirtualGamingTabletop);