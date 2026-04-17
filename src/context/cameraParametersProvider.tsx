import {useGranularEffect} from 'granular-hooks';
import {
    createContext,
    FunctionComponent,
    MutableRefObject,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef
} from 'react';
import {useStore} from 'react-redux';
import {Vector3} from 'three';

import {updateGroupCameraAction, updateGroupCameraFocusMapIdAction} from '../redux/deviceLayoutReducer';
import {
    getDeviceLayoutFromStore,
    getMyPeerIdFromStore,
    getScenarioFromStore,
    getTabletopStateFromStore
} from '../redux/mainReducer';
import {
    setTabletopStateFocusMapIdAction,
    setTabletopStateIsLookingDownAction,
    setTabletopStateTopDownAction
} from '../redux/tabletopStateReducer';
import {getBaseCameraParameters, getFocusMapIdAndFocusPointAtLevel} from '../util/scenarioUtils';
import {buildVector3, isTopDown} from '../util/threeUtils';

export interface SetCameraParameters {
    cameraPosition: Vector3;
    cameraLookAt: Vector3;
    deltaPosition: Vector3;
    deltaLookAt: Vector3
}

export type SetCameraParametersFunction = (parameters: Partial<SetCameraParameters>, animate?: number, focusMapId?: string, fromGroup?: boolean) => void;

export interface CameraParametersContext {
    cameraPositionRef: MutableRefObject<Vector3>;
    cameraLookAtRef: MutableRefObject<Vector3>;

    // Animation-related values
    cameraTargetRef: MutableRefObject<undefined | {
        toPosition: Vector3;
        toLookAt: Vector3;
        startTime: number;
        endTime: number;
    }>;

    setCameraParameters: SetCameraParametersFunction;
    setFocusMapId: (levelMapId?: string, panCamera?: boolean | null) => void;
    getDefaultCameraFocus: (levelMapId?: string | null) => {cameraPosition: Vector3, cameraLookAt: Vector3};
    updateTabletopState: () => void;
    registerChangeCallback: (callback: () => void) => (() => void);
}

export const CameraParametersContextObject = createContext<CameraParametersContext | undefined>(undefined);

interface CameraParametersProviderProps extends PropsWithChildren {
    controlledCameraPosition?: Vector3;
    controlledCameraLookAt?: Vector3;
    controlledCameraAnimation?: number;
}

const CameraParametersProvider: FunctionComponent<CameraParametersProviderProps> = ({
                                                                                                  controlledCameraPosition,
                                                                                                  controlledCameraLookAt,
                                                                                                  controlledCameraAnimation,
                                                                                                  children
                                                                                              }) => {
    const store = useStore();
    
    const cameraPositionRef = useRef(new Vector3());
    const cameraLookAtRef = useRef(new Vector3());
    const cameraChangedCallbacksRef = useRef(new Set<() => void>());
    // Animation targets
    const cameraTargetRef = useRef<CameraParametersContext['cameraTargetRef']['current']>();

    const updateTabletopState = useCallback(() => {
        const {topDown, isLookingDown} = getTabletopStateFromStore(store.getState());
        const nextTopDown = isTopDown(cameraPositionRef.current, cameraLookAtRef.current);
        if (nextTopDown !== topDown) {
            store.dispatch(setTabletopStateTopDownAction(nextTopDown));
        }
        const nextIsLookingDown = cameraLookAtRef.current.y < cameraPositionRef.current.y;
        if (nextIsLookingDown !== isLookingDown) {
            store.dispatch(setTabletopStateIsLookingDownAction(nextIsLookingDown));
        }
    }, [store]);

    const setCameraParameters = useCallback((cameraParameters: Partial<SetCameraParameters>, animate = 0, focusMapId?: string | null, fromGroup = false) => {
        const myPeerId = getMyPeerIdFromStore(store.getState());
        const deviceLayout = getDeviceLayoutFromStore(store.getState());
        const position = cameraParameters.deltaPosition
            ? cameraPositionRef.current.clone().add(cameraParameters.deltaPosition)
            : cameraParameters.cameraPosition;
        const lookAt = cameraParameters.deltaLookAt
            ? cameraLookAtRef.current.clone().add(cameraParameters.deltaLookAt)
            : cameraParameters.cameraLookAt;
        if (lookAt || position || focusMapId) {
            if (animate) {
                const startTime = Date.now();
                const endTime = startTime + animate;
                cameraTargetRef.current = {
                    toPosition: position ?? cameraPositionRef.current.clone(),
                    toLookAt: lookAt ?? cameraLookAtRef.current.clone(),
                    startTime,
                    endTime
                }
            } else {
                if (position) {
                    cameraPositionRef.current.copy(position);
                }
                if (lookAt) {
                    cameraLookAtRef.current.copy(lookAt);
                }
                cameraTargetRef.current = undefined;
                updateTabletopState();
            }
            if (focusMapId !== undefined) {
                store.dispatch(setTabletopStateFocusMapIdAction(focusMapId || undefined));
            }
            cameraChangedCallbacksRef.current.forEach((callback) => (callback()));
        }
        if (!fromGroup && myPeerId && deviceLayout.layout[myPeerId]) {
            // We're part of a combined display, so also update the group display
            store.dispatch(updateGroupCameraAction(myPeerId, deviceLayout.layout[myPeerId].deviceGroupId, cameraParameters, animate, focusMapId ?? undefined));
        }
    }, [store, updateTabletopState]);

    const lookAtPointPreservingViewAngle = useCallback((newCameraLookAt: Vector3): Vector3 => {
        // Simply shift the cameraPosition by the same delta as we're shifting the cameraLookAt.
        return newCameraLookAt.clone().sub(cameraLookAtRef.current).add(cameraPositionRef.current);
    }, []);

    /**
     * Given a levelMapId, find the actual ID of the best map on that level to focus on, and the selected or default
     * 3D focus point for the level.
     *
     * @param levelMapId The mapId of a map on the level.  If null or undefined, default to the level at elevation 0.
     * @param panCamera If true, the cameraLookAt will be the focus point for the level (if no explicit focus point is
     * set, it will be the centre of the focusMapId).  If false, the cameraLookAt will be the same as the current
     * camera's from this.state, except the elevation will that of focusMapId.  If null, act like panCamera is true if
     * focusMapId has an explicit focus point, false if not.
     * @returns {focusMapId, cameraLookAt} The id of the best mapId on the level (e.g. the highest one with the lowest
     * mapId which has an explicit map focus point set), and the cameraLookAt for that map, as controlled by the
     * parameters.
     */
    const getLevelCameraLookAtAndFocusMapId = useCallback((levelMapId: string | null | undefined, panCamera: boolean | null) => {
        const scenario = getScenarioFromStore(store.getState());
        const levelMap = levelMapId ? scenario.maps[levelMapId] : undefined;
        const elevation = levelMap?.position.y;
        const {focusMapId, cameraFocusPoint} = getFocusMapIdAndFocusPointAtLevel(scenario.maps, elevation);
        const focusMap = focusMapId ? scenario.maps[focusMapId] : undefined;
        const cameraLookAt = (panCamera || (panCamera === null && cameraFocusPoint)) ? (
            (focusMapId && cameraFocusPoint) ? buildVector3(cameraFocusPoint)
                : buildVector3(focusMap?.position)
        ) : (
            new Vector3(cameraLookAtRef.current.x, focusMap?.position.y ?? 0, cameraLookAtRef.current.z)
        );
        return {focusMapId, cameraLookAt};
    }, [store]);

    const setFocusMapId = useCallback((levelMapId: string | undefined, panCamera: boolean | null = true) => {
        const state = store.getState();
        const scenario = getScenarioFromStore(state);
        const myPeerId = getMyPeerIdFromStore(state);
        const deviceLayout = getDeviceLayoutFromStore(state);
        const tabletopState = getTabletopStateFromStore(state);
        const {focusMapId, cameraLookAt} = getLevelCameraLookAtAndFocusMapId(levelMapId, panCamera);
        const cameraPosition = tabletopState.focusMapId || !focusMapId ? lookAtPointPreservingViewAngle(cameraLookAt)
            : getBaseCameraParameters(scenario.maps[focusMapId], 1, cameraLookAt).cameraPosition;
        setCameraParameters({cameraPosition, cameraLookAt}, 1000, focusMapId ?? null);
        if (myPeerId && deviceLayout.layout[myPeerId]) {
            store.dispatch(updateGroupCameraFocusMapIdAction(deviceLayout.layout[myPeerId].deviceGroupId, focusMapId));
        }
    }, [getLevelCameraLookAtAndFocusMapId, lookAtPointPreservingViewAngle, setCameraParameters, store]);

    const getDefaultCameraFocus = useCallback((levelMapId?: string | null) => {
        const scenario = getScenarioFromStore(store.getState());
        if (levelMapId === undefined) {
            levelMapId = getTabletopStateFromStore(store.getState()).focusMapId;
        }
        const {focusMapId, cameraLookAt} = getLevelCameraLookAtAndFocusMapId(levelMapId, true);
        return getBaseCameraParameters(focusMapId ? scenario.maps[focusMapId] : undefined, 1, cameraLookAt);
    }, [getLevelCameraLookAtAndFocusMapId, store]);

    const registerChangeCallback = useCallback((callback: () => void) => {
        cameraChangedCallbacksRef.current.add(callback);
        return () => {
            cameraChangedCallbacksRef.current.delete(callback);
        }
    }, []);

    useGranularEffect(() => {
        const base = getBaseCameraParameters();
        cameraPositionRef.current = new Vector3().copy(controlledCameraPosition ?? base.cameraPosition);
        cameraLookAtRef.current = new Vector3().copy(controlledCameraLookAt ?? base.cameraLookAt);
    }, [], [controlledCameraLookAt, controlledCameraPosition]);
    
    useEffect(() => {
        setCameraParameters({
            cameraPosition: controlledCameraPosition,
            cameraLookAt: controlledCameraLookAt
        }, controlledCameraAnimation);
    }, [controlledCameraAnimation, controlledCameraLookAt, controlledCameraPosition, setCameraParameters]);
    
    const instanceValues = useMemo(() => ({
        cameraPositionRef,
        cameraLookAtRef,
        cameraTargetRef,
        setCameraParameters,
        setFocusMapId,
        getDefaultCameraFocus,
        updateTabletopState,
        registerChangeCallback,
    }), [getDefaultCameraFocus, registerChangeCallback, setCameraParameters, setFocusMapId, updateTabletopState]);
    
    return (
        <CameraParametersContextObject.Provider value={instanceValues}>
            {children}
        </CameraParametersContextObject.Provider>
    );
}

export default CameraParametersProvider;

export function useCameraParameters() {
    const value = useContext(CameraParametersContextObject);
    if (!value) {
        throw new Error('Call useCameraParameters from inside a CameraParametersProvider')
    }
    return value;
}
