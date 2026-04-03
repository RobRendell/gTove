import {useGranularEffect} from 'granular-hooks';
import {FunctionComponent, useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {useCameraParameters} from '../context/cameraParametersProvider';
import {getScenarioFromStore, getTabletopStateFromStore} from '../redux/mainReducer';
import {clearUpdateSideEffectAction} from '../redux/scenarioReducer';
import {getMapIdClosestToZero} from '../util/scenarioUtils';
import { MapProperties } from '../util/storage/storageContract';

// Isolate effects which watch for changes to the whole scenario object into a component with no children, to avoid
// unnecessary re-renders of other components.
const ScenarioWatcher: FunctionComponent = () => {
    const scenario = useSelector(getScenarioFromStore);
    const dispatch = useDispatch();
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
    useGranularEffect(() => {
        let focusOnZero = false;
        if (focusMapId) {
            // Test if the focus map is no longer in the scenario.
            focusOnZero = noFocusMapData;
        } else if (Object.keys(scenario.maps).length > 0) {
            // No focus map and map scenario data is now present, so focus on one.
            focusOnZero = true;
        }
        if (focusOnZero) {
            const closestId = getMapIdClosestToZero(scenario.maps);
            setFocusMapId(closestId);
        }
    }, [focusMapId, noFocusMapData], [scenario.maps, setFocusMapId]);

    // Setting the updateSideEffect flag (and then clearing it here) will cause the scenario to save.
    useEffect(() => {
        if (scenario.updateSideEffect) {
            dispatch(clearUpdateSideEffectAction());
        }
    }, [dispatch, scenario.updateSideEffect]);

    return null;
}

export default ScenarioWatcher;