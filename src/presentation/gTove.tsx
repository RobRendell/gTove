import './gTove.scss';

import debounce from 'lodash/debounce';
import * as PropTypes from 'prop-types';
import {Component} from 'react';
import FullScreen from 'react-full-screen';
import {connect} from 'react-redux';
import ResizeDetector from 'react-resize-detector';
import {toast} from 'react-toastify';
import {ActionCreators} from 'redux-undo';
import * as THREE from 'three';
import {v4} from 'uuid';

import ScreenBundleBrowser from '../container/screenBundleBrowser';
import ScreenMapBrowser from '../container/screenMapBrowser';
import ScreenMiniBrowser from '../container/screenMiniBrowser';
import ScreenPDFBrowser from '../container/screenPDFBrowser';
import ScreenScenarioBrowser from '../container/screenScenarioBrowser';
import ScreenTabletopBrowser from '../container/screenTabletopBrowser';
import ScreenTemplateBrowser from '../container/screenTemplateBrowser';
import UploadPlaceholderContainer from '../container/uploadPlaceholderContainer';
import {CameraParametersContext} from '../context/cameraParametersContextBridge';
import {PromiseModalContext} from '../context/promiseModalContextBridge';
import {
    appUpdateCheckForUpdateAction,
    appUpdateClearUpdatePromptAction,
    appUpdateForceUpdateAction,
} from '../redux/appUpdateReducer';
import {AppUpdateReducerType} from '../redux/appUpdateReducerTypes';
import {setBundleIdAction} from '../redux/bundleReducer';
import {
    addConnectedUserAction,
    setUserAllowedAction,
    updateConnectedUserDeviceAction
} from '../redux/connectedUserReducer';
import {ConnectedUserReducerType} from '../redux/connectedUserReducerTypes';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {CreateInitialStructureReducerType} from '../redux/createInitialStructureReducerTypes';
import {DeviceLayoutReducerType} from '../redux/deviceLayoutReducerTypes';
import {addFilesAction} from '../redux/fileIndexReducer';
import {FileIndexReducerType} from '../redux/fileIndexReducerTypes';
import {setTabletopIdAction} from '../redux/locationReducer';
import {
    getAllFilesFromStore,
    getAppUpdateFromStore,
    getConnectedUsersFromStore,
    getCreateInitialStructureFromStore,
    getDeviceLayoutFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    getTabletopResourceKeyFromStore,
    getTabletopStateFromStore,
    getTabletopValidationFromStore,
    getWindowTitleFromStore
} from '../redux/mainReducer';
import {GtoveDispatchProp, ReduxStoreType} from '../redux/mainReducerTypes';
import {MyPeerIdReducerType} from '../redux/myPeerIdReducerTypes';
import {
    addMapAction,
    addMiniAction,
    clearUpdateSideEffectAction,
    setScenarioLocalAction,
    settableScenarioReducer,
    updateMiniNameAction
} from '../redux/scenarioReducer';
import {initialTabletopReducerState, setTabletopAction, updateTabletopAction} from '../redux/tabletopReducer';
import {TabletopStateReducerType} from '../redux/tabletopStateReducerTypes';
import {setLastSavedHeadActionIdAction, setLastSavedPlayerHeadActionIdAction} from '../redux/tabletopValidationReducer';
import {TabletopValidationType} from '../redux/tabletopValidationTypes';
import {WINDOW_TITLE_DEFAULT} from '../redux/windowTitleReducer';
import {getTutorialScenario} from '../tutorial/tutorialUtils';
import {appVersion} from '../util/appVersion';
import {BundleType, isBundle} from '../util/bundleUtils';
import * as constants from '../util/constants';
import {isCloseTo} from '../util/mathsUtils';
import {
    cartesianToHexCoords,
    effectiveHexGridType,
    findPositionForNewMap,
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
import {
    FileAPI,
    FileAPIContext,
    FileMetadata,
    FileSystemUser,
    GridType,
    MapProperties,
    MiniProperties,
    PieceVisibilityEnum,
    TabletopFileAppProperties
} from '../util/storage/storageContract';
import {castMiniProperties, splitFileName} from '../util/storage/storageUtils';
import {generateRandomHexString} from '../util/stringUtils';
import {vector3ToObject} from '../util/threeUtils';
import DeviceLayoutComponent from './deviceLayoutComponent';
import InputButton from './inputButton';
import ScreenControlPanelAndTabletop from './screenControlPanelAndTabletop';
import UserPreferencesScreen from './userPreferencesScreen';

interface GToveProps extends GtoveDispatchProp {
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
    appUpdate: AppUpdateReducerType;
    tabletopState: TabletopStateReducerType;
}

interface GToveState {
    width: number;
    height: number;
    fullScreen: boolean;
    loading: string;
    currentPage: GToveMode;
    replaceMiniMetadataId?: string;
    replaceMapMetadataId?: string;
    replaceMapImageId?: string;
    gmConnected: boolean;
    playerView: boolean;
    toastIds: {[message: string]: string | number};
    workingMessages: string[];
    workingButtons: {[key: string]: () => void};
    savingTabletop: number;
}

type MiniSpace = ObjectVector3 & {scale: number};

export enum GToveMode {
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

class GTove extends Component<GToveProps, GToveState> {

    static SAVE_FREQUENCY_MS = 5000;

    static contextTypes = {
        fileAPI: PropTypes.object,
        promiseModal: PropTypes.func,
        cameraParameters: PropTypes.object
    };

    declare context: FileAPIContext & PromiseModalContext & CameraParametersContext;

    static readonly emptyScenario = settableScenarioReducer(undefined as any, {type: '@@init'});
    private readonly emptyTabletop: TabletopType;

    constructor(props: GToveProps) {
        super(props);
        this.onResize = this.onResize.bind(this);
        this.returnToGamingTabletop = this.returnToGamingTabletop.bind(this);
        this.saveTabletopToDrive = debounce(this.saveTabletopToDrive.bind(this), GTove.SAVE_FREQUENCY_MS, {leading: false});
        this.placeMap = this.placeMap.bind(this);
        this.placeMini = this.placeMini.bind(this);
        this.findPositionForNewMini = this.findPositionForNewMini.bind(this);
        this.findUnusedMiniName = this.findUnusedMiniName.bind(this);
        this.replaceMapImage = this.replaceMapImage.bind(this);
        this.replaceMetadata = this.replaceMetadata.bind(this);
        this.changeFocusLevel = this.changeFocusLevel.bind(this);
        this.createTutorial = this.createTutorial.bind(this);
        this.createNewTabletop = this.createNewTabletop.bind(this);
        this.state = {
            width: 0,
            height: 0,
            fullScreen: false,
            loading: '',
            currentPage: props.tabletopId ? GToveMode.GAMING_TABLETOP : GToveMode.TABLETOP_SCREEN,
            gmConnected: this.isGMConnected(props),
            playerView: false,
            toastIds: {},
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

    isGMConnected(props: GToveProps) {
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
        if (loadedJson?.gm && loadedJson.gm === this.props.loggedInUser.emailAddress) {
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
            this.setState({currentPage: GToveMode.WORKING_SCREEN, workingMessages: [], workingButtons: {}});
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
            const json = metadataId ? await this.loadPublicPrivateJson(metadataId, this.props.tabletopResourceKey) : {...this.emptyTabletop, ...GTove.emptyScenario};
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
            this.setState({currentPage: GToveMode.GAMING_TABLETOP});
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

    componentDidUpdate(prevProps: GToveProps) {
        if (this.props.createInitialStructure && !this.props.tabletopId) {
            this.setState((state) => {
                if (!state.loading) {
                    this.createTutorial();
                    return {loading: '...'};
                }
                return null;
            });
        }
        void this.checkVersions();
        if (Object.keys(this.props.connectedUsers.users).length === 0 && this.props.myPeerId) {
            // Add the logged-in user
            this.props.dispatch(addConnectedUserAction(this.props.myPeerId, this.props.loggedInUser, appVersion, this.state.width, this.state.height, this.props.deviceLayout));
        }
        void this.checkConnectedUsers();
        const focusMap = !this.props.tabletopState.focusMapId ? undefined : this.props.scenario.maps[this.props.tabletopState.focusMapId];
        const prevFocusMap = !prevProps.tabletopState.focusMapId ? undefined : prevProps.scenario.maps[prevProps.tabletopState.focusMapId];
        if (focusMap?.metadata.properties && !prevFocusMap?.metadata.properties) {
            this.context.cameraParameters.setCameraParameters(this.context.cameraParameters.getDefaultCameraFocus(this.props.tabletopState.focusMapId));
        }
    }

    async checkVersions() {
        // Check if we have a pending update from the service worker
        if (this.props.appUpdate.promptUpdate && this.context.promiseModal?.isAvailable()) {
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
                this.props.dispatch(appUpdateForceUpdateAction());
            } else {
                this.props.dispatch(appUpdateClearUpdatePromptAction());
            }
        }
        if (!this.props.appUpdate.updatePending) {
            // Also check if other clients have a newer version; if so, trigger the service worker to load the new code.
            const myClientOutdated = Object.keys(this.props.connectedUsers.users).reduce<boolean>((outdated, peerId) => {
                const user = this.props.connectedUsers.users[peerId];
                return outdated || (user.version !== undefined && appVersion.numCommits < user.version.numCommits);
            }, false);
            if (myClientOutdated) {
                this.props.dispatch(appUpdateCheckForUpdateAction());
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
            if (fileMetadata && fileMetadata.appProperties && scenarioState) {
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
        // TODO replace with the useToast hook when this is a functional component.
        if (enable) {
            if (!this.state.toastIds[message]) {
                this.setState((prevState: GToveState) => (
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

    private hasUnsavedActions(props: GToveProps = this.props) {
        if (!props.tabletopValidation.lastCommonScenario) {
            return false;
        }
        if (props.loggedInUser.emailAddress === props.tabletop.gm) {
            return props.tabletop.lastSavedHeadActionId !== props.tabletopValidation.lastCommonScenario.headActionId;
        } else {
            return props.tabletop.lastSavedPlayerHeadActionId !== props.tabletopValidation.lastCommonScenario.playerHeadActionId;
        }
    }

    async UNSAFE_componentWillReceiveProps(props: GToveProps) {
        if (!props.tabletopId) {
            if (this.props.tabletopId) {
                // Change back to tabletop screen if we're losing our tabletopId
                this.setState({currentPage: GToveMode.TABLETOP_SCREEN});
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
        if (!this.props.tabletopState.focusMapId) {
            if (Object.keys(props.scenario.maps).length > 0) {
                // Maps have appeared for the first time.
                this.setFocusMapIdToMapClosestToZero(!props.scenario.startCameraAtOrigin, props);
            }
        } else if (!props.scenario.maps[this.props.tabletopState.focusMapId]) {
            // The focus map has gone
            this.setFocusMapIdToMapClosestToZero(true, props);
        }
        if (props.scenario.updateSideEffect) {
            // Clear the update side-effect flag, which will also cause a tabletop save.
            this.props.dispatch(clearUpdateSideEffectAction());
        }
    }

    private setFocusMapIdToMapClosestToZero(panCamera: boolean, props: GToveProps = this.props) {
        const closestId = getMapIdClosestToZero(props.scenario.maps);
        this.context.cameraParameters.setFocusMapId(closestId, panCamera);
    }

    returnToGamingTabletop(callback?: () => void) {
        this.setState({currentPage: GToveMode.GAMING_TABLETOP,
            replaceMapMetadataId: undefined, replaceMapImageId: undefined, replaceMiniMetadataId: undefined}, callback);
    }

    changeFocusLevel(direction: 1 | -1) {
        const levelMapId = getMapIdOnNextLevel(direction, this.props.scenario.maps, this.props.tabletopState.focusMapId, false);
        this.context.cameraParameters.setFocusMapId(levelMapId, null);
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

    findPositionForNewMini(allowHiddenMap: boolean, scale = 1.0, basePosition: THREE.Vector3 | ObjectVector3 = this.context.cameraParameters.cameraLookAtRef.current, avoid: MiniSpace[] = []): MovementPathPoint {
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
            this.setState({currentPage: GToveMode.MAP_SCREEN, replaceMapMetadataId: metadataId});
        } else {
            this.setState({currentPage: GToveMode.MINIS_SCREEN, replaceMiniMetadataId: metadataId});
        }
    }

    replaceMapImage(replaceMapImageId?: string) {
        this.setState({currentPage: GToveMode.MAP_SCREEN, replaceMapImageId});
    }

    private placeMap(metadata: FileMetadata<void, MapProperties>) {
        const {name} = splitFileName(metadata.name);
        const position = vector3ToObject(findPositionForNewMap(this.props.scenario, metadata.properties!,
            this.context.cameraParameters.cameraLookAtRef.current, this.props.tabletopState.isLookingDown));
        const gmOnly = (this.loggedInUserIsGM() && mapMetadataHasNoGrid(metadata) && !this.state.playerView);
        const mapId = v4();
        this.props.dispatch(addMapAction({metadata, name, gmOnly, position}, mapId));
        this.setState({currentPage: GToveMode.GAMING_TABLETOP, replaceMapMetadataId: undefined, replaceMapImageId: undefined}, () => {
            this.context.cameraParameters.setFocusMapId(mapId);
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
            if (existingMiniId) {
                this.props.dispatch(updateMiniNameAction(existingMiniId, name));
                name = baseName + ' 2';
            }
        }
        const properties = castMiniProperties(miniMetadata.properties);
        const scale = properties?.scale || 1;
        const visibility = properties?.defaultVisibility || PieceVisibilityEnum.FOGGED;
        const position = this.findPositionForNewMini(visibility === PieceVisibilityEnum.HIDDEN, scale, this.context.cameraParameters.cameraLookAtRef.current, avoid);
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
        this.setState({currentPage: GToveMode.GAMING_TABLETOP});
        return {...position, scale};
    }

    private async createNewTabletop(parents: string[], name = 'New Tabletop', scenario = GTove.emptyScenario, tabletop = this.emptyTabletop): Promise<FileMetadata<TabletopFileAppProperties, void>> {
        // Create both the private file in the GM Data folder, and the new shared tabletop file
        const newTabletop = {
            ...tabletop,
            gmSecret: generateRandomHexString(48),
            ...scenario
        };
        const privateMetadata = await this.context.fileAPI.saveJsonToFile({name, parents: [this.props.files.roots[constants.FOLDER_GM_DATA]]}, newTabletop);
        const publicMetadata = await this.context.fileAPI.saveJsonToFile({name, parents, appProperties: {gmFile: privateMetadata.id}}, {...newTabletop, gmSecret: undefined});
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
            <DeviceLayoutComponent onFinish={this.returnToGamingTabletop} />
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
            case GToveMode.MAP_SCREEN:
                return (
                    <ScreenMapBrowser onFinish={this.returnToGamingTabletop}
                                      placeMap={this.placeMap}
                                      replaceMapMetadataId={this.state.replaceMapMetadataId}
                                      setReplaceMetadata={this.replaceMetadata}
                                      replaceMapImageId={this.state.replaceMapImageId}
                                      setReplaceMapImage={this.replaceMapImage}
                    />
                );
            case GToveMode.MINIS_SCREEN:
                return (
                    <ScreenMiniBrowser onFinish={this.returnToGamingTabletop}
                                       placeMini={this.placeMini}
                                       replaceMiniMetadataId={this.state.replaceMiniMetadataId}
                                       setReplaceMetadata={this.replaceMetadata}
                    />
                );
            case GToveMode.TEMPLATES_SCREEN:
                return (
                    <ScreenTemplateBrowser onFinish={this.returnToGamingTabletop}
                                           findPositionForNewMini={this.findPositionForNewMini}
                                           isGM={this.loggedInUserIsGM() && !this.state.playerView}
                    />
                );
            case GToveMode.TABLETOP_SCREEN:
                return (
                    <ScreenTabletopBrowser onFinish={this.returnToGamingTabletop}
                                           createNewTabletop={this.createNewTabletop}
                                           isGM={this.loggedInUserIsGM()}
                   />
                );
            case GToveMode.SCENARIOS_SCREEN:
                return this.isCurrentUserPlayer() ? null : (
                    <ScreenScenarioBrowser onFinish={this.returnToGamingTabletop}
                                           isGMConnected={this.isGMConnected(this.props)}
                                           defaultGrid={this.props.tabletop.defaultGrid}
                                           createTutorial={this.createTutorial}
                    />
                );
            case GToveMode.PDFS_SCREEN:
                return (
                    <ScreenPDFBrowser onFinish={this.returnToGamingTabletop} />
                );
            case GToveMode.BUNDLES_SCREEN:
                return (
                    <ScreenBundleBrowser onFinish={this.returnToGamingTabletop} />
                );
            case GToveMode.WORKING_SCREEN:
                return this.renderWorkingScreen();
            case GToveMode.DEVICE_LAYOUT_SCREEN:
                return this.renderDeviceLayoutScreen();
            case GToveMode.USER_PREFERENCES_SCREEN:
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
                        <ScreenControlPanelAndTabletop hidden={this.state.currentPage !== GToveMode.GAMING_TABLETOP}
                                                       readOnly={this.isTabletopReadonly()}
                                                       findPositionForNewMini={this.findPositionForNewMini}
                                                       findUnusedMiniName={this.findUnusedMiniName}
                                                       replaceMapImage={this.replaceMapImage}
                                                       changeFocusLevel={this.changeFocusLevel}
                                                       fullScreen={this.state.fullScreen}
                                                       setFullScreen={(fullScreen: boolean) => {this.setState({fullScreen})}}
                                                       setCurrentScreen={(currentPage: GToveMode) => {
                                                           this.setState({currentPage});
                                                       }}
                                                       isGMConnected={this.isGMConnected(this.props)}
                                                       savingTabletop={this.state.savingTabletop}
                                                       hasUnsavedChanges={this.hasUnsavedActions()}
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
        appUpdate: getAppUpdateFromStore(store),
        tabletopState: getTabletopStateFromStore(store),
    }
}

export default connect(mapStoreToProps)(GTove);