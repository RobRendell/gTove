import './gTove.scss';

import {useGranularEffect} from 'granular-hooks';
import debounce from 'lodash/debounce';
import {FunctionComponent, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import ResizeDetector from 'react-resize-detector';
import {ActionCreators} from 'redux-undo';
import {v4} from 'uuid';

import FullScreenContainer from '../container/fullScreenContainer';
import ScenarioWatcher from '../container/scenarioWatcher';
import ScreenBundleBrowser from '../container/screenBundleBrowser';
import ScreenMapBrowser from '../container/screenMapBrowser';
import ScreenMiniBrowser from '../container/screenMiniBrowser';
import ScreenPDFBrowser from '../container/screenPDFBrowser';
import ScreenScenarioBrowser from '../container/screenScenarioBrowser';
import ScreenTabletopBrowser from '../container/screenTabletopBrowser';
import ScreenTemplateBrowser from '../container/screenTemplateBrowser';
import UploadPlaceholderContainer from '../container/uploadPlaceholderContainer';
import {useCameraParameters} from '../context/cameraParametersProvider';
import {FileAPIContextObject} from '../context/fileAPIProvider';
import {PromiseModalContextObject} from '../context/promiseModalProvider';
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
import {ConnectedUserUsersType} from '../redux/connectedUserReducerTypes';
import {setCreateInitialStructureAction} from '../redux/createInitialStructureReducer';
import {addFilesAction} from '../redux/fileIndexReducer';
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
    getWindowTitleFromStore
} from '../redux/mainReducer';
import {
    addMapAction,
    addMiniAction,
    emptyScenario,
    setScenarioLocalAction,
    updateMiniNameAction
} from '../redux/scenarioReducer';
import {initialTabletopReducerState, setTabletopAction, updateTabletopAction} from '../redux/tabletopReducer';
import {
    setTabletopStateCurrentPageAction,
    setTabletopStateScenarioReplaceStateAction
} from '../redux/tabletopStateReducer';
import {GToveMode} from '../redux/tabletopStateReducerTypes';
import {setLastSavedHeadActionIdAction, setLastSavedPlayerHeadActionIdAction} from '../redux/tabletopValidationReducer';
import {WINDOW_TITLE_DEFAULT} from '../redux/windowTitleReducer';
import {getTutorialScenario} from '../tutorial/tutorialUtils';
import {appVersion} from '../util/appVersion';
import {BundleType, isBundle} from '../util/bundleUtils';
import * as constants from '../util/constants';
import {
    findPositionForNewMap,
    findPositionForNewMini,
    findUnusedMiniName,
    getNetworkHubId,
    getUserDiceColours,
    isMapFoggedAtPosition,
    isTabletopLockedForPeer,
    isUserAllowedOnTabletop,
    jsonToScenarioAndTabletop,
    mapMetadataHasNoGrid,
    MiniSpace,
    scenarioToJson,
    ScenarioType,
    TabletopType,
    TabletopUserPreferencesType
} from '../util/scenarioUtils';
import {
    FileMetadata,
    MapProperties,
    MiniProperties,
    PieceVisibilityEnum,
    TabletopFileAppProperties
} from '../util/storage/storageContract';
import {castMiniProperties, splitFileName} from '../util/storage/storageUtils';
import {generateRandomHexString} from '../util/stringUtils';
import {vector3ToObject} from '../util/threeUtils';
import {isDefined} from '../util/typescriptUtils';
import InputButton from './inputButton';
import ScreenControlPanelAndTabletop from './screenControlPanelAndTabletop';
import {useToast} from './toastProvider';
import UserPreferencesScreen from './userPreferencesScreen';

const SAVE_FREQUENCY_MS = 5000;

const GTove: FunctionComponent = () => {
    const dispatch = useDispatch();
    const store = useStore();
    const fileAPI = useContext(FileAPIContextObject);
    const promiseModal = useContext(PromiseModalContextObject);
    const {setFocusMapId, cameraLookAtRef} = useCameraParameters();
    const toast = useToast();

    const files = useSelector(getAllFilesFromStore);
    const tabletopId = useSelector(getTabletopIdFromStore);
    const tabletopResourceKey = useSelector(getTabletopResourceKeyFromStore);
    const windowTitle = useSelector(getWindowTitleFromStore);
    const tabletop = useSelector(getTabletopFromStore);
    const loggedInUser = useSelector(getLoggedInUserFromStore)!;
    const connectedUsers = useSelector(getConnectedUsersFromStore);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const createInitialStructure = useSelector(getCreateInitialStructureFromStore);
    const appUpdate = useSelector(getAppUpdateFromStore);
    const {hasUnsavedChanges, playerView, isLookingDown, currentPage} = useSelector(getTabletopStateFromStore);

    const emptyTabletopRef = useRef({
        ...initialTabletopReducerState,
        gm: loggedInUser.emailAddress
    });

    const [loading, setLoading] = useState('');
    const [size, setSize] = useState({width: 0, height: 0});
    const [workingMessages, setWorkingMessage] = useState<string[]>([]);
    const [workingButtons, setWorkingButtons] = useState<{[key: string]: () => void}>({});
    const [savingTabletop, setSavingTabletop] = useState(0);

    const isGMConnected = useMemo(() => (
        // If I own the tabletop, then the GM is connected by definition.  Otherwise, check connectedUsers.
        !tabletop.gm || loggedInUser.emailAddress === tabletop.gm ||
        Object.keys(connectedUsers.users).some((peerId) => (
            connectedUsers.users[peerId].user.emailAddress === tabletop.gm
        ))
    ), [connectedUsers.users, loggedInUser.emailAddress, tabletop.gm]);

    const isTabletopLocked = useMemo(() => (
        isTabletopLockedForPeer(tabletop, connectedUsers.users, myPeerId)
    ), [connectedUsers.users, myPeerId, tabletop]);

    const currentUserAllowed = useMemo(() => (
        isUserAllowedOnTabletop(tabletop.gm, loggedInUser.emailAddress, tabletop.tabletopUserControl)
    ), [loggedInUser.emailAddress, tabletop.gm, tabletop.tabletopUserControl]);

    const isCurrentUserPlayer = useMemo(() => (
        loggedInUser.emailAddress !== tabletop.gm
    ), [loggedInUser, tabletop.gm]);

    const loadPublicPrivateJson = useCallback(async (metadataId: string, resourceKey?: string): Promise<(ScenarioType & TabletopType) | BundleType> => {
        let loadedJson = await fileAPI.getJsonFileContents({id: metadataId, resourceKey});
        if (loadedJson?.gm && loadedJson.gm === loggedInUser.emailAddress) {
            let metadata = files.fileMetadata[metadataId] as
                FileMetadata<TabletopFileAppProperties, void>;
            if (!metadata) {
                metadata = await fileAPI.getFullMetadata(metadataId) as
                    FileMetadata<TabletopFileAppProperties, void>;
                dispatch(addFilesAction([metadata]));
            }
            const privateJson = await fileAPI.getJsonFileContents({id: metadata.appProperties!.gmFile});
            loadedJson = {...loadedJson, ...privateJson};
        }
        return loadedJson;
    }, [dispatch, fileAPI, files.fileMetadata, loggedInUser.emailAddress]);

    const addWorkingMessage = useCallback((message: string) => {
        setWorkingMessage((prevState) => ([...prevState, message]));
    }, []);

    const appendToLastWorkingMessage = useCallback((message: string) => {
        setWorkingMessage((prevState) => ([
            ...prevState.slice(0, prevState.length - 1),
            prevState[prevState.length - 1] + message
        ]))
    }, []);

    const createImageShortcutFromDrive = useCallback(async (root: string, bundleName: string, fromBundleId: string, metadataList: string[]): Promise<void> => {
        let folder;
        for (let metadataId of metadataList) {
            if (!folder) {
                folder = await fileAPI.createFolder(bundleName, {parents: [files.roots[root]], properties: {fromBundleId}});
                addWorkingMessage(`Created folder ${root}/${bundleName}.`);
            }
            try {
                const bundleMetadata = await fileAPI.getFullMetadata(metadataId);
                addWorkingMessage(`Creating shortcut to image in ${root}/${bundleName}/${bundleMetadata.name}...`);
                await fileAPI.createShortcut({...bundleMetadata, properties: {...bundleMetadata.properties, fromBundleId}}, [folder.id]);
                appendToLastWorkingMessage(' done.');
            } catch (e) {
                addWorkingMessage(`Error! failed to create shortcut to image.`);
                console.error(e);
            }
        }
    }, [addWorkingMessage, appendToLastWorkingMessage, fileAPI, files.roots]);

    const extractBundle = useCallback(async (bundle: BundleType, fromBundleId: string) => {
        dispatch(setBundleIdAction(tabletopId));
        if (files.roots[constants.FOLDER_SCENARIO] && files.roots[constants.FOLDER_MAP] && files.roots[constants.FOLDER_MINI]) {
            // Check if have files from this bundle already... TODO
            // const existingBundleFiles = await fileAPI.findFilesWithProperty('fromBundleId', fromBundleId);
            dispatch(setTabletopStateCurrentPageAction(GToveMode.WORKING_SCREEN));
            setWorkingMessage([]);
            setWorkingButtons({});
            addWorkingMessage(`Extracting bundle ${bundle.name}!`);
            await createImageShortcutFromDrive(constants.FOLDER_MAP, bundle.name, fromBundleId, bundle.driveMaps);
            await createImageShortcutFromDrive(constants.FOLDER_MINI, bundle.name, fromBundleId, bundle.driveMinis);
            let folder;
            for (let scenarioName of Object.keys(bundle.scenarios)) {
                if (!folder) {
                    folder = await fileAPI.createFolder(bundle.name, {parents: [files.roots[constants.FOLDER_SCENARIO]]});
                    addWorkingMessage(`Created folder ${constants.FOLDER_SCENARIO}/${bundle.name}.`);
                }
                const scenario = bundle.scenarios[scenarioName];
                addWorkingMessage(`Saving scenario ${scenarioName}...`);
                await fileAPI.saveJsonToFile({name: scenarioName, parents: [folder.id], properties: {fromBundleId}}, scenario);
                appendToLastWorkingMessage(' done.');
            }
            addWorkingMessage(`Finished extracting bundle ${bundle.name}!`);
            setWorkingButtons((prevState) => ({...prevState, 'Close': () => {
                dispatch(setTabletopIdAction())
            }}));
        }
    }, [addWorkingMessage, appendToLastWorkingMessage, createImageShortcutFromDrive, dispatch, fileAPI, files.roots, tabletopId]);
    
    const loadTabletopFromDrive = useCallback(async (metadataId: string) => {
        try {
            const json = metadataId ? await loadPublicPrivateJson(metadataId, tabletopResourceKey)
                : {...emptyTabletopRef.current, ...emptyScenario};
            if (isBundle(json)) {
                await extractBundle(json, metadataId);
            } else {
                const [loadedScenario, loadedTabletop] = jsonToScenarioAndTabletop(json, files.fileMetadata);
                dispatch(setTabletopAction(loadedTabletop));
                dispatch(setScenarioLocalAction(loadedScenario));
                if (metadataId && windowTitle === WINDOW_TITLE_DEFAULT) {
                    const metadata = files.fileMetadata[metadataId] || await fileAPI.getFullMetadata(metadataId);
                    dispatch(setTabletopIdAction(metadataId, metadata.name, tabletopResourceKey));
                }
                // Reset Undo history after loading a tabletop
                dispatch(ActionCreators.clearHistory());
            }
        } catch (err) {
            // If the tabletop file doesn't exist, drop off that tabletop
            console.error(err);
            if (promiseModal?.isAvailable()) {
                await promiseModal({
                    children: 'The link you used is no longer valid.'
                });
            }
            dispatch(setTabletopIdAction());
        }
    }, [dispatch, extractBundle, fileAPI, files.fileMetadata, loadPublicPrivateJson, promiseModal, tabletopResourceKey, windowTitle]);

    const createNewTabletop = useCallback(async (parents: string[], name = 'New Tabletop', scenario = emptyScenario, tabletop = emptyTabletopRef.current): Promise<FileMetadata<TabletopFileAppProperties, void>> => {
        // Create both the private file in the GM Data folder, and the new shared tabletop file
        const newTabletop = {
            ...tabletop,
            gmSecret: generateRandomHexString(48),
            ...scenario
        };
        const privateMetadata = await fileAPI.saveJsonToFile({name, parents: [files.roots[constants.FOLDER_GM_DATA]]}, newTabletop);
        const publicMetadata = await fileAPI.saveJsonToFile({name, parents, appProperties: {gmFile: privateMetadata.id}}, {...newTabletop, gmSecret: undefined});
        await fileAPI.makeFileReadableToAll(publicMetadata);
        return publicMetadata as FileMetadata<TabletopFileAppProperties, void>;
    }, [fileAPI, files.roots]);

    const createTutorial = useCallback(async (createTabletop = true) => {
        dispatch(setCreateInitialStructureAction(false));
        const scenarioFolderMetadataId = files.roots[constants.FOLDER_SCENARIO];
        setLoading(': Creating tutorial scenario...');
        const tutorialScenario = getTutorialScenario();
        const scenarioMetadata = await fileAPI.saveJsonToFile({name: 'Tutorial Scenario', parents: [scenarioFolderMetadataId]}, tutorialScenario);
        dispatch(addFilesAction([scenarioMetadata]));
        if (createTabletop) {
            setLoading(': Creating tutorial tabletop...');
            const tabletopFolderMetadataId = files.roots[constants.FOLDER_TABLETOP];
            const publicTabletopMetadata = await createNewTabletop([tabletopFolderMetadataId], 'Tutorial Tabletop', tutorialScenario);
            dispatch(setTabletopIdAction(publicTabletopMetadata.id, publicTabletopMetadata.name, publicTabletopMetadata.resourceKey));
            dispatch(setTabletopStateCurrentPageAction(GToveMode.GAMING_TABLETOP));
        }
        setLoading('');
    }, [createNewTabletop, dispatch, fileAPI, files.roots]);

    const networkHubId = useMemo(() => (
        getNetworkHubId(loggedInUser.emailAddress, myPeerId, tabletop.gm, connectedUsers.users)
    ), [connectedUsers.users, loggedInUser.emailAddress, myPeerId, tabletop.gm]);

    const checkVersions = useCallback(async (appUpdate: AppUpdateReducerType, users: ConnectedUserUsersType) => {
        // Check if we have a pending update from the service worker
        if (appUpdate.promptUpdate && promiseModal?.isAvailable()) {
            const reload = 'Load latest version';
            const response = await promiseModal({
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
                dispatch(appUpdateForceUpdateAction());
            } else {
                dispatch(appUpdateClearUpdatePromptAction());
            }
        }
        if (!appUpdate.updatePending) {
            // Also check if other clients have a newer version; if so, trigger the service worker to load the new code.
            const myClientOutdated = Object.keys(users).some((peerId) => {
                const user = users[peerId];
                return (user.version !== undefined && appVersion.numCommits < user.version.numCommits);
            });
            if (myClientOutdated) {
                dispatch(appUpdateCheckForUpdateAction());
            }
        }
    }, [dispatch, promiseModal]);

    const checkConnectedUsers = useCallback(async () => {
        if (tabletopId && promiseModal?.isAvailable()) {
            for (let peerId of Object.keys(connectedUsers.users)) {
                const user = connectedUsers.users[peerId];
                if (peerId !== myPeerId && !user.checkedForTabletop && user.user.emailAddress) {
                    let userAllowed = isUserAllowedOnTabletop(tabletop.gm, user.user.emailAddress, tabletop.tabletopUserControl);
                    if (userAllowed === null) {
                        const allowConnection = `Allow ${user.user.displayName} to connect`;
                        const response = await promiseModal({
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
                        dispatch(setUserAllowedAction(peerId, userAllowed));
                        const {whitelist, blacklist} = tabletop.tabletopUserControl || {whitelist: [], blacklist: []};
                        dispatch(updateTabletopAction({tabletopUserControl: {
                                whitelist: userAllowed ? [...whitelist, user.user.emailAddress] : whitelist,
                                blacklist: userAllowed ? blacklist : [...blacklist, user.user.emailAddress]
                            }}));
                    } else {
                        dispatch(setUserAllowedAction(peerId, userAllowed));
                    }
                }
            }
        }
    }, [connectedUsers.users, dispatch, myPeerId, promiseModal, tabletop.gm, tabletop.tabletopUserControl, tabletopId]);

    const rawSaveTabletopToDrive = useCallback(async (scenarioState: ScenarioType | null, myPeerId: string | null, networkHubId?: string, tabletopId?: string) => {
        // Only attempt to save the tabletop if we are the network hub
        if (scenarioState && myPeerId === networkHubId && tabletopId) {
            // Select everything fresh from the store.
            const files = getAllFilesFromStore(store.getState());
            const tabletop = getTabletopFromStore(store.getState());
            const fileMetadata = files.fileMetadata[tabletopId] as FileMetadata<TabletopFileAppProperties, void>;
            if (fileMetadata && fileMetadata.appProperties && scenarioState) {
                setSavingTabletop((prevState) => (prevState + 1));
                const [privateScenario, publicScenario] = scenarioToJson(scenarioState);
                try {
                    const {gmSecret, ...tabletopRest} = tabletop;
                    await fileAPI.saveJsonToFile(tabletopId, {...publicScenario, ...tabletopRest});
                    await fileAPI.saveJsonToFile(fileMetadata.appProperties!.gmFile, {...privateScenario, ...tabletopRest, gmSecret});
                    dispatch(setLastSavedHeadActionIdAction(scenarioState!));
                    dispatch(setLastSavedPlayerHeadActionIdAction(scenarioState!));
                } catch (err) {
                    const loggedInUser = getLoggedInUserFromStore(store.getState());
                    if (loggedInUser) {
                        throw err;
                    }
                    // Else we've logged out in the meantime, so we expect the upload to fail.
                } finally {
                    setSavingTabletop((prevState) => (prevState - 1));
                }
            }
        }
    }, [dispatch, fileAPI, store]);
    const saveTabletopToDriveRef = useRef(rawSaveTabletopToDrive);
    saveTabletopToDriveRef.current = rawSaveTabletopToDrive;
    const saveTabletopToDrive = useMemo(() => (
        debounce(async (scenarioState: ScenarioType | null, myPeerId: string | null, networkHubId?: string, tabletopId?: string) => {
            saveTabletopToDriveRef.current(scenarioState, myPeerId, networkHubId, tabletopId)
        }, SAVE_FREQUENCY_MS, {leading: false})
    ), []);

    const returnToGamingTabletop = useCallback(() => {
        dispatch(setTabletopStateCurrentPageAction(GToveMode.GAMING_TABLETOP));
        dispatch(setTabletopStateScenarioReplaceStateAction(undefined));
    }, [dispatch]);

    const loggedInUserIsGM = useMemo(() => (
        loggedInUser && loggedInUser.emailAddress === tabletop.gm
    ), [loggedInUser, tabletop.gm]);

    const placeMap = useCallback((metadata: FileMetadata<void, MapProperties>) => {
        const {name} = splitFileName(metadata.name);
        const scenario = getScenarioFromStore(store.getState());
        const position = vector3ToObject(findPositionForNewMap(scenario, metadata.properties!,
            cameraLookAtRef.current, isLookingDown));
        const gmOnly = (loggedInUserIsGM && !playerView && mapMetadataHasNoGrid(metadata));
        const mapId = v4();
        dispatch(addMapAction({metadata, name, gmOnly, position}, mapId));
        dispatch(setTabletopStateCurrentPageAction(GToveMode.GAMING_TABLETOP));
        dispatch(setTabletopStateScenarioReplaceStateAction(undefined));
        setFocusMapId(mapId);
    }, [store, cameraLookAtRef, isLookingDown, loggedInUserIsGM, playerView, dispatch, setFocusMapId]);

    const placeMini = useCallback((miniMetadata: FileMetadata<void, MiniProperties>, avoid: MiniSpace[] = []): MiniSpace => {
        const match = splitFileName(miniMetadata.name).name.match(/^(.*?) *([0-9]*)$/)!;
        let baseName = match[1], suffixStr = match[2];
        const scenario = getScenarioFromStore(store.getState());
        let [name, suffix] = findUnusedMiniName(scenario, baseName, suffixStr ? Number(suffixStr) : undefined);
        if (suffix === 1 && suffixStr !== '1') {
            // There's a mini with baseName (with no suffix) already on the tabletop.  Rename it.
            const existingMiniId = Object.keys(scenario.minis).reduce<string | null>((result, miniId) => (
                result || ((scenario.minis[miniId].name === baseName) ? miniId : null)
            ), null);
            if (existingMiniId) {
                dispatch(updateMiniNameAction(existingMiniId, name));
                name = baseName + ' 2';
            }
        }
        const properties = castMiniProperties(miniMetadata.properties);
        const scale = properties?.scale || 1;
        const visibility = properties?.defaultVisibility || PieceVisibilityEnum.FOGGED;
        const position = findPositionForNewMini(scenario, tabletop,
            visibility === PieceVisibilityEnum.HIDDEN, cameraLookAtRef.current, scale, avoid);
        const onFog = position.onMapId ? isMapFoggedAtPosition(scenario.maps[position.onMapId], position) : false;
        const gmOnly = (visibility === PieceVisibilityEnum.HIDDEN || (visibility === PieceVisibilityEnum.FOGGED && onFog));
        if (gmOnly && (!loggedInUserIsGM || playerView)) {
            toast(name + ' added, but it is hidden from you.');
        }
        dispatch(addMiniAction({
            metadata: miniMetadata,
            name,
            visibility,
            gmOnly,
            position,
            movementPath: scenario.confirmMoves ? [position] : undefined,
            scale,
            onMapId: position.onMapId
        }));
        dispatch(setTabletopStateCurrentPageAction(GToveMode.GAMING_TABLETOP));
        return {...position, scale};
    }, [cameraLookAtRef, dispatch, loggedInUserIsGM, playerView, store, tabletop, toast]);

    // Unload checking.
    const preventUnloadRef = useRef(false);
    useEffect(() => {
        preventUnloadRef.current = hasUnsavedChanges && myPeerId === networkHubId;
    }, [hasUnsavedChanges, myPeerId, networkHubId]);
    const onBeforeUnload = useCallback((evt: BeforeUnloadEvent) => {
        if (preventUnloadRef.current) {
            evt.preventDefault();
            // Browsers no longer generally support displaying a custom message onBeforeUnload, but there's no harm in
            // still setting it.
            const message = 'Your changes to Drive have not finished saving - please wait until the spinner in the top right corner has stopped.';
            evt.returnValue = message;
            return message;
        } else {
            return undefined;
        }
    }, []);
    useEffect(() => {
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
        }
    }, [onBeforeUnload]);

    useGranularEffect(() => {
        void loadTabletopFromDrive(tabletopId);
    }, [tabletopId], [loadTabletopFromDrive]);

    useGranularEffect(() => {
        if (createInitialStructure && !tabletopId) {
            setLoading((prevState) => {
                if (!prevState) {
                    void createTutorial();
                    return '...'
                } else {
                    return prevState;
                }
            })
        }
    }, [createInitialStructure, tabletopId], [createTutorial]);

    useGranularEffect(() => {
        // If we mount with a tabletopId, start on the actual gaming tabletop
        if (tabletopId) {
            dispatch(setTabletopStateCurrentPageAction(GToveMode.GAMING_TABLETOP));
        }
    }, [], [dispatch, tabletopId]);

    useEffect(() => {
        void checkVersions(appUpdate, connectedUsers.users);
    }, [appUpdate, checkVersions, connectedUsers.users]);
    
    const onResize = useCallback((width?: number, height?: number) => {
        if (width !== undefined && height !== undefined) {
            setSize({width, height});
        }
    }, []);

    const myPeerIdSet = isDefined(myPeerId ? connectedUsers.users[myPeerId] : undefined);
    useEffect(() => {
        if (size.width && size.height && myPeerId) {
            if (!myPeerIdSet) {
                // Add the logged-in user
                const deviceLayout = getDeviceLayoutFromStore(store.getState());
                dispatch(addConnectedUserAction(myPeerId, loggedInUser, appVersion, size.width, size.height, deviceLayout));
            } else {
                dispatch(updateConnectedUserDeviceAction(myPeerId, size.width, size.height));
            }
        }
    }, [dispatch, loggedInUser, myPeerId, myPeerIdSet, size, store]);
    
    useEffect(() => {
        void checkConnectedUsers()
    }, [checkConnectedUsers]);

    useGranularEffect(() => {
        if (!tabletopId) {
            // Change back to the tabletop screen if we're losing our tabletopId
            dispatch(setTabletopStateCurrentPageAction(GToveMode.TABLETOP_SCREEN));
        } else {
            void loadTabletopFromDrive(tabletopId);
        }
    }, [tabletopId], [loadTabletopFromDrive]);

    // Persistent toasts
    useEffect(() => {
        toast('View-only mode - no GM is connected.', !isGMConnected);
    }, [isGMConnected, toast]);
    useEffect(() => {
        toast('The tabletop is locked by the GM - only they can make changes.', isGMConnected && isTabletopLocked);
    }, [isGMConnected, isTabletopLocked, toast]);
    useEffect(() => {
        toast('Requesting permission to connect to this tabletop, please wait...', isGMConnected && !currentUserAllowed);
    }, [currentUserAllowed, isGMConnected, toast]);

    const renderCurrentPage = useCallback(() => {
        switch (currentPage) {
            case GToveMode.MAP_SCREEN:
                return (
                    <ScreenMapBrowser onFinish={returnToGamingTabletop} placeMap={placeMap} />
                );
            case GToveMode.MINIS_SCREEN:
                return (
                    <ScreenMiniBrowser onFinish={returnToGamingTabletop} placeMini={placeMini} />
                );
            case GToveMode.TEMPLATES_SCREEN:
                return (
                    <ScreenTemplateBrowser onFinish={returnToGamingTabletop}
                                           isGM={loggedInUserIsGM && !playerView}
                    />
                );
            case GToveMode.TABLETOP_SCREEN:
                return (
                    <ScreenTabletopBrowser onFinish={returnToGamingTabletop}
                                           createNewTabletop={createNewTabletop}
                                           isGM={loggedInUserIsGM}
                    />
                );
            case GToveMode.SCENARIOS_SCREEN:
                return isCurrentUserPlayer ? null : (
                    <ScreenScenarioBrowser onFinish={returnToGamingTabletop}
                                           isGMConnected={isGMConnected}
                                           defaultGrid={tabletop.defaultGrid}
                                           createTutorial={createTutorial}
                    />
                );
            case GToveMode.PDFS_SCREEN:
                return (
                    <ScreenPDFBrowser onFinish={returnToGamingTabletop} />
                );
            case GToveMode.BUNDLES_SCREEN:
                return (
                    <ScreenBundleBrowser onFinish={returnToGamingTabletop} />
                );
            case GToveMode.WORKING_SCREEN:
                return (
                    <div className='workingScreen'>
                        {
                            workingMessages.map((message, index) => (
                                <div key={index}>{message}</div>
                            ))
                        }
                        <div>
                            {
                                Object.keys(workingButtons).map((label, index) => (
                                    <InputButton type='button' key={index} onChange={workingButtons[label]}>
                                        {label}
                                    </InputButton>
                                ))
                            }
                        </div>
                    </div>
                );
            case GToveMode.USER_PREFERENCES_SCREEN:
                const email = loggedInUser.emailAddress;
                const preferences: TabletopUserPreferencesType = tabletop.userPreferences[email] || {
                    dieColour: getUserDiceColours(tabletop, email).diceColour
                };
                return (
                    <UserPreferencesScreen
                        dispatch={dispatch}
                        preferences={preferences}
                        emailAddress={email}
                        onFinish={returnToGamingTabletop}
                    />
                );
            default:
                return null;
        }
    }, [createNewTabletop, createTutorial, currentPage, dispatch, isCurrentUserPlayer, isGMConnected, loggedInUser.emailAddress, loggedInUserIsGM, placeMap, placeMini, playerView, returnToGamingTabletop, tabletop, workingButtons, workingMessages]);

    return (
        <FullScreenContainer>
            <ResizeDetector handleWidth={true} handleHeight={true} onResize={onResize} />
            <ScenarioWatcher saveTabletopToDrive={saveTabletopToDrive} networkHubId={networkHubId} />
            <UploadPlaceholderContainer />
            {
                loading ? (
                    <div>
                        Waiting on Google Drive{loading}
                    </div>
                ) : (
                    <>
                        {
                            !tabletopId ? null : (
                                <ScreenControlPanelAndTabletop hidden={currentPage !== GToveMode.GAMING_TABLETOP}
                                                               readOnly={!isGMConnected || isTabletopLocked || !currentUserAllowed}
                                                               isGMConnected={isGMConnected}
                                                               savingTabletop={savingTabletop}
                                                               hasUnsavedChanges={hasUnsavedChanges}
                                                               placeMini={placeMini}
                                />
                            )
                        }
                        {renderCurrentPage()}
                    </>
                )
            }
        </FullScreenContainer>
    );
};

export default GTove;