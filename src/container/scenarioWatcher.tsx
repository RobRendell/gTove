import {useGranularEffect} from 'granular-hooks';
import {FunctionComponent, useEffect, useMemo, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {useCameraParameters} from '../context/cameraParametersProvider';
import {
    getDiceFromStore,
    getLoggedInUserFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopFromStore,
    getTabletopIdFromStore,
    getTabletopStateFromStore,
    getTabletopValidationFromStore
} from '../redux/mainReducer';
import {clearUpdateSideEffectAction} from '../redux/scenarioReducer';
import {setTabletopStateHasUnsavedChangesAction} from '../redux/tabletopStateReducer';
import {getMapIdClosestToZero, ScenarioType} from '../util/scenarioUtils';
import {MapProperties} from '../util/storage/storageContract';
import {isDefined} from '../util/typescriptUtils';

interface ScenarioWatcherProps {
    saveTabletop: (scenarioState: ScenarioType | null, myPeerId: string | null, networkHubId: string | null, tabletopId?: string) => Promise<void> | undefined;
    networkHubId: string | null;
}

// Isolate effects which watch for changes to the whole scenario object and other rapidly-updating Redux objects into a
// component with no children, to avoid unnecessary re-renders of other components.
const ScenarioWatcher: FunctionComponent<ScenarioWatcherProps> = ({saveTabletop: saveTabletop, networkHubId}) => {
    const dispatch = useDispatch();
    const scenario = useSelector(getScenarioFromStore);
    const tabletop = useSelector(getTabletopFromStore);
    const myPeerId = useSelector(getMyPeerIdFromStore);
    const dice = useSelector(getDiceFromStore);
    const tabletopId = useSelector(getTabletopIdFromStore);
    const loggedInUser = useSelector(getLoggedInUserFromStore);
    const tabletopValidation = useSelector(getTabletopValidationFromStore);
    const {focusMapId} = useSelector(getTabletopStateFromStore);
    const {setFocusMapId, setCameraParameters, getDefaultCameraFocus} = useCameraParameters();

    const focusMap = !focusMapId ? undefined : scenario.maps[focusMapId];
    const lastFocusMapPropertiesRef = useRef<MapProperties | undefined>(undefined);
    useGranularEffect(() => {
        if (focusMapId && focusMap?.metadata.properties && !lastFocusMapPropertiesRef.current) {
            setCameraParameters(getDefaultCameraFocus(focusMapId));
        }
        lastFocusMapPropertiesRef.current = focusMap?.metadata.properties;
    }, [focusMap?.metadata.properties], [getDefaultCameraFocus, setCameraParameters, focusMapId]);

    // Auto-reset the focus map in certain circumstances.
    const noFocusMapData = !focusMap;
    const scenarioMapsExist = Object.keys(scenario.maps).length > 0;
    useGranularEffect(() => {
        // Refocus the camera if the focus map no longer exists in the scenario, or if there's no focus map and there
        // are maps in the scenario data.
        if (focusMapId ? noFocusMapData : scenarioMapsExist) {
            const closestId = getMapIdClosestToZero(scenario.maps);
            setFocusMapId(closestId);
        }
    }, [focusMapId, noFocusMapData, scenarioMapsExist], [scenario.maps, setFocusMapId]);

    // Setting the updateSideEffect flag (and then clearing it here) will cause the scenario to save.
    useEffect(() => {
        if (scenario.updateSideEffect) {
            dispatch(clearUpdateSideEffectAction());
        }
    }, [dispatch, scenario.updateSideEffect]);

    // Tabletop "dirty" checking and auto-saving.
    const hasUnsavedChanges = useMemo(() => {
        if (!tabletopValidation.lastCommonScenario) {
            return false;
        } else if (loggedInUser?.emailAddress === tabletop.gm) {
            // If tabletop value is undefined, the tabletop hasn't finished initialising. If the lastCommonScenario
            // value is undefined, the tabletop has never had any actions dispatched to it.
            return isDefined(tabletop.lastSavedHeadActionId) && isDefined(tabletopValidation.lastCommonScenario.headActionId)
                && tabletop.lastSavedHeadActionId !== tabletopValidation.lastCommonScenario.headActionId;
        } else {
            // As above.
            return isDefined(tabletop.lastSavedPlayerHeadActionId) && isDefined(tabletopValidation.lastCommonScenario.playerHeadActionId)
                && tabletop.lastSavedPlayerHeadActionId !== tabletopValidation.lastCommonScenario.playerHeadActionId;
        }
    }, [loggedInUser?.emailAddress, tabletop.gm, tabletop.lastSavedHeadActionId, tabletop.lastSavedPlayerHeadActionId, tabletopValidation.lastCommonScenario]);
    useEffect(() => {
        dispatch(setTabletopStateHasUnsavedChangesAction(hasUnsavedChanges));
    }, [dispatch, hasUnsavedChanges]);
    useEffect(() => {
        if (hasUnsavedChanges && myPeerId === networkHubId) {
            void saveTabletop(tabletopValidation.lastCommonScenario, myPeerId, networkHubId, tabletopId);
        }
    }, [dice, hasUnsavedChanges, myPeerId, networkHubId, saveTabletop, tabletopId, tabletopValidation.lastCommonScenario]);

    return null;
}

export default ScenarioWatcher;